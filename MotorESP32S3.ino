#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <time.h>
#include <sys/time.h>
#include "FS.h"
#include "SPIFFS.h"
#include <PubSubClient.h>  // Add MQTT client library
#include <WebServer.h>  // Add WebServer library for authentication
#include <WiFiClientSecure.h>  // Add WiFiClientSecure for SSL/TLS
#include <ArduinoJson.h>  // Add ArduinoJson library for JSON parsing
#include <esp_task_wdt.h>
#include <ESPmDNS.h>

// ===== Login Configuration ===== //
const char* www_username = "admin";     
const char* www_password = "admin";

// ===== WiFi and MQTT Configuration ===== //
const char* ssid = "Flugel"; // Flugel Hub Unit 221
const char* password = "dogecoin"; // dogecoin ZWCFWFFN
const char* mqtt_server = "lb88002c.ala.us-east-1.emqxsl.com";
const int mqtt_port = 8883;  // MQTT over TLS/SSL Port
const char* mqtt_username = "Carlos";
const char* mqtt_password = "mqtt2025";

// MQTT Topic
const char* mqttTopic = "usf/messages";

const char* generalLogTopic = "usf/logs/general";
const char* commandLogTopic = "usf/logs/command";
const char* alertLogTopic = "usf/logs/alerts";

// --- Function Prototypes ---
void addToLog(const String &message);
void flushLogBuffer();
void publishMessage(const String& message);
void publishGeneralLog(const String& msg, const char* type);
void publishCommandLog(const String& msg);
void publishAlert(const char* level, const String& msg);
void callback(char* topic, byte* payload, unsigned int length);
void processLEDStatus(const String& tempStatus, unsigned long currentMillis);

// EMQX Root CA Certificate
static const char* root_ca PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDrzCCApegAwIBAgIQCDvgVpBCRrGhdWrJWZHHSjANBgkqhkiG9w0BAQUFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBD
QTAeFw0wNjExMTAwMDAwMDBaFw0zMTExMTAwMDAwMDBaMGExCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j
b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IENBMIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4jvhEXLeqKTTo1eqUKKPC3eQyaKl7hLOllsB
CSDMAZOnTjC3U/dDxGkAV53ijSLdhwZAAIEJzs4bg7/fzTtxRuLWZscFs3YnFo97
nh6Vfe63SKMI2tavegw5BmV/Sl0fvBf4q77uKNd0f3p4mVmFaG5cIzJLv07A6Fpt
43C/dxC//AH2hdmoRBBYMql1GNXRor5H4idq9Joz+EkIYIvUX7Q6hL+hqkpMfT7P
T19sdl6gSzeRntwi5m3OFBqOasv+zbMUZBfHWymeMr/y7vrTC0LUq7dBMtoM1O/4
gdW7jVg/tRvoSSiicNoxBN33shbyTApOB6jtSj1etX+jkMOvJwIDAQABo2MwYTAO
BgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUA95QNVbR
TLtm8KPiGxvDl7I90VUwHwYDVR0jBBgwFoAUA95QNVbRTLtm8KPiGxvDl7I90VUw
DQYJKoZIhvcNAQEFBQADggEBAMucN6pIExIK+t1EnE9SsPTfrgT1eXkIoyQY/Esr
hMAtudXH/vTBH1jLuG2cenTnmCmrEbXjcKChzUyImZOMkXDiqw8cvpOp/2PV5Adg
06O/nVsJ8dWO41P0jmP6P6fbtGbfYmbW0W5BjfIttep3Sp+dWOIrWcBAI+0tKIJF
PnlUkiaY4IBIqDfv8NZ5YBberOgOzW6sRBc4L0na4UU+Krk2U886UAb3LujEV0ls
YSEY1QSteDwsOoBrp+uvFRTp2InBuThs4pFsiv9kuXclVzDAGySj4dzp30d8tbQk
CAUw7C29C79Fv1C5qfPrmAESrciIxpg0X40KPMbp1ZWVbd4=
-----END CERTIFICATE-----
)EOF";

WebServer server(80);  // Create web server instance on port 80

const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = -5 * 3600; // EST (change to -4*3600 for EDT, etc.)
const int   daylightOffset_sec = 3600; // 1 hour daylight savings

// ESP-NOW message structure
typedef struct struct_message {
  char type[16];
  char payload[100];
} struct_message;

struct_message incomingDataStruct;

unsigned long lastHealthCheck = 0;
const unsigned long HEALTH_CHECK_INTERVAL = 300000; // Changed to 5 minutes (300000ms)
// Timing Configuration (ms)
unsigned long LIFT_MODE_DELAY = 100; // Reduced from 200ms to 100ms
unsigned long ELEVATOR_MODE_DELAY = 100; // Reduced from 200ms to 100ms
const unsigned long LED_CHECK_DELAY = 50; // Reduced from 300ms to 50ms
const unsigned long checkInterval = 500; // Reduced from 1500ms to 500ms

// Pin Definitions
#define UP_BUTTON 2 // 18
#define DOWN_BUTTON 4 // 19
#define UP_PIN 15 // 5
#define DOWN_PIN 27 // 4
#define LIMIT_SWITCH_UP 26 // 21
#define LIMIT_SWITCH_DOWN 25 // 22
#define BRAKE_PIN 14 
#define UP_OUTPUT_PIN 35    // Using pin 15 for UP output
#define DOWN_OUTPUT_PIN 34  // Using pin 16 for DOWN output
#define ALWAYS_HIGH_PIN1 12 // Pin that will always be HIGH
#define ALWAYS_HIGH_PIN2 24 // Pin that will always be HIGH
#define ALWAYS_HIGH_PIN3 13 // Pin that will always be HIGH
// Email Configuration
#define MAX_EMAILS 10
String emailAddresses[MAX_EMAILS];
int emailCount = 0;
bool emailNotificationsEnabled = true;
unsigned long lastEmailSent = 0;
const unsigned long EMAIL_COOLDOWN = 300000; // 5 minutes between emails

// Define Red and Green LED Input Pins
const int redLEDs[] = {5, 19, 22, 33}; // Array of pin numbers for Red LEDs
const int greenLEDs[] = {18, 21, 23, 32}; // Array of pin numbers for Green LEDs
const int numLEDs = 4; // Total LEDs per color

// Timing variables for LED reading
unsigned long previousMillis = 0; // // Variable to store the last time LED status was updated

// Variables to track LED states
bool lastStateRed[numLEDs] = {LOW, LOW, LOW, LOW}; // Array to store last read state of each Red LED
bool lastStateGreen[numLEDs] = {LOW, LOW, LOW, LOW}; // Array to store last read state of each Green LED
int changeCountRed[numLEDs] = {0, 0, 0, 0}; // Array to count state changes for Red LEDs
int changeCountGreen[numLEDs] = {0, 0, 0, 0}; // Array to count state changes for Green LEDs

// Global variable to hold LED status for the web UI
String ledStatus = ""; // This string will be updated with LED status info for the webpage

// ===== Global Variables ===== //
String serialLogs; // Stored Logs on to send to the web interface
bool elevatorMode = false; // Track the mode
String currentDirection = "none"; // Track current movement direction
String greenAlarms = "";  // Green alarm messages
String amberAlarms = "";  // Amber alarm messages
String redAlarms = "";    // Red alarm messages
unsigned long lastActionTime = 0; // Track when last action was made
String ledStatusHistory = "";
String lastLedSnapshot = "";
String lastRedEmailSent = "";
String lastAmberEmailSent = "";
String lastGreenEmailSent = "";

WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

// Topics for MQTT
const char* alarmTopic = "usf/alarms";
const char* statusTopic = "usf/status";

// LED state structure
struct LEDState {
    bool currentState;
    bool lastState;
    int changeCount;
    unsigned long lastChange;
};

// LED states arrays
LEDState redLEDStates[4];
LEDState greenLEDStates[4];

// Alert system configuration
#define ALERT_COOLDOWN 5000        // 5 seconds between different alerts
#define ALERT_DEBOUNCE_TIME 1000   // 1 second debounce for state changes
#define MAX_ALERT_HISTORY 50       // Maximum number of alerts to keep in memory

// Alert tracking structure
struct AlertState {
    String message;
    unsigned long lastChangeTime;
    unsigned long lastPublishTime;
    bool isActive;
    int stableCount;
};

// Global alert states
AlertState redAlertState;
AlertState amberAlertState;
AlertState greenAlertState;

// Global variables for alarm states
String currentRedAlarms = "";
String currentGreenAlarms = "";
String currentAmberAlarms = "";

// Function declarations
void stopUpMovement();
void stopDownMovement();
void stopMovement();
void handleMovement(const char* direction);
void applyBrake();
void releaseBrake();

// Get timestamp function
String getTimestamp() {
  struct tm timeinfo;
  if(!getLocalTime(&timeinfo)){
    return "Failed to obtain time";
  }
  char timeStringBuff[50];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(timeStringBuff);
}

// Movement control functions
void stopUpMovement() {
  digitalWrite(UP_PIN, LOW);
  if (currentDirection == "up") {
    currentDirection = "none";
    addToLog("Stopped upward movement");
  }
}

void stopDownMovement() {
  digitalWrite(DOWN_PIN, LOW);
  if (currentDirection == "down") {
    currentDirection = "none";
    addToLog("Stopped downward movement");
  }
}

void stopMovement() {
  // Add prominent Serial output for stop command
  Serial.println("\n=== LIFT COMMAND RECEIVED ===");
  Serial.println("Direction: STOP");
  Serial.println("===========================\n");
  
  digitalWrite(UP_PIN, LOW);
  digitalWrite(DOWN_PIN, LOW);
  currentDirection = "stop";
  addToLog("Movement stopped");
  publishCommandLog("Command executed: STOP");
  publishGeneralLog("Movement stopped", "info");
}

void handleMovement(const char* direction) {
    Serial.print("\n=== Movement Command Received ===\n");
    Serial.print("Direction: ");
    Serial.println(direction);
    Serial.print("Source Address: ");
    Serial.println((unsigned long)__builtin_return_address(0), HEX);
    Serial.print("UP Button State: ");
    Serial.println(digitalRead(UP_BUTTON));
    Serial.print("UP Pin State: ");
    Serial.println(digitalRead(UP_PIN));
    
    if (strcmp(direction, "up") == 0) {
        if (!digitalRead(LIMIT_SWITCH_UP)) {  // Check if not at upper limit
            digitalWrite(UP_PIN, HIGH);
            digitalWrite(DOWN_PIN, LOW);
            digitalWrite(BRAKE_PIN, LOW);
            Serial.println("Moving UP");
        } else {
            Serial.println("UP movement blocked - At upper limit");
        }
    } else if (strcmp(direction, "down") == 0) {
        if (!digitalRead(LIMIT_SWITCH_DOWN)) {  // Check if not at lower limit
            digitalWrite(UP_PIN, LOW);
            digitalWrite(DOWN_PIN, HIGH);
            digitalWrite(BRAKE_PIN, LOW);
            Serial.println("Moving DOWN");
        } else {
            Serial.println("DOWN movement blocked - At lower limit");
        }
    }
    Serial.println("===========================\n");
}

void applyBrake() {
  digitalWrite(BRAKE_PIN, HIGH);
  addToLog("Brake applied");
}

void releaseBrake() {
  digitalWrite(BRAKE_PIN, LOW);
  addToLog("Brake released");
}

// Function to publish message via MQTT
void publishMessage(const String& message) {
  if (!mqttClient.connected()) return;
  String payload = "{\"type\":\"info\",\"message\":\"" + message + "\",\"timestamp\":\"" + getTimestamp() + "\"}";
  mqttClient.publish(mqttTopic, payload.c_str());
  mqttClient.publish(generalLogTopic, payload.c_str()); // Also send to general log
}
    
  


// General log (info, error, warning, success)
void publishGeneralLog(const String& msg, const char* type) {
  if (!mqttClient.connected()) return;
  String payload = "{\"type\":\"" + String(type) + "\",\"message\":\"" + msg + "\",\"timestamp\":\"" + getTimestamp() + "\"}";
  mqttClient.publish(generalLogTopic, payload.c_str());
  mqttClient.publish(mqttTopic, payload.c_str()); // Also send to main topic
}

// Command log
void publishCommandLog(const String& msg) {
  if (!mqttClient.connected()) return;
  String payload = "{\"type\":\"command\",\"message\":\"" + msg + "\",\"timestamp\":\"" + getTimestamp() + "\"}";
  mqttClient.publish(commandLogTopic, payload.c_str());
  mqttClient.publish(mqttTopic, payload.c_str()); // Also send to main topic
}

// Alert console log (red, amber, green)
void publishAlert(const char* level, const String& msg) {
  if (!mqttClient.connected()) return;

  // Create LED status code string
  String ledCode = "";
  for (int i = 0; i < numLEDs; i++) {
    ledCode += String(redLEDStates[i].lastState ? "1" : "0");
  }
  ledCode += "-";
  for (int i = 0; i < numLEDs; i++) {
    ledCode += String(greenLEDStates[i].lastState ? "1" : "0");
  }

  String payload = "{\"type\":\"" + String(level) + "\",\"message\":\"" + msg + "\",\"led_code\":\"" + ledCode + "\",\"timestamp\":\"" + getTimestamp() + "\"}";
  mqttClient.publish(alertLogTopic, payload.c_str());  // Send only to alert topic
}

// Add at the top with other globals
unsigned long lastCommandTime = 0;
String lastCommand = "";
const unsigned long COMMAND_DEBOUNCE = 500; // 500ms minimum between same commands

void callback(char* topic, byte* payload, unsigned int length) {
    String message;
    for (int i = 0; i < length; i++) {
        message += (char)payload[i];
    }
    
    Serial.println("\n=== MQTT Command Received ===");
    Serial.print("Topic: ");
    Serial.println(topic);
    Serial.print("Message: ");
    Serial.println(message);
    
    // Check for duplicate commands
    unsigned long currentTime = millis();
    if (message == lastCommand && (currentTime - lastCommandTime) < COMMAND_DEBOUNCE) {
        Serial.println("Duplicate command rejected");
        return;
    }
    
    // Update command tracking
    lastCommand = message;
    lastCommandTime = currentTime;
    
    // Process command
    if (message == "up") {
        handleMovement("up");
    } else if (message == "down") {
        handleMovement("down");
    } else if (message == "stop") {
        stopMovement();
    }
    
    Serial.println("=========================\n");
}

// Function to reconnect to MQTT broker
void reconnectMQTT() {
    if (WiFi.status() != WL_CONNECTED) {
        return;
    }
    int attempts = 0;
    const int MAX_ATTEMPTS = 3;
    while (!mqttClient.connected() && attempts < MAX_ATTEMPTS) {
        String clientId = "ESP32Client-" + String(random(0xffff), HEX);
        if (mqttClient.connect(clientId.c_str(), mqtt_username, mqtt_password)) {
            Serial.println("Connected to MQTT broker");
            
            // Subscribe to topics
            mqttClient.subscribe(commandLogTopic);
            mqttClient.subscribe(generalLogTopic);
            mqttClient.subscribe(alertLogTopic);
            
            // Send subscription confirmation to both topics
            String subscribeMsg = "Subscribed to topics: " + String(commandLogTopic) + ", " + String(generalLogTopic) + ", " + String(alertLogTopic);
            publishGeneralLog(subscribeMsg, "info");
            
            // Send connection message
            publishGeneralLog("Device connected and ready", "info");
            return;
        }
        attempts++;
        if (attempts < MAX_ATTEMPTS) {
            delay(5000);
        }
    }
    if (!mqttClient.connected()) {
        Serial.println("Failed to connect to MQTT after maximum attempts");
    }
}

bool sendAlarmEmail(String alarmType, String alarmMessage) {
    if (!emailNotificationsEnabled || millis() - lastEmailSent < EMAIL_COOLDOWN) {
        Serial.println("Email not sent: notifications disabled or cooldown active");
        return false;
    }
    
    // Instead of sending email directly, publish to MQTT for web interface to handle
    if (mqttClient.connected()) {
        String payload = "{\"type\":\"email_alert\",\"alert_type\":\"" + alarmType + 
                        "\",\"message\":\"" + alarmMessage + 
                        "\",\"timestamp\":\"" + getTimestamp() + "\"}";
        Serial.println("Publishing email alert to MQTT: " + payload);
        mqttClient.publish("usf/alerts/email", payload.c_str());
        lastEmailSent = millis();
        return true;
    }
    Serial.println("Email not sent: MQTT client not connected");
    return false;
}

// ===== HTML Content ===== //

// Buffer sizes and optimization constants
const size_t LOG_BUFFER_SIZE = 1024;  // 1KB buffer for logs
const size_t MAX_LOG_SIZE = 2000;     // Maximum log size before truncation
const unsigned long LOG_FLUSH_INTERVAL = 5000; // Flush log buffer every 5 seconds
const size_t TIME_BUFFER_SIZE = 30;    // Buffer for timestamp strings

// Buffers for string operations
char timeBuffer[TIME_BUFFER_SIZE];     // Reusable buffer for timestamps
char logBuffer[LOG_BUFFER_SIZE];       // Buffer for log messages
size_t logBufferIndex = 0;            // Current position in log buffer
unsigned long lastLogFlush = 0;        // Last time logs were written to SPIFFS

// Add these constants near the top with other constants
const unsigned long DEBUG_LOG_INTERVAL = 5000;  // Only log debug messages every 5 seconds
const unsigned long LED_STATUS_LOG_INTERVAL = 10000;  // Only log LED status every 10 seconds
unsigned long lastDebugLog = 0;
unsigned long lastLEDStatusLog = 0;

// Optimized addToLog function
void addToLog(const String &message) {
    struct tm timeinfo;
    if (getLocalTime(&timeinfo)) {
        strftime(timeBuffer, TIME_BUFFER_SIZE, "[%Y-%m-%d %H:%M:%S] ", &timeinfo);
    } else {
        strcpy(timeBuffer, "[time error] ");
    }

    // Calculate total length needed
    size_t messageLen = strlen(timeBuffer) + message.length() + 2; // +2 for \n and null terminator

    // If buffer would overflow, flush it first
    if (logBufferIndex + messageLen >= LOG_BUFFER_SIZE) {
        flushLogBuffer();
    }

    // Add to buffer
    strcpy(logBuffer + logBufferIndex, timeBuffer);
    logBufferIndex += strlen(timeBuffer);
    message.toCharArray(logBuffer + logBufferIndex, LOG_BUFFER_SIZE - logBufferIndex);
    logBufferIndex += message.length();
    logBuffer[logBufferIndex++] = '\n';
    logBuffer[logBufferIndex] = '\0';

    // Also send to Serial immediately
    Serial.println(message);

    // Check if it's time to flush the buffer
    if (millis() - lastLogFlush >= LOG_FLUSH_INTERVAL) {
        flushLogBuffer();
    }
}

// New function to flush log buffer
void flushLogBuffer() {
    if (logBufferIndex == 0) return;  // Nothing to flush

    // Append to serialLogs with size limit
    if (serialLogs.length() + logBufferIndex > MAX_LOG_SIZE) {
        serialLogs = serialLogs.substring(serialLogs.length() - (MAX_LOG_SIZE - logBufferIndex));
    }
    serialLogs += String(logBuffer);

    // Reset buffer
    logBufferIndex = 0;
    lastLogFlush = millis();
}

// Optimized LED reading function
void readDeviceOutputs() {
    unsigned long currentMillis = millis();
    static String tempStatus;
    tempStatus.reserve(500);
    
    if (currentMillis - previousMillis >= LED_CHECK_DELAY) {
        tempStatus = "";
        bool significantChange = false;

        // Read LED states and check for changes
        for (int i = 0; i < numLEDs; i++) {
            bool prevRedState = redLEDStates[i].currentState;
            bool prevGreenState = greenLEDStates[i].currentState;
            
            redLEDStates[i].currentState = digitalRead(redLEDs[i]);
            greenLEDStates[i].currentState = digitalRead(greenLEDs[i]);

            if (redLEDStates[i].currentState != prevRedState || 
                greenLEDStates[i].currentState != prevGreenState) {
                significantChange = true;
            }

            if (redLEDStates[i].currentState != redLEDStates[i].lastState) {
                redLEDStates[i].changeCount++;
                redLEDStates[i].lastState = redLEDStates[i].currentState;
            }

            if (greenLEDStates[i].currentState != greenLEDStates[i].lastState) {
                greenLEDStates[i].changeCount++;
                greenLEDStates[i].lastState = greenLEDStates[i].currentState;
            }
        }

        // Only log if there's a significant change and enough time has passed
        if (significantChange && (currentMillis - lastLEDStatusLog >= LED_STATUS_LOG_INTERVAL)) {
            String debugMsg = "LED States - Red: ";
            for (int i = 0; i < numLEDs; i++) {
                int redState = (redLEDStates[i].changeCount >= 2) ? 2 : redLEDStates[i].currentState ? 1 : 0;
                debugMsg += String(redState) + " ";
            }
            debugMsg += "| Green: ";
            for (int i = 0; i < numLEDs; i++) {
                int greenState = (greenLEDStates[i].changeCount >= 2) ? 2 : greenLEDStates[i].currentState ? 1 : 0;
                debugMsg += String(greenState) + " ";
            }
            publishGeneralLog(debugMsg, "info");
            lastLEDStatusLog = currentMillis;
            
            // Reset change counters after logging
            for (int i = 0; i < numLEDs; i++) {
                redLEDStates[i].changeCount = 0;
                greenLEDStates[i].changeCount = 0;
            }
        }

        // Build status string for display
        for (int i = 0; i < numLEDs; i++) {
            tempStatus += "Red LED " + String(i) + ": ";
            if (redLEDStates[i].changeCount >= 2) {
                tempStatus += "FLASHING";
            } else {
                tempStatus += (redLEDStates[i].currentState ? "ON" : "OFF");
            }
            tempStatus += "\n";
            
            tempStatus += "Green LED " + String(i) + ": ";
            if (greenLEDStates[i].changeCount >= 2) {
                tempStatus += "FLASHING";
            } else {
                tempStatus += (greenLEDStates[i].currentState ? "ON" : "OFF");
            }
            tempStatus += "\n";
        }

        // Only process alarms if there were changes
        if (significantChange) {
            processLEDStatus(tempStatus, currentMillis);
        }

        previousMillis = currentMillis;
    }
}

// New function to process LED status
void processLEDStatus(const String& tempStatus, unsigned long currentMillis) {
    static String lastRedAlarms = "";
    static String lastAmberAlarms = "";
    static String lastGreenAlarms = "";
    static unsigned long lastAlertTime = 0;

    // Create LED state string
    String ledStateMsg = "LED States - [";
    // Add Red LEDs
    for (int i = 0; i < numLEDs; i++) {
        int redState = (redLEDStates[i].changeCount >= 2) ? 2 : redLEDStates[i].currentState ? 1 : 0;
        ledStateMsg += String(redState);
        if (i < numLEDs - 1) ledStateMsg += ",";
    }
    ledStateMsg += "] [";
    // Add Green LEDs
    for (int i = 0; i < numLEDs; i++) {
        int greenState = (greenLEDStates[i].changeCount >= 2) ? 2 : greenLEDStates[i].currentState ? 1 : 0;
        ledStateMsg += String(greenState);
        if (i < numLEDs - 1) ledStateMsg += ",";
    }
    ledStateMsg += "]";

    // === Declare shorthand LED state variables ===
    bool r0 = redLEDStates[0].lastState;
    bool r1 = redLEDStates[1].lastState;
    bool r2 = redLEDStates[2].lastState;
    bool r3 = redLEDStates[3].lastState;

    bool g0 = greenLEDStates[0].lastState;
    bool g1 = greenLEDStates[1].lastState;
    bool g2 = greenLEDStates[2].lastState;
    bool g3 = greenLEDStates[3].lastState;

    // === Detect Flashing Based on State Changes ===
    bool r0f = redLEDStates[0].changeCount >= 2;
    bool r1f = redLEDStates[1].changeCount >= 2;
    bool r2f = redLEDStates[2].changeCount >= 2;
    bool r3f = redLEDStates[3].changeCount >= 2;

    bool g0f = greenLEDStates[0].changeCount >= 2;
    bool g1f = greenLEDStates[1].changeCount >= 2;
    bool g2f = greenLEDStates[2].changeCount >= 2;
    bool g3f = greenLEDStates[3].changeCount >= 2;

    // === Amber Conditions Per LED ===
    bool a0 = r0 && g0;
    bool a1 = r1 && g1;
    bool a2 = r2 && g2;
    bool a3 = r3 && g3;

    bool a0f = (r0f && g0f) || (r0f && g0) || (r0 && g0f);
    bool a1f = (r1f && g1f) || (r1f && g1) || (r1 && g1f);
    bool a2f = (r2f && g2f) || (r2f && g2) || (r2 && g2f);
    bool a3f = (r3f && g3f) || (r3f && g3) || (r3 && g3f);

    String currentRedAlarms = "";
    String currentAmberAlarms = "";
    String currentGreenAlarms = "";

    // === Mutual Exclusion Logic ===
    bool anyGreenOn = false;
    bool anyRedFlashing = false;
    for (int i = 0; i < numLEDs; i++) {
        if (greenLEDStates[i].lastState) anyGreenOn = true;
        if (redLEDStates[i].changeCount >= 2) anyRedFlashing = true;
    }
    bool anyAmberFlashing = a0f || a1f || a2f || a3f;

    // Build consolidated status message
    String statusMsg = ledStateMsg;
    bool hasAlerts = false;

    // RED ALARMS - Only if NO green LED is ON and NO amber is flashing
    if (!anyGreenOn && !anyAmberFlashing) {
        String alertName = "";
        if (!r0 && !r1 && !r2 && !r3) {
            alertName = "R01"; // All RED LEDs are OFF
        } else if (r0 && r1 && r2 && r3) {
            alertName = "R02"; // E-Stop is OFF
            stopUpMovement();
            stopDownMovement();
        } else if (r0 && r1 && r2 && !r3) {
            alertName = "R15"; // OSG/Pit Switch
            stopUpMovement();
            stopDownMovement();
        } else if (r0 && r1 && !r2 && !r3) {
            alertName = "R23"; // Door Lock Failure
            stopUpMovement();
            stopDownMovement();
        } else if (!r0 && !r1 && r2 && r3) {
            alertName = "R22"; // Door Open
            stopUpMovement();
            stopDownMovement();
        }
        // Flashing LED conditions
        if (!r0f && !r1f && !r2f && !r3f) {
            alertName = "R00"; // No FLASHING RED LEDs
            stopUpMovement();
            stopDownMovement();
        } else if (!r0f && r1f && !r2f && !r3f) {
            alertName = "R31"; // Out of Service (flood switch)
            stopUpMovement();
            stopDownMovement();
        } else if (!r0f && r1f && r2f && r3f) {
            alertName = "R36"; // Out of Service – periodic maintenance
            stopUpMovement();
            stopDownMovement();
        } else if (r0f && !r1f && !r2f && !r3f) {
            alertName = "R37"; // Out of Service (travel time)
            stopUpMovement();
            stopDownMovement();
        } else if (!r0f && r1f && !r2f && r3f) {
            alertName = "R07"; // Drive Train, Belt Failure
            stopUpMovement();
            stopDownMovement();
        } else if (r0f && r1f && r2f && r3f) {
            alertName = "R03"; // Drive Nut Friction block fails
            stopUpMovement();
            stopDownMovement();
        } else if (r0f && !r1f && !r2f && r3f) {
            alertName = "R27"; // Drive Train Alignment
            stopUpMovement();
            stopDownMovement();
        } else if (r0f && r1f && r2f && !r3f) {
            alertName = "R10"; // Final Limit
            stopUpMovement();
            stopDownMovement();
            // Send email for R10 alarm
            if (alertName != lastRedEmailSent) {
                sendAlarmEmail("RED", "Final Limit (R10) - Lift has reached final limit switch");
                lastRedEmailSent = alertName;
            }
        } else if (!r0f && !r1f && r2f && !r3f) {
            alertName = "R11"; // Landing Switch (Top) failure
            stopUpMovement();
            stopDownMovement();
        } else if (!r0f && r1f && r2f && !r3f) {
            alertName = "R12"; // Landing Switch (Mid) failure
            stopUpMovement();
            stopDownMovement();
        } else if (r0f && !r1f && r2f && !r3f) {
            alertName = "R13"; // Landing Switch (Bottom) failure
            stopUpMovement();
            stopDownMovement();
        } else if (!r0f && !r1f && r2f && r3f) {
            alertName = "R24"; // Drive Train Motor Failure
            stopUpMovement();
            stopDownMovement();
        } else if (!r0f && !r1f && !r2f && r3f) {
            alertName = "R05"; // Motor temperature failure
            stopUpMovement();
            stopDownMovement();
        }
        if (alertName != "") {
            currentRedAlarms = alertName;
            statusMsg += " - " + alertName;
            hasAlerts = true;
            
            // Send email for any red alarm if it's different from the last one sent
            if (alertName != lastRedEmailSent) {
                String alarmDescription = "";
                if (alertName == "R01") alarmDescription = "All RED LEDs are OFF";
                else if (alertName == "R02") alarmDescription = "E-Stop is OFF";
                else if (alertName == "R15") alarmDescription = "OSG/Pit Switch activated";
                else if (alertName == "R23") alarmDescription = "Door Lock Failure";
                else if (alertName == "R22") alarmDescription = "Door Open";
                else if (alertName == "R00") alarmDescription = "No FLASHING RED LEDs";
                else if (alertName == "R31") alarmDescription = "Out of Service (flood switch)";
                else if (alertName == "R36") alarmDescription = "Out of Service – periodic maintenance";
                else if (alertName == "R37") alarmDescription = "Out of Service (travel time)";
                else if (alertName == "R07") alarmDescription = "Drive Train, Belt Failure";
                else if (alertName == "R03") alarmDescription = "Drive Nut Friction block fails";
                else if (alertName == "R27") alarmDescription = "Drive Train Alignment";
                else if (alertName == "R10") alarmDescription = "Final Limit";
                else if (alertName == "R11") alarmDescription = "Landing Switch (Top) failure";
                else if (alertName == "R12") alarmDescription = "Landing Switch (Mid) failure";
                else if (alertName == "R13") alarmDescription = "Landing Switch (Bottom) failure";
                else if (alertName == "R24") alarmDescription = "Drive Train Motor Failure";
                else if (alertName == "R05") alarmDescription = "Motor temperature failure";
                
                sendAlarmEmail("RED", alertName + " - " + alarmDescription);
                lastRedEmailSent = alertName;
            }
        }
    }

    // GREEN ALARMS - Only if NO red LED is flashing
    if (!anyRedFlashing) {
        String alertName = "";
        if (!g0 && !g1 && !g2 && !g3) {
            alertName = "G01"; // All GREEN LEDs are OFF
        } else if (g0 && g1 && g2 && g3) {
            alertName = "G00"; // No exceptions
        } else if (!g0f && !g1f && !g2f && !g3f) {
            alertName = "G02"; // No FLASHING GREEN LEDs
        } else if (g0f && g1f && g2f && !g3f) {
            alertName = "G03"; // On Battery Power
        } else if (g0f && g1f && g2f && g3f) {
            alertName = "G04"; // Bypass Jumpers/Service Switch
        }
        if (alertName != "") {
            currentGreenAlarms = alertName;
            statusMsg += (hasAlerts ? "/" : " - ") + alertName;
            hasAlerts = true;
        }
    }

    // AMBER ALARMS (no mutual exclusion)
    String alertName = "";
    if (!a0 && !a1 && !a2 && !a3) {
        alertName = "A01"; // ALL AMBER LEDs OFF
    } else if (a0 && a1 && a2 && !a3) {
        alertName = "A04"; // Power Failure
    } else if (!a0 && a1 && a2 && a3) {
        alertName = "A39"; // Power Failure
    } else if (a0 && !a1 && !a2 && !a3) {
        alertName = "A30"; // Service Required (Flood switch)
    } else if (!a0 && a1 && !a2 && !a3) {
        alertName = "A33"; // Service Required – travel time
    } else if (a0 && a1 && !a2 && !a3) {
        alertName = "A34"; // Service Required – maintenance
    } else if (!a0 && !a1 && a2 && !a3) {
        alertName = "A35"; // Service Required – hours
    } else if (!a0 && !a1 && a2 && a3) {
        alertName = "A36"; // Service Required – Battery
    } else if (a0 && !a1 && !a2 && a3) {
        alertName = "A37"; // Service Required - Inverter
    }
    // Flashing amber conditions
    if (!a0f && !a1f && !a2f && !a3f) {
        alertName = "A02"; // No FLASHING AMBER LEDs
    } else if (a0f && a1f && a2f && !a3f) {
        alertName = "A32"; // Power Failure - UP Locked
        stopUpMovement();
    } else if (!a0f && a1f && a2f && a3f) {
        alertName = "A40"; // Power Failure
    } else if (!a0f && !a1f && a2f && !a3f) {
        alertName = "A06"; // Motor Failure - UP Locked
        stopUpMovement();
    } else if (a0f && !a1f && !a2f && a3f) {
        alertName = "A08"; // Anti-Rock binding - UP Locked
        stopUpMovement();
    } else if (a0f && a1f && !a2f && !a3f) {
        alertName = "A14"; // Bottom Final Limit - DOWN Locked
        stopDownMovement();
    } else if (!a0f && a1f && !a2f && !a3f) {
        alertName = "A16"; // Flood waters - DOWN Locked
        stopDownMovement();
    } else if (!a0f && a1f && a2f && !a3f) {
        alertName = "A38"; // Motor Temperature monitoring lost
    }
    if (alertName != "") {
        currentAmberAlarms = alertName;
        statusMsg += (hasAlerts ? "/" : " - ") + alertName;
        hasAlerts = true;
    }

    // Only print the status message if there are alerts or LED states have changed
    if (hasAlerts || statusMsg != lastLedSnapshot) {
        Serial.println(statusMsg);
        lastLedSnapshot = statusMsg;
    }

    // Process alerts with state management
    if (shouldPublishAlert(redAlertState, currentRedAlarms, currentMillis)) {
        publishAlert("red", currentRedAlarms);
    }

    if (shouldPublishAlert(greenAlertState, currentGreenAlarms, currentMillis)) {
        publishAlert("green", currentGreenAlarms);
    }

    // Update global strings for web interface
    if (currentRedAlarms != "") redAlarms = currentRedAlarms;
    if (currentGreenAlarms != "") greenAlarms = currentGreenAlarms;
    amberAlarms = currentAmberAlarms;

    // Update LED history
    if (hasAlerts || statusMsg != lastLedSnapshot) {
        ledStatus = tempStatus;
        ledStatusHistory = statusMsg + "\n" + ledStatusHistory;
        
        // Trim history to prevent memory issues
        if (ledStatusHistory.length() > 3000) {
            ledStatusHistory = ledStatusHistory.substring(0, 3000);
        }
    }
}

void OnDataRecv(const esp_now_recv_info_t *info, const uint8_t *incomingData, int len) {
  // Print sender MAC address
  char macStr[18];
  snprintf(macStr, sizeof(macStr), "%02X:%02X:%02X:%02X:%02X:%02X",
           info->src_addr[0], info->src_addr[1], info->src_addr[2],
           info->src_addr[3], info->src_addr[4], info->src_addr[5]);
  Serial.print("ESP-NOW message from: ");
  Serial.println(macStr);

  // Copy and parse the message
  memcpy(&incomingDataStruct, incomingData, sizeof(incomingDataStruct));

  Serial.print("Type: ");
  Serial.println(incomingDataStruct.type);
  Serial.print("Payload: ");
  Serial.println(incomingDataStruct.payload);

  // If it's a command, trigger the appropriate action
  // Update this in your OnDataRecv function
if (strcmp(incomingDataStruct.type, "command") == 0) {
  String cmd = String(incomingDataStruct.payload);
  if (cmd == "UP") handleMovement("up");
  else if (cmd == "DOWN") handleMovement("down");
  else if (cmd == "STOP") stopMovement();
  else if (cmd == "BRAKE") applyBrake();
  else if (cmd == "RELEASE_BRAKE") releaseBrake();
  else if (cmd == "STOP_UP") stopUpMovement();
  else if (cmd == "STOP_DOWN") stopDownMovement();
}
}

// Check if user is authenticated via cookie
bool isAuthenticated() {
  if (server.hasHeader("Cookie")) {
    String cookie = server.header("Cookie");
    return cookie.indexOf("SESSIONID=") != -1;
  }
  return false;
}

// Remove the previous watchdog definitions and add proper configuration
#include <esp_task_wdt.h>

// Watchdog timer configuration
#define CONFIG_ESP_TASK_WDT_TIMEOUT_S 10
#define ARDUINO_RUNNING_CORE 1

TaskHandle_t arduinoTask = NULL;

// Add debounce variables at the top with other globals
unsigned long lastUpDebounceTime = 0;
unsigned long lastDownDebounceTime = 0;
bool lastUpButtonState = HIGH;
bool lastDownButtonState = HIGH;
bool upButtonState = HIGH;
bool downButtonState = HIGH;
const unsigned long DEBOUNCE_DELAY = 50;  // 50ms debounce time

// Add at the top with other globals
bool upButtonPressed = false;
bool downButtonPressed = false;

// Add at the top with other globals
const unsigned long BUTTON_COOLDOWN = 100; // 100ms minimum time between button actions
const int STABLE_READINGS = 3;  // Number of stable readings required

// Button state tracking
struct ButtonState {
    bool currentState;
    bool lastState;
    bool isPressed;
    unsigned long lastDebounceTime;
    unsigned long lastActionTime;
    int stableCount;
    bool waitingForStable;
};

ButtonState upButton = {HIGH, HIGH, false, 0, 0, 0, false};
ButtonState downButton = {HIGH, HIGH, false, 0, 0, 0, false};

void setup() {
  Serial.begin(115200);
  delay(1000); // Give serial time to initialize

  // Store the current task handle (not needed for watchdog)
  arduinoTask = xTaskGetCurrentTaskHandle();

  // Do NOT call esp_task_wdt_init() or esp_task_wdt_add() here, as the TWDT and loopTask are already handled by the Arduino core.
  // No manual registration needed.

  // Initialize SPIFFS
  if(!SPIFFS.begin(true)){
    Serial.println("An Error has occurred while mounting SPIFFS");
    return;
  }
  Serial.println("SPIFFS Initialized Successfully");

  // Check if required files exist
  if(!SPIFFS.exists("/index.html")) {
    Serial.println("Warning: index.html not found in SPIFFS");
    Serial.println("Please upload the file using ESP32 Sketch Data Upload tool");
  }

  // Rest of your existing setup code...
  // Initialize LED pins and states
  Serial.println("Initializing LED pins...");
  for (int i = 0; i < numLEDs; i++) {
    pinMode(redLEDs[i], INPUT);
    pinMode(greenLEDs[i], INPUT);
    // Initialize LED states
    redLEDStates[i].currentState = false;
    redLEDStates[i].lastState = false;
    redLEDStates[i].changeCount = 0;
    redLEDStates[i].lastChange = 0;
    
    greenLEDStates[i].currentState = false;
    greenLEDStates[i].lastState = false;
    greenLEDStates[i].changeCount = 0;
    greenLEDStates[i].lastChange = 0;
  }
  Serial.println("LED pins initialized");

  // Initialize GPIO with explicit states
  Serial.println("Initializing GPIO pins...");
  pinMode(UP_PIN, OUTPUT);
  digitalWrite(UP_PIN, LOW);
  pinMode(DOWN_PIN, OUTPUT);
  digitalWrite(DOWN_PIN, LOW);
  
  // Use INPUT_PULLUP for buttons with stronger pull-up
  pinMode(UP_BUTTON, INPUT_PULLUP);
  pinMode(DOWN_BUTTON, INPUT_PULLUP);
  
  // Add debouncing capacitors in hardware and/or software debounce
  pinMode(LIMIT_SWITCH_UP, INPUT_PULLUP);
  pinMode(LIMIT_SWITCH_DOWN, INPUT_PULLUP);
  pinMode(BRAKE_PIN, OUTPUT);
  digitalWrite(BRAKE_PIN, HIGH);
  
  // Initialize output pins
  pinMode(UP_OUTPUT_PIN, OUTPUT);
  pinMode(DOWN_OUTPUT_PIN, OUTPUT);
  digitalWrite(UP_OUTPUT_PIN, LOW);    // Start with outputs OFF
  digitalWrite(DOWN_OUTPUT_PIN, LOW);

  // Initialize always-HIGH output pins
  pinMode(ALWAYS_HIGH_PIN1, OUTPUT);
  pinMode(ALWAYS_HIGH_PIN2, OUTPUT);
  pinMode(ALWAYS_HIGH_PIN3, OUTPUT);
  digitalWrite(ALWAYS_HIGH_PIN1, HIGH);  // Set to always HIGH
  digitalWrite(ALWAYS_HIGH_PIN2, HIGH);  // Set to always HIGH
  digitalWrite(ALWAYS_HIGH_PIN3, HIGH);  // Set to always HIGH

  // Connect to WiFi with status check and timeout
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  int wifiAttempts = 0;
  const int MAX_WIFI_ATTEMPTS = 20;
  
  // Only print dots, not needed for final output
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < MAX_WIFI_ATTEMPTS) {
    delay(500);
    wifiAttempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected successfully!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    // Only print failure once
    Serial.println("Failed to connect to WiFi!");
    ESP.restart();
    return;
  }

  // Setup MQTT with SSL/TLS
  espClient.setCACert(root_ca);
  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setCallback(callback);
  mqttClient.setKeepAlive(60);
  mqttClient.setSocketTimeout(10);
  
  // Initial MQTT connection attempt
  reconnectMQTT();
  
  // Initialize NTP with local time cache
  Serial.println("Configuring time...");
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  // Ensure time is synced before TLS handshake
  struct tm timeinfo;
  int timeoutCounter = 0;
  while (!getLocalTime(&timeinfo) && timeoutCounter < 10) {
    Serial.println("Waiting for time to sync...");
    delay(1000);
    timeoutCounter++;
  }
  if (timeoutCounter >= 10) {
    Serial.println("Failed to sync time!");
  } else {
    Serial.println("Time synced successfully!");
  }
  
  Serial.println("=== Setup Complete ===\n");

  // Initialize web server routes
  server.on("/", HTTP_GET, []() {
    if (!isAuthenticated()) {
      server.send(401, "text/plain", "Unauthorized");
      return;
    }
    File file = SPIFFS.open("/index.html", "r");
    if (!file) {
      server.send(404, "text/plain", "File not found");
      return;
    }
    server.streamFile(file, "text/html");
    file.close();
  });

  server.on("/getStatus", HTTP_GET, []() {
    if (!isAuthenticated()) return;
    String response = "{";
    response += "\"mode\":\"" + String(elevatorMode ? "elevator" : "lift") + "\",";
    response += "\"delay\":\"" + String(elevatorMode ? ELEVATOR_MODE_DELAY : LIFT_MODE_DELAY) + "\",";
    response += "\"logs\":\"" + serialLogs + "\",";
    response += "\"ledStatus\":\"" + ledStatus + "\",";
    response += "\"ledStatusHistory\":\"" + ledStatusHistory + "\",";
    response += "\"greenAlarms\":\"" + greenAlarms + "\",";
    response += "\"amberAlarms\":\"" + amberAlarms + "\",";
    response += "\"redAlarms\":\"" + redAlarms + "\",";
    response += "\"emailEnabled\":" + String(emailNotificationsEnabled ? "true" : "false") + ",";
    response += "\"emails\":[";
    for (int i = 0; i < emailCount; i++) {
      if (i > 0) response += ",";
      response += "\"" + emailAddresses[i] + "\"";
    }
    response += "]}";
    server.send(200, "application/json", response);
  });

  server.on("/toggleEmail", HTTP_GET, []() {
    if (!isAuthenticated()) return;
    emailNotificationsEnabled = server.arg("enabled") == "true";
    server.send(200, "text/plain", "Email notifications " + String(emailNotificationsEnabled ? "enabled" : "disabled"));
  });

  server.on("/addEmail", HTTP_GET, []() {
    if (!isAuthenticated()) return;
    String email = server.arg("email");
    if (emailCount >= MAX_EMAILS) {
      server.send(400, "text/plain", "Maximum number of emails reached");
      return;
    }
    // Check for duplicates
    for (int i = 0; i < emailCount; i++) {
      if (emailAddresses[i] == email) {
        server.send(400, "text/plain", "Email already exists");
        return;
      }
    }
    emailAddresses[emailCount++] = email;
    server.send(200, "text/plain", "Email added successfully");
  });

  server.on("/removeEmail", HTTP_GET, []() {
    if (!isAuthenticated()) return;
    int index = server.arg("index").toInt();
    if (index < 0 || index >= emailCount) {
      server.send(400, "text/plain", "Invalid email index");
      return;
    }
    // Shift remaining emails
    for (int i = index; i < emailCount - 1; i++) {
      emailAddresses[i] = emailAddresses[i + 1];
    }
    emailCount--;
    server.send(200, "text/plain", "Email removed successfully");
  });

  // Start the server
  server.begin();
  Serial.println("HTTP server started");

  // Initialize alert system
  initializeAlertSystem();
}

void loop() {
    static unsigned long lastWiFiCheck = 0;
    static unsigned long lastMQTTCheck = 0;
    static unsigned long lastLoopDelay = 0;
    unsigned long currentMillis = millis();

    // Process button states
    processButton(upButton, UP_BUTTON, "UP", []() {
        if (!elevatorMode) {
            handleMovement("up");
        }
    }, []() {
        if (!elevatorMode) {
            stopMovement();
        }
    });

    processButton(downButton, DOWN_BUTTON, "DOWN", []() {
        if (!elevatorMode) {
            handleMovement("down");
        }
    }, []() {
        if (!elevatorMode) {
            stopMovement();
        }
    });

    // Rest of your existing loop code...
}

// Initialize alert system
void initializeAlertSystem() {
    redAlertState = {"", 0, 0, false, 0};
    amberAlertState = {"", 0, 0, false, 0};
    greenAlertState = {"", 0, 0, false, 0};
}

// Helper function to manage alert state changes
bool shouldPublishAlert(AlertState &state, String newMessage, unsigned long currentMillis) {
    // If message changed, reset stable count
    if (newMessage != state.message) {
        state.message = newMessage;
        state.lastChangeTime = currentMillis;
        state.stableCount = 0;
        return false;
    }
    
    // Check if state has been stable for debounce period
    if (currentMillis - state.lastChangeTime >= ALERT_DEBOUNCE_TIME) {
        state.stableCount++;
        
        // Only publish if state is stable and cooldown period has passed
        if (state.stableCount >= 2 && 
            currentMillis - state.lastPublishTime >= ALERT_COOLDOWN &&
            newMessage != "") {
            state.lastPublishTime = currentMillis;
            return true;
        }
    }
    
    return false;
}

// Add this function before loop()
bool processButton(ButtonState &button, int pin, const char* name, void (*pressCallback)(), void (*releaseCallback)()) {
    bool changed = false;
    unsigned long currentMillis = millis();
    int reading = digitalRead(pin);
    
    // Debug state changes
    static int lastReading = HIGH;
    if (reading != lastReading) {
        Serial.printf("[DEBUG] %s raw reading changed: %s\n", name, reading == LOW ? "PRESSED" : "RELEASED");
        lastReading = reading;
    }
    
    // If the reading has changed, reset the debounce timer and stable count
    if (reading != button.currentState) {
        button.lastDebounceTime = currentMillis;
        button.stableCount = 0;
        button.waitingForStable = true;
    }
    
    // Check if enough time has passed since the last state change
    if ((currentMillis - button.lastDebounceTime) > DEBOUNCE_DELAY) {
        // If we're waiting for a stable reading
        if (button.waitingForStable) {
            if (reading == button.currentState) {
                button.stableCount++;
                if (button.stableCount >= STABLE_READINGS) {
                    // We have a stable reading
                    button.waitingForStable = false;
                    if (reading != button.lastState) {
                        button.lastState = reading;
                        changed = true;
                        
                        // If button is pressed (LOW) and wasn't pressed before
                        if (reading == LOW && !button.isPressed) {
                            if ((currentMillis - button.lastActionTime) > BUTTON_COOLDOWN) {
                                button.isPressed = true;
                                button.lastActionTime = currentMillis;
                                if (pressCallback) {
                                    Serial.printf("[DEBUG] %s press action triggered\n", name);
                                    pressCallback();
                                }
                            } else {
                                Serial.printf("[DEBUG] %s press ignored - too soon after last action\n", name);
                            }
                        }
                        // If button is released (HIGH) and was pressed before
                        else if (reading == HIGH && button.isPressed) {
                            button.isPressed = false;
                            if (releaseCallback) {
                                Serial.printf("[DEBUG] %s release action triggered\n", name);
                                releaseCallback();
                            }
                        }
                    }
                }
            } else {
                // Reading changed during stabilization, reset count
                button.stableCount = 0;
            }
        }
    }
    
    button.currentState = reading;
    return changed;
}  