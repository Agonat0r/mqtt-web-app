#include <WiFi.h>
#include <esp_now.h>
#include <time.h>
#include <sys/time.h>
#include "FS.h"
#include "SPIFFS.h"
#include <ESP_Mail_Client.h>
#include <PubSubClient.h>  // Add MQTT client library
#include <WebServer.h>  // Add WebServer library
#include <WiFiClientSecure.h>  // Add WiFiClientSecure for SSL/TLS
#include <ArduinoJson.h>  // Add ArduinoJson library for JSON parsing
#include <esp_task_wdt.h>


// ===== Login Configuration ===== //
const char* www_username = "admin";    
const char* www_password = "admin";


// ===== WiFi and MQTT Configuration ===== //
const char* ssid = "Avalon Heights-Resident"; // Flugel Hub Unit 221
const char* password = "FlyerNitrogenInvest"; // dogecoin ZWCFWFFN
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


WebServer server(80); // Initialized server on port 80


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
unsigned long LIFT_MODE_DELAY = 200; // Set default delay for Lift Mode
unsigned long ELEVATOR_MODE_DELAY = 200; // Set default delay for Elevator Mode


// Pin Definitions
#define UP_BUTTON 18 // 18
#define DOWN_BUTTON 19 // 19
#define UP_PIN 7 // 5
#define DOWN_PIN 13 // 4
#define LIMIT_SWITCH_UP 21 // 21
#define LIMIT_SWITCH_DOWN 22 // 22
#define BRAKE_PIN 14
#define UP_OUTPUT_PIN 15    // Using pin 15 for UP output
#define DOWN_OUTPUT_PIN 16  // Using pin 16 for DOWN output
#define ALWAYS_HIGH_PIN1 17 // Pin that will always be HIGH
#define ALWAYS_HIGH_PIN2 20 // Pin that will always be HIGH
#define ALWAYS_HIGH_PIN3 23 // Pin that will always be HIGH
// Email Configuration
#define MAX_EMAILS 10
String emailAddresses[MAX_EMAILS];
int emailCount = 0;
bool emailNotificationsEnabled = true;
unsigned long lastEmailSent = 0;
const unsigned long EMAIL_COOLDOWN = 300000; // 5 minutes between emails


// SMTP Server Settings
#define SMTP_HOST "smtp.gmail.com"
#define SMTP_PORT 465
#define AUTHOR_EMAIL "vplcapstone@gmail.com"  // Your Gmail address
#define AUTHOR_PASSWORD "awnq yzfr opbi ffaj"  // Your Gmail app password (not regular password)


// Global objects for email
SMTPSession smtp;
SMTP_Message message;


// Define Red and Green LED Input Pins
const int redLEDs[] = {4, 8, 35, 2}; // Array of pin numbers for Red LEDs
const int greenLEDs[] = {5, 3, 36, 1}; // Array of pin numbers for Green LEDs
const int numLEDs = 4; // Total LEDs per color


// Timing variables for LED reading
unsigned long previousMillis = 0; // // Variable to store the last time LED status was updated
const unsigned long checkInterval = 1500; // Adjusted to capture ~2 full LED cycles
unsigned long LED_CHECK_DELAY = 300; // Default delay for LEDs serial monitoring
static unsigned long lastRedLED0Print = 0;
const unsigned long redLED0Interval = 10000;  // 10 seconds = 10,000 ms


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
  String dir = String(direction);
 
  // Add prominent Serial output for lift commands
  Serial.println("\n=== LIFT COMMAND RECEIVED ===");
  Serial.print("Direction: ");
  Serial.println(dir);  // Print direction as is, Arduino String class handles uppercase automatically
  Serial.println("===========================\n");
 
  if (dir == "up") {
    if (digitalRead(LIMIT_SWITCH_UP) == LOW) {
      addToLog("Cannot move up: Upper limit switch activated");
      Serial.println("BLOCKED: Upper limit switch activated");
      return;
    }
    digitalWrite(DOWN_PIN, LOW);
    digitalWrite(UP_PIN, HIGH);
    currentDirection = "up";
    addToLog("Moving up");
    publishCommandLog("Command executed: UP");
    publishGeneralLog("Moving up", "info");
  } else if (dir == "down") {
    if (digitalRead(LIMIT_SWITCH_DOWN) == LOW) {
      addToLog("Cannot move down: Lower limit switch activated");
      Serial.println("BLOCKED: Lower limit switch activated");
      return;
    }
    digitalWrite(UP_PIN, LOW);
    digitalWrite(DOWN_PIN, HIGH);
    currentDirection = "down";
    addToLog("Moving down");
    publishCommandLog("Command executed: DOWN");
    publishGeneralLog("Moving down", "info");
  }
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


// MQTT callback function
void callback(char* topic, byte* payload, unsigned int length) {
    // Create a null-terminated string from payload
    char message[length + 1];
    memcpy(message, payload, length);
    message[length] = '\0';


    // Parse JSON message
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, message);
    if (error) {
        return;
    }


    // Extract message components
    const char* type = doc["type"];
    const char* msg = doc["message"];
    const char* timestamp = doc["timestamp"];


    // Only print for command messages with UP, DOWN, or STOP
    if (type && strcmp(type, "command") == 0 && msg && timestamp) {
        if (strcmp(msg, "COMMAND:UP") == 0 || strcmp(msg, "COMMAND:DOWN") == 0 || strcmp(msg, "COMMAND:STOP") == 0) {
            // Print as a single compressed line
            Serial.print("[COMMAND] ");
            if (strcmp(msg, "COMMAND:UP") == 0) Serial.print("UP");
            else if (strcmp(msg, "COMMAND:DOWN") == 0) Serial.print("DOWN");
            else if (strcmp(msg, "COMMAND:STOP") == 0) Serial.print("STOP");
            Serial.print(" at ");
            Serial.println(timestamp);


            // Command Output Pin Control
            if (strcmp(msg, "COMMAND:UP") == 0) {
                digitalWrite(UP_OUTPUT_PIN, HIGH);
                digitalWrite(DOWN_OUTPUT_PIN, LOW);
            } else if (strcmp(msg, "COMMAND:DOWN") == 0) {
                digitalWrite(UP_OUTPUT_PIN, LOW);
                digitalWrite(DOWN_OUTPUT_PIN, HIGH);
            } else if (strcmp(msg, "COMMAND:STOP") == 0) {
                digitalWrite(UP_OUTPUT_PIN, LOW);
                digitalWrite(DOWN_OUTPUT_PIN, LOW);
            }
        }
    }
}


// Function to reconnect to MQTT broker
void reconnectMQTT() {
    if (WiFi.status() != WL_CONNECTED) {
        // Do not print anything here
        return;
    }
    int attempts = 0;
    const int MAX_ATTEMPTS = 3;
    while (!mqttClient.connected() && attempts < MAX_ATTEMPTS) {
        // Do not print anything here
        String clientId = "ESP32Client-" + String(random(0xffff), HEX);
        if (mqttClient.connect(clientId.c_str(), mqtt_username, mqtt_password)) {
            Serial.println("Connected to MQTT broker");
            mqttClient.subscribe(commandLogTopic);
            mqttClient.subscribe(generalLogTopic);
            mqttClient.subscribe(alertLogTopic);
            String connectMsg = "{\"type\":\"info\",\"message\":\"Device connected\",\"timestamp\":\"" + getTimestamp() + "\"}";
            mqttClient.publish(mqttTopic, connectMsg.c_str());
            return;
        }
        attempts++;
        if (attempts < MAX_ATTEMPTS) {
            delay(5000);
        }
    }
    // Only print failure once if all attempts fail
    if (!mqttClient.connected()) {
        Serial.println("Failed to connect to MQTT after maximum attempts");
    }
}


// Replace the old sendAlarmEmail function with this MQTT-based version
void sendAlarmEmail(const String& type, const String& message) {
    if (!mqttClient.connected()) {
        Serial.println("MQTT not connected, can't send email alert");
        return;
    }

    // Create JSON document for the email alert
    StaticJsonDocument<128> doc;
    doc["type"] = "email_alert";
    doc["alertType"] = type;
    doc["message"] = message;
    doc["timestamp"] = getTimestamp();

    char buffer[128];
    serializeJson(doc, buffer);

    // Publish to a topic that the web interface is listening to
    mqttClient.publish("usf/alerts/email", buffer);
    Serial.println("Email alert message published to MQTT");
}


// ===== HTML Content ===== //
const char htmlContent[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <title>VPL Control</title>
  <style>
    body { font-family: Arial; margin: 20px; }
    button { font-size: 20px; padding: 10px; margin: 5px; }
    .mode { font-size: 18px; margin: 15px 0; }
    .delay-control { margin: 15px 0; }
    #serialMonitor, #ledStatus {
      border: 1px solid #ccc;
      padding: 10px;
      height: 200px;
      overflow-y: scroll;
      background: #f8f8f8;
      white-space: pre-wrap;
      font-family: monospace;
    }




    /* === Tabs === */
    .tab {
      overflow: hidden;
      border-bottom: 1px solid #ccc;
      margin-top: 20px;
    }
    .tab button {
      background-color: #f1f1f1;
      float: left;
      border: none;
      outline: none;
      cursor: pointer;
      padding: 10px 16px;
      transition: 0.3s;
      font-size: 16px;
    }
    .tab button:hover { background-color: #ddd; }
    .tab button.active { background-color: #ccc; }
    .tabcontent {
      display: none;
      padding: 10px;
      border: 1px solid #ccc;
      border-top: none;
      background: #fff;
    }
  </style>
</head>
<body>
  <h2>Vertical Platform Lift Control</h2>




  <div id="modeSelection">
    <h3>Select Mode:</h3>
    <button onclick="setMode('elevator')">Elevator Mode</button>
    <button onclick="setMode('lift')">Lift Mode</button>
    <button onclick="applyBrake()">APPLY BRAKE</button>
    <button onclick="releaseBrake()">RELEASE BRAKE</button>
  </div>




  <div id="mainUI" style="display:none">
    <p class="mode">Current Mode: <b><span id="modeText"></span></b></p>
   
    <!-- Delay Control -->
    <div class="delay-control">
      <label>Response Time (ms): </label>
      <input type="number" id="delayInput" min="50" max="1000" value="200">
      <button onclick="setDelay()">Apply</button>
      <span id="currentDelay"></span>
    </div>




    <!-- LED Check Delay Control -->
  <div class="led-delay-control">
  <label>LED Check Delay (ms): </label>
  <input type="number" id="ledDelayInput" min="10" max="1000" value="300">
  <button onclick="setLEDDelay()">Apply</button>
</div>
   
    <button onclick="showModeSelection()">Change Mode</button><br><br>
   
    <!-- Control Buttons -->
    <button onmousedown="startAction('up')" onmouseup="stopAction()">UP</button>
    <button onmousedown="startAction('down')" onmouseup="stopAction()">DOWN</button>




    <!-- Serial Monitor -->
    <h3>System Monitor</h3>
    <div id="serialMonitor">Connecting...</div>




    <!-- LED Status Monitor -->
    <h3>LED Monitor</h3>
    <div id="ledStatus">Loading LED status...</div>


    <!-- LED Status Download -->
    <a href="/downloadLogs" target="_blank"><button>Download Full Log</button></a>


    <button onclick="clearLogs()">Clear Logs</button>
  </div>




  <!-- === Alarm Tabs === -->
  <h3>Alarm Warnings</h3>
  <div class="tab">
    <button class="tablinks" onclick="openTab(event, 'Green')" id="defaultOpen">Green Alarms</button>
    <button class="tablinks" onclick="openTab(event, 'Amber')">Amber Alarms</button>
    <button class="tablinks" onclick="openTab(event, 'Red')">Red Alarms</button>
    <button class="tablinks" onclick="openTab(event, 'LEDHistory')">LED Status Logs</button>
    <button class="tablinks" onclick="openTab(event, 'EmailSettings')">Email Settings</button>
 
  </div>




  <div id="Green" class="tabcontent">
    <h4>Green Alarm Messages</h4>
    <div id="greenAlarms">No green alarms.</div>
  </div>




  <div id="Amber" class="tabcontent">
    <h4>Amber Alarm Messages</h4>
    <div id="amberAlarms">No amber alarms.</div>
  </div>




  <div id="Red" class="tabcontent">
    <h4>Red Alarm Messages</h4>
    <div id="redAlarms">No red alarms.</div>
  </div>


<div id="LEDHistory" class="tabcontent">
  <h4>LED Status History</h4>
  <div id="ledStatusHistory" style="white-space: pre-wrap; font-family: monospace;">Loading history...</div>
</div>




<div id="EmailSettings" class="tabcontent">
  <h4>Email Notification Settings</h4>
  <div>
    <label>
      <input type="checkbox" id="emailEnabled" onchange="toggleEmailNotifications()">
      Enable Email Notifications
    </label>
  </div>
  <div style="margin-top: 15px;">
    <input type="email" id="newEmail" placeholder="Enter email address">
    <button onclick="addEmail()">Add Email</button>
  </div>
  <div style="margin-top: 10px;">
    <h5>Email Recipients:</h5>
    <ul id="emailList"></ul>
  </div>
</div>


  <script>
    function startAction(dir) {
      fetch('/' + dir + '_start').catch(e => console.error(e));
    }




    function stopAction() {
      fetch('/stop').catch(e => console.error(e));
    }




    function setMode(mode) {
      fetch('/setMode?mode=' + mode)
        .then(r => r.text())
        .then(mode => {
          document.getElementById('modeSelection').style.display = 'none';
          document.getElementById('mainUI').style.display = 'block';
          document.getElementById('modeText').innerText = mode;
          updateUI();
        });
    }




    function showModeSelection() {
      document.getElementById('mainUI').style.display = 'none';
      document.getElementById('modeSelection').style.display = 'block';
    }




    function setDelay() {
      const delay = document.getElementById('delayInput').value;
      fetch('/setDelay?value=' + delay)
        .then(r => r.text())
        .then(updateUI);
    }




// Function for setting LED delay
    function setLEDDelay() {
  const delay = document.getElementById('ledDelayInput').value;
  fetch('/setLEDDelay?value=' + delay)
    .then(r => r.text())
    .then(msg => alert(msg));
}




function applyBrake() {
  fetch('/apply_brake').catch(e => console.error(e));
}


function releaseBrake() {
  fetch('/release_brake').catch(e => console.error(e));
}
    function clearLogs() {
      fetch('/clearLogs').then(updateUI);
    }




    function updateUI() {
      fetch('/getStatus')
        .then(r => r.json())
        .then(data => {
          document.getElementById('modeText').innerText = data.mode;
          document.getElementById('delayInput').value = data.delay;
          document.getElementById('currentDelay').innerText = 'Current: ' + data.delay + 'ms';
          document.getElementById('serialMonitor').innerText = data.logs.replace(/\\n/g, '\n');
          document.getElementById('ledStatus').innerText = data.ledStatus.replace(/\\n/g, '\n');
          document.getElementById('ledStatusHistory').innerText = data.ledStatusHistory.replace(/\\n/g, '\n');






          // Alarm tab updates
          document.getElementById('greenAlarms').innerText = data.greenAlarms || "No green alarms.";
          document.getElementById('amberAlarms').innerText = data.amberAlarms || "No amber alarms.";
          document.getElementById('redAlarms').innerText = data.redAlarms || "No red alarms.";
       
        // Add this inside the updateUI() function where it processes the data from getStatus
document.getElementById('emailEnabled').checked = data.emailEnabled;
const emailList = document.getElementById('emailList');
emailList.innerHTML = '';
if (data.emails && data.emails.length > 0) {
  data.emails.forEach((email, index) => {
    const li = document.createElement('li');
    li.textContent = email + ' ';
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => removeEmail(index);
    li.appendChild(removeBtn);
    emailList.appendChild(li);
  });
} else {
  emailList.innerHTML = '<li>No emails added yet</li>';
}
});
    }




    function openTab(evt, tabName) {
      var i, tabcontent, tablinks;
      tabcontent = document.getElementsByClassName("tabcontent");
      for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
      }
      tablinks = document.getElementsByClassName("tablinks");
      for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
      }
      document.getElementById(tabName).style.display = "block";
      evt.currentTarget.className += " active";
    }




    window.onload = () => {
      document.getElementById("defaultOpen").click();
      updateUI();
      setInterval(updateUI, 1000);
    }


    function toggleEmailNotifications() {
  const enabled = document.getElementById('emailEnabled').checked;
  fetch('/toggleEmail?enabled=' + enabled)
    .then(r => r.text())
    .then(msg => alert(msg));
}


function addEmail() {
  const email = document.getElementById('newEmail').value;
  if (!email || !validateEmail(email)) {
    alert('Please enter a valid email address');
    return;
  }
 
  fetch('/addEmail?email=' + encodeURIComponent(email))
    .then(r => r.text())
    .then(msg => {
      alert(msg);
      updateUI();
      document.getElementById('newEmail').value = '';
    });
}


function removeEmail(index) {
  fetch('/removeEmail?index=' + index)
    .then(r => r.text())
    .then(msg => {
      alert(msg);
      updateUI();
    });
}


function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}
  </script>
</body>
</html>
)rawliteral";




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
const unsigned long DEBUG_LOG_INTERVAL = 2000;  // Reduced from 5000ms to 2000ms
const unsigned long LED_STATUS_LOG_INTERVAL = 5000;  // Reduced from 10000ms to 5000ms
const unsigned long ALERT_COOLDOWN = 1000; // Reduced from 5000ms to 1000ms
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


// New function to process LED status
void processLEDStatus(const String& tempStatus, unsigned long currentMillis) {
    // Create JSON document for LED status
    StaticJsonDocument<200> doc;
    JsonObject ledStatus = doc.createNestedObject("led_status");

    // Add LED states to JSON
    for (int i = 0; i < numLEDs; i++) {
        ledStatus[String("red") + String(i)] = redLEDStates[i].lastState;
        ledStatus[String("green") + String(i)] = greenLEDStates[i].lastState;
    }

    // Convert to string and publish
    String payload;
    serializeJson(doc, payload);
    mqttClient.publish(statusTopic, payload.c_str());

    // Update LED history
    struct tm timeinfo;
    if (getLocalTime(&timeinfo)) {
        strftime(timeBuffer, TIME_BUFFER_SIZE, "[%Y-%m-%d %H:%M:%S] ", &timeinfo);
    } else {
        strcpy(timeBuffer, "[time error] ");
    }

    // Update LED status display string
    String ledStateOnly;
    for (int i = 0; i < numLEDs; i++) {
        ledStateOnly += "Red LED " + String(i) + ": " + 
            (redLEDStates[i].lastState ? "ON" : "OFF") + "\n";
        ledStateOnly += "Green LED " + String(i) + ": " + 
            (greenLEDStates[i].lastState ? "ON" : "OFF") + "\n";
    }

    // Update LED history if changed
    if (ledStateOnly != lastLedSnapshot) {
        lastLedSnapshot = ledStateOnly;
        String fullEntry = String(timeBuffer) + tempStatus + "\n";
        ledStatus = tempStatus;

        String newHistory = fullEntry;
        if (ledStatusHistory.length() > 0) {
            newHistory += ledStatusHistory.substring(0, 3000);
        }
        ledStatusHistory = newHistory;

        // Save to SPIFFS if buffer is full
        static String spiffsBuffer;
        spiffsBuffer += fullEntry;
        if (spiffsBuffer.length() >= 1024) {
            File file = SPIFFS.open("/led_log.txt", FILE_APPEND);
            if (file) {
                file.print(spiffsBuffer);
                file.close();
                spiffsBuffer = "";
            }
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


bool isAuthenticated() {
  if (!server.authenticate(www_username, www_password)) {
    server.requestAuthentication();
    return false;
  }
  return true;
}


// Remove the previous watchdog definitions and add proper configuration
#include <esp_task_wdt.h>


// Watchdog timer configuration
#define CONFIG_ESP_TASK_WDT_TIMEOUT_S 10
#define ARDUINO_RUNNING_CORE 1


TaskHandle_t arduinoTask = NULL;


void setup() {
  Serial.begin(115200);
  delay(1000); // Give serial time to initialize


  // Store the current task handle (not needed for watchdog)
  arduinoTask = xTaskGetCurrentTaskHandle();


  // Do NOT call esp_task_wdt_init() or esp_task_wdt_add() here, as the TWDT and loopTask are already handled by the Arduino core.
  // No manual registration needed.


  // Rest of your existing setup code...
  if(!SPIFFS.begin(true)){
    Serial.println("An Error has occurred while mounting SPIFFS");
    return;
  }
  Serial.println("SPIFFS Initialized Successfully");


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
  pinMode(UP_BUTTON, INPUT_PULLUP);
  pinMode(DOWN_BUTTON, INPUT_PULLUP);
  pinMode(LIMIT_SWITCH_UP, INPUT_PULLUP);
  pinMode(LIMIT_SWITCH_DOWN, INPUT_PULLUP);
  pinMode(BRAKE_PIN, OUTPUT);
  digitalWrite(BRAKE_PIN, HIGH);
  Serial.println("GPIO pins initialized");


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
}


void loop() {
    static unsigned long lastWiFiCheck = 0;
    static unsigned long lastMQTTCheck = 0;
    static unsigned long lastWDTReset = 0;
    const unsigned long CHECK_INTERVAL = 5000;
    const unsigned long WDT_RESET_INTERVAL = 1000;
    unsigned long currentMillis = millis();


    // No need to manually reset the watchdog unless you have a long-running operation
    // If you add a long-running section, call esp_task_wdt_reset() there


    if (currentMillis - lastWiFiCheck >= CHECK_INTERVAL) {
        if (WiFi.status() != WL_CONNECTED) {
            WiFi.disconnect();
            WiFi.begin(ssid, password);
        }
        lastWiFiCheck = currentMillis;
    }
    if (currentMillis - lastMQTTCheck >= CHECK_INTERVAL) {
        if (!mqttClient.connected()) {
            reconnectMQTT();
        }
        lastMQTTCheck = currentMillis;
    }
    if (mqttClient.connected()) {
        mqttClient.loop();
    }
    readDeviceOutputs();
    static unsigned long lastButtonTime = 0;
    unsigned long currentDelay = elevatorMode ? ELEVATOR_MODE_DELAY : LIFT_MODE_DELAY;
    if (currentMillis - lastButtonTime >= currentDelay) {
        if (digitalRead(UP_BUTTON) == LOW) {
            handleMovement("up");
            lastButtonTime = currentMillis;
        } else if (digitalRead(DOWN_BUTTON) == LOW) {
            handleMovement("down");
            lastButtonTime = currentMillis;
        }
    }
    if (elevatorMode) {
        if (digitalRead(UP_PIN) && digitalRead(LIMIT_SWITCH_UP)) stopMovement();
        if (digitalRead(DOWN_PIN) && digitalRead(LIMIT_SWITCH_DOWN)) stopMovement();
        static bool lastUpLimit = false;
        static bool lastDownLimit = false;
        bool currentUpLimit = digitalRead(LIMIT_SWITCH_UP) == LOW;
        bool currentDownLimit = digitalRead(LIMIT_SWITCH_DOWN) == LOW;
        if (currentDirection == "up" && currentUpLimit && !lastUpLimit) {
            stopMovement();
        }
        if (currentDirection == "down" && currentDownLimit && !lastDownLimit) {
            stopMovement();
        }
        lastUpLimit = currentUpLimit;
        lastDownLimit = currentDownLimit;
    }
    delay(10); // This is short and will not trigger the watchdog
}


void saveEmailsToSPIFFS() {
  File file = SPIFFS.open("/emails.txt", FILE_WRITE);
  if (!file) {
    Serial.println("Failed to open emails file for writing");
    return;
  }
 
  for (int i = 0; i < emailCount; i++) {
    file.println(emailAddresses[i]);
  }
  file.close();
}


void loadEmailsFromSPIFFS() {
  File file = SPIFFS.open("/emails.txt", FILE_READ);
  if (!file) {
    Serial.println("No saved emails found");
    return;
  }
 
  emailCount = 0;
  while (file.available() && emailCount < MAX_EMAILS) {
    String email = file.readStringUntil('\n');
    email.trim();
    if (email.length() > 0) {
      emailAddresses[emailCount++] = email;
    }
  }
  file.close();
}


// Call this function when modifying emails
void updateEmails() {
  saveEmailsToSPIFFS();
}


// Add cleanup function for watchdog
void cleanup() {
    if (arduinoTask != NULL) {
        esp_task_wdt_delete(arduinoTask);
    }
}  

