#include <WiFi.h>
#include <WebServer.h>
#include <esp_now.h>
#include <time.h>
#include <sys/time.h>
#include "FS.h"
#include "SPIFFS.h"
#include <ESP_Mail_Client.h>
// ===== Login Configuration ===== //
const char* www_username = "Carlos";     
const char* www_password = "Pena";

// ===== WiFi Configuration ===== //
const char* ssid = "Flugel"; // Define network Name
const char* password = "dogecoin"; // Define network Password

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


bool sendAlarmEmail(String alarmType, String alarmMessage) {
  if (!emailNotificationsEnabled || emailCount == 0 || millis() - lastEmailSent < EMAIL_COOLDOWN) {
    return false;
  }
  
  smtp.debug(1);  // Enable debug messages
  
  // Set the email session config
  ESP_Mail_Session session;
  session.server.host_name = SMTP_HOST;
  session.server.port = SMTP_PORT;
  session.login.email = AUTHOR_EMAIL;
  session.login.password = AUTHOR_PASSWORD;
  session.login.user_domain = "";

  // Connect to server with session config
  if (!smtp.connect(&session)) {
    addToLog("Failed to connect to SMTP server");
    return false;
  }

  // Set the message headers
  message.sender.name = "VPL Monitoring System";
  message.sender.email = AUTHOR_EMAIL;
  message.subject = "VPL ALERT: " + alarmType + " Alarm Detected";
  message.addRecipient("User", emailAddresses[0]);  // Send to first email

  // Create email content
  String emailContent = "VPL Monitoring System has detected the following alarm:\n\n";
  emailContent += "Alarm Type: " + alarmType + "\n";
  emailContent += "Alarm Message: " + alarmMessage + "\n\n";
  emailContent += "Timestamp: " + getTimestamp() + "\n";
  emailContent += "Please check the system as soon as possible.";
  
  message.text.content = emailContent.c_str();
  message.text.charSet = "us-ascii";
  message.text.transfer_encoding = Content_Transfer_Encoding::enc_7bit;
  
  // Send the message
  if (!MailClient.sendMail(&smtp, &message)) {
    addToLog("Error sending email: " + String(smtp.errorReason()));
    return false;
  }
  
  addToLog("Email alert sent: " + alarmType);
  lastEmailSent = millis();
  return true;
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


void addToLog(const String &message) {
  struct tm timeinfo;
  char timeString[30];

  if (getLocalTime(&timeinfo)) {
    strftime(timeString, sizeof(timeString), "[%Y-%m-%d %H:%M:%S] ", &timeinfo);
  } else {
    strcpy(timeString, "[time error] ");
  }

  String fullMessage = String(timeString) + message + "\n";
  serialLogs += fullMessage;
 
  // Limit log size
  if (serialLogs.length() > 2000) { // Limit Log size to 2000 characters
    serialLogs = serialLogs.substring(serialLogs.length() - 1500); // Print logs to serial monitor
  }
 
  // Also send to Serial
  Serial.println(message);
}

String getTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "1970-01-01 00:00:00";
  char buf[25];
  strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(buf);
}

void logLedChangeToSPIFFS(const String& entry) {
  File file = SPIFFS.open("/led_log.txt", FILE_APPEND);
  if (!file) {
    Serial.println("Failed to open log file for appending");
    return;
  }
  file.println(entry);
  file.close();
}

void pruneOldLogsSPIFFS() {
  File file = SPIFFS.open("/led_log.txt", FILE_READ);
  if (!file) return;

  String nowStr = getTimestamp();  // "YYYY-MM-DD HH:MM:SS"
  struct tm now;
  strptime(nowStr.c_str(), "%Y-%m-%d %H:%M:%S", &now);
  time_t nowEpoch = mktime(&now);

  String updatedContent = "";

  while (file.available()) {
    String line = file.readStringUntil('\n');
    if (line.length() < 20) continue;

    String ts = line.substring(1, 20);  // from "[YYYY-MM-DD HH:MM:SS]"
    struct tm t;
    if (strptime(ts.c_str(), "%Y-%m-%d %H:%M:%S", &t)) {
      time_t entryEpoch = mktime(&t);
      double daysDiff = difftime(nowEpoch, entryEpoch) / (60 * 60 * 24);
      if (daysDiff <= 30) {
        updatedContent += line + "\n";
      }
    }
  }
  file.close();

  File writeFile = SPIFFS.open("/led_log.txt", FILE_WRITE);
  writeFile.print(updatedContent);
  writeFile.close();
}


String escapeForJson(const String &input) { // Create an escape for " and \ and \n so it will not caused JSON an error
  String output;
  output.reserve(input.length() * 1.1); // Reserve slightly more space
 
  for (size_t i = 0; i < input.length(); i++) {
    char c = input.charAt(i);
    switch (c) {
      case '"': output += "\\\""; break;
      case '\\': output += "\\\\"; break;
      case '\n': output += "\\n"; break;
      case '\r': output += "\\r"; break;
      case '\t': output += "\\t"; break;
      default: output += c;
    }
  }
 
  return output;
}


// Turn off both UP_Pin and Down_Pin to prevent any movement
// Replace your current stopMovement() function with these more specific functions
void stopUpMovement() {
  digitalWrite(UP_PIN, LOW);
  if (currentDirection == "up") {
    currentDirection = "none";
    addToLog("Upward movement stopped");
  }
}

void stopDownMovement() {
  digitalWrite(DOWN_PIN, LOW);
  if (currentDirection == "down") {
    currentDirection = "none";
    addToLog("Downward movement stopped");
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


void stopMovement() {
  stopUpMovement();
  stopDownMovement();
  applyBrake();
  currentDirection = "none";
  addToLog("Movement stopped and brake applied");
}


// Prevent Rapid activation by using a delay, Stops ongoing motion before moving to new direction, and log movement in serial log
// Update your handleMovement function
void handleMovement(String direction) {
  unsigned long currentDelay = elevatorMode ? ELEVATOR_MODE_DELAY : LIFT_MODE_DELAY;
 
  if (millis() - lastActionTime < currentDelay) return;
 
  // Stop any current movement and release brake
  stopMovement();
  delay(50); // Brief delay to ensure brake is applied before releasing
  releaseBrake();
  delay(50); // Brief delay after releasing brake before moving
 
  if (direction == "up") {
    digitalWrite(UP_PIN, HIGH);
    currentDirection = "up";
    addToLog("Moving UP (" + String(currentDelay) + "ms delay)");
  } else {
    digitalWrite(DOWN_PIN, HIGH);
    currentDirection = "down";
    addToLog("Moving DOWN (" + String(currentDelay) + "ms delay)");
  }
 
  lastActionTime = millis();
}


// Device Output (LED Reading) Function
void readDeviceOutputs() {
  unsigned long currentMillis = millis();
  String tempStatus = "";

  for (int i = 0; i < numLEDs; i++) {
    bool currentRed = digitalRead(redLEDs[i]);
    bool currentGreen = digitalRead(greenLEDs[i]);

    if (i == 0 && millis() - lastRedLED0Print >= redLED0Interval) {
      Serial.println("Reading redLED[0]: " + String(currentRed));
      lastRedLED0Print = millis();
    }

    tempStatus += "Red LED " + String(i) + ": " + (currentRed == HIGH ? "ON" : "OFF") + "\n";
    tempStatus += "Green LED " + String(i) + ": " + (currentGreen == HIGH ? "ON" : "OFF") + "\n";

    if (currentRed != lastStateRed[i]) {
      changeCountRed[i]++;
      lastStateRed[i] = currentRed;
    }
    if (currentGreen != lastStateGreen[i]) {
      changeCountGreen[i]++;
      lastStateGreen[i] = currentGreen;
    }

    yield();
  }

  if (currentMillis - previousMillis >= checkInterval) {
    previousMillis = currentMillis;

    struct tm timeinfo;
    char timeString[30];

    if (getLocalTime(&timeinfo)) {
      strftime(timeString, sizeof(timeString), "[%Y-%m-%d %H:%M:%S] ", &timeinfo);
    } else {
      strcpy(timeString, "[time error] ");
    }

    String ledStateOnly = "";
    tempStatus += "\n==== LED STATUS UPDATE ====\n";
    tempStatus += String(timeString) + "\n";

    for (int i = 0; i < numLEDs; i++) {
      if (changeCountRed[i] == 0) {
        String redState = "Red LED " + String(i) + (lastStateRed[i] == HIGH ? " FINAL STATE: ON" : " FINAL STATE: OFF") + "\n";
        tempStatus += redState;
        ledStateOnly += redState;
      } else if (changeCountRed[i] >= 2) {
        String redFlashing = "Red LED " + String(i) + " FINAL STATE: FLASHING\n";
        tempStatus += redFlashing;
        ledStateOnly += redFlashing;
      }

      if (changeCountGreen[i] == 0) {
        String greenState = "Green LED " + String(i) + (lastStateGreen[i] == HIGH ? " FINAL STATE: ON" : " FINAL STATE: OFF") + "\n";
        tempStatus += greenState;
        ledStateOnly += greenState;
      } else if (changeCountGreen[i] >= 2) {
        String greenFlashing = "Green LED " + String(i) + " FINAL STATE: FLASHING\n";
        tempStatus += greenFlashing;
        ledStateOnly += greenFlashing;
      }

 
    }

    // ONLY update if the state has changed
    if (ledStateOnly != lastLedSnapshot) {
      lastLedSnapshot = ledStateOnly;

      String timestampLine;
      if (getLocalTime(&timeinfo)) {
        strftime(timeString, sizeof(timeString), "[%Y-%m-%d %H:%M:%S] ", &timeinfo);
        timestampLine = String(timeString);
      } else {
        timestampLine = "[time error] ";
      }

      String fullEntry = timestampLine + tempStatus + "\n";
      ledStatus = tempStatus;

      ledStatusHistory += fullEntry;
      if (ledStatusHistory.length() > 4000) {
        ledStatusHistory = ledStatusHistory.substring(ledStatusHistory.length() - 3000);
      }

      logLedChangeToSPIFFS(fullEntry);
// === Declare shorthand LED state variables ===
bool r0 = lastStateRed[0];
bool r1 = lastStateRed[1];
bool r2 = lastStateRed[2];
bool r3 = lastStateRed[3];

bool g0 = lastStateGreen[0];
bool g1 = lastStateGreen[1];
bool g2 = lastStateGreen[2];
bool g3 = lastStateGreen[3];

// === Detect Flashing Based on State Changes ===
bool r0f = changeCountRed[0] >= 2;
bool r1f = changeCountRed[1] >= 2;
bool r2f = changeCountRed[2] >= 2;
bool r3f = changeCountRed[3] >= 2;

bool g0f = changeCountGreen[0] >= 2;
bool g1f = changeCountGreen[1] >= 2;
bool g2f = changeCountGreen[2] >= 2;
bool g3f = changeCountGreen[3] >= 2;

// === Amber Conditions Per LED ===
// Steady Amber = both Red and Green are ON
bool a0 = r0 && g0;
bool a1 = r1 && g1;
bool a2 = r2 && g2;
bool a3 = r3 && g3;

// Flashing Amber = both Red and Green flashing or mixed with one flashing
bool a0f = (r0f && g0f) || (r0f && g0) || (r0 && g0f);
bool a1f = (r1f && g1f) || (r1f && g1) || (r1 && g1f);
bool a2f = (r2f && g2f) || (r2f && g2) || (r2 && g2f);
bool a3f = (r3f && g3f) || (r3f && g3) || (r3 && g3f);


// === Combination-based alarm detection ===
greenAlarms = "";
amberAlarms = "";
redAlarms = "";


if (!r0 && !r1 && !r2 && !r3) {
  redAlarms = "Red Alarm: All RED LEDs are OFF";
}

if (r0 && r1 && r2 && r3) {
  redAlarms = "Red Alarm: ALARM Rqt #2\n E-Stop is OFF - Movement Locked";
  stopUpMovement();
  stopDownMovement();
}

if (r0 && r1 && r2 && !r3) {
  redAlarms = "Red Alarm: ALARM Rqt #15\n OSG has tripped or Pit Switch is OFF - Movement Locked";
  stopUpMovement();
  stopDownMovement();
}

if (r0 && r1 && !r2 && !r3) {
  redAlarms = "Red Alarm: ALARM Rqt #23\nLanding Door Lock Failure - Movement Locked";
  stopUpMovement();
  stopDownMovement();
}

if (!r0 && !r1 && r2 && r3) {
  redAlarms = "Red Alarm: ALARM Rqt #22\nLanding Door is Open - Movement Locked";
  stopUpMovement();
  stopDownMovement();
}

if (!r0f && !r1f && !r2f && !r3f) {
  redAlarms = "Red Alarm: No FLASHING RED LEDs DETECTED - Movement Locked";
  stopUpMovement();
  stopDownMovement();
}

if (!r0f && r1f && !r2f && !r3f) {
  redAlarms = "Red Alarm: Alarm Rqt #31\nOut of Service (lift must be inspected / serviced) for safety reasons – Flood switch Activated) - Movement Locked";
  stopUpMovement();
  stopDownMovement();
}

if (!r0f && r1f && r2f && r3f) {
  redAlarms = "Red Alarm: Alarm Rqt #36\nOut of Service – periodic maintenance Needed - Movement Locked";
  stopUpMovement();
  stopDownMovement();
}

if (r0f && !r1f && !r2f && !r3f) {
  redAlarms = "Red Alarm: Alarm Rqt #37\nOut of Service (travel time up > 2 x Average) - Movement Locked";
  stopUpMovement();
  stopDownMovement();
}

if (!r0f && r1f && !r2f && r3f) {
  redAlarms = "Red Alarm: Alarm Rqt #7\nDrive Train, Belt Failure (if present) - Movement Locked";
  stopUpMovement();
  stopDownMovement();
}

if (r0f && r1f && r2f && r3f) {
  redAlarms = "Red Alarm: Alarm Rqt #3\nDrive Nut Friction block (assuming an ACME screw drive) fails and contacts the safety nut, rendering the lift unable to lift the payload 2 - Movement Locked";
  stopUpMovement();
  stopDownMovement();
}

if (r0f && !r1f && !r2f && r3f) {
  redAlarms = "Red Alarm: Alarm Rqt #27\n Drive Train Alignment - Movement Locked";
  stopUpMovement();
  stopDownMovement();
}

if (r0f && r1f && r2f && !r3f) {
  redAlarms = "Red Alarm: Alarm Rqt #10\n Final Limit [2.09.03, Ref. 1] - Movement Locked";
  stopUpMovement();
  stopDownMovement();
}

if (!r0f && !r1f && r2f && !r3f) {
  redAlarms = "Red Alarm: Alarm Rqt #11\nLanding Switch (Top) failure - Movement Locked";
  stopUpMovement();
  stopDownMovement();
}

if (!r0f && r1f && r2f && !r3f) {
  redAlarms = "Red Alarm: Alarm Rqt #12\nLanding Switch (Mid) failure - Movement Locked";
  stopUpMovement();
  stopDownMovement();
}

if (r0f && !r1f && r2f && !r3f) {
  redAlarms = "Red Alarm: Alarm Rqt #13\nLanding Switch (Bottom) failure - Movement Locked";
  stopUpMovement();
  stopDownMovement();
}

if (!r0f && !r1f && r2f && r3f) {
  redAlarms = "Red Alarm: Alarm Rqt #24\nDrive Train Motor Failure - Movement Locked";
  stopUpMovement();
  stopDownMovement();
}

if (!r0f && !r1f && !r2f && r3f) {
  redAlarms = "Red Alarm: Alarm Rqt #5\nDrive Train Motor Failure\nMotor temperature T > 110˚ C (230˚ F) - Movement Locked";
  stopUpMovement();
  stopDownMovement();
}

if (!g0 && !g1 && !g2 && !g3) {
  greenAlarms = "Green Alarm: All GREEN LEDs are OFF";
}

if (g0 && g1 && g2 && g3) {
  greenAlarms = "Green Alarm: No exceptions found";
}

if (!g0f && !g1f && !g2f && !g3f) {
  greenAlarms = "Green Alarm: No FLASHING GREEN LEDs DETECTED";
}

if (g0f && g1f && g2f && !g3f) {
  greenAlarms = "Green Alarm: On Battery Power";
}

if (g0f && g1f && g2f && g3f) {
  greenAlarms = "Green Alarm: Bypass Jumpers not removed after working on lift /n Service Switch is active, so jumpers not used";
}

if (!a0 && !a1 && !a2 && !a3) {
  amberAlarms = "Amber Alarm: ALL AMBER LEDs are OFF";
}

if (a0 && a1 && a2 && !a3) {
  amberAlarms = "Amber Alarm Rqt #4\n Power Failure to the Lift";
}

if (!a0 && a1 && a2 && a3) {
  amberAlarms = "Amber Alarm Rqt #39\n Power Failure to the Lift";
}

if (a0 && !a1 && !a2 && !a3) {
  amberAlarms = "Amber Alarm Rqt #30\nService Required - Flood switch as true)";
}

if (!a0 && a1 && !a2 && !a3) {
  amberAlarms = "Amber Alarm Rqt #33\nService Required – travel time change";
}

if (a0 && a1 && !a2 && !a3) {
  amberAlarms = "Amber Alarm Rqt #34\nService Required – periodic maintenance Needed";
}

if (!a0 && !a1 && a2 && !a3) {
  amberAlarms = "Amber Alarm Rqt #35\nService Required – Service hours";
}

if (!a0 && !a1 && a2 && a3) {
  amberAlarms = "Amber Alarm: Service Required – Charger/Battery";
}

if (a0 && !a1 && !a2 && a3) {
  amberAlarms = "Amber Alarm: Service Required - Inverter or Drive Train Alignment  ";
}

if (!a0f && !a1f && !a2f && !a3f) {
  amberAlarms = "Amber Alarm: ALL FLASHING AMBER LEDs are OFF";
}

if (a0f && a1f && a2f && !a3f) {
  amberAlarms = "Amber Alarm Rqt #32 \n Power Failure to the Lift - UP Movement Locked";
  stopUpMovement();
}

if (!a0f && a1f && a2f && a3f) {
  amberAlarms = "Amber Alarm Rqt #40 \n Power Failure to the Lift";

}

if (!a0f && !a1f && a2f && !a3f) {
  amberAlarms = "Amber Alarm Rqt #6 \n Drive Train Motor Failure - UP Movement Locked";
  stopUpMovement();
}

if (a0f && !a1f && !a2f && a3f) {
  amberAlarms = "Amber Alarm Rqt #8 \n Anti-Rock – too tight / binding of carriage - UP Movement Locked ";
  stopUpMovement();
}

if (a0f && a1f && !a2f && !a3f) {
  amberAlarms = "Amber Alarm Rqt #14 \n Control System Limit Switch[2.09.02, 2.10.03.0; Ref. 1] \n Safety Pan (Bottom Final Limit) - DOWN Movement Locked";
  stopDownMovement();
}

if (!a0f && a1f && !a2f && !a3f) {
  amberAlarms = "Amber Alarm Rqt #16 \n Do not allow the platform to descend into flood waters - DOWN Movement Locked";
  stopDownMovement();
}

if (!a0f && a1f && a2f && !a3f) {
  amberAlarms = "Amber Alarm Rqt #38 \nMotor Temperature monitoring lost";
}

if (greenAlarms == "") greenAlarms = "No green alarms.";
if (amberAlarms == "") amberAlarms = "No amber alarms.";
if (redAlarms == "") redAlarms = "No red alarms.";
// Reset change counters AFTER evaluating flashing conditions
for (int i = 0; i < numLEDs; i++) {
  changeCountRed[i] = 0;
  changeCountGreen[i] = 0;
}
    }
if (redAlarms != "No red alarms." && redAlarms != lastRedEmailSent) {
  if (sendAlarmEmail("Red", redAlarms)) {
    lastRedEmailSent = redAlarms;
  }
}

if (amberAlarms != "No amber alarms." && amberAlarms != lastAmberEmailSent) {
  if (sendAlarmEmail("Amber", amberAlarms)) {
    lastAmberEmailSent = amberAlarms;
  }
}

if (greenAlarms != "No green alarms." && greenAlarms != lastGreenEmailSent) {
  if (sendAlarmEmail("Green", greenAlarms)) {
    lastGreenEmailSent = greenAlarms;
  }
}

    tempStatus += "============================\n";
  }

  delay(LED_CHECK_DELAY);
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

void setup() { // Initialized Serial Monitor for debugging messages
  Serial.begin(115200); // Initialize Serial Monitor at 115200 baud
 
if (!SPIFFS.begin(true)) {
  Serial.println("SPIFFS Mount Failed");
} else {
  Serial.println("SPIFFS initialized");
}

  // Initialize LED pins as Input
  for (int i = 0; i < numLEDs; i++) {
    pinMode(redLEDs[i], INPUT); // Set each red LED pin as INPUT
    pinMode(greenLEDs[i], INPUT); // Set each green LED pin as INPUT
  }


  // Initialize GPIO (Configures Motor Control Pins as outputs while buttons/limit switches are inputs)
  pinMode(UP_PIN, OUTPUT); // Set motor control pin for UP as OUTPUT
  pinMode(DOWN_PIN, OUTPUT);  // Set motor control pin for DOWN as OUTPUT
  pinMode(UP_BUTTON, INPUT_PULLUP);  // Set UP button pin as INPUT with pull-up resistor
  pinMode(DOWN_BUTTON, INPUT_PULLUP); // Set DOWN button pin as INPUT with pull-up resistor
  pinMode(LIMIT_SWITCH_UP, INPUT_PULLUP); // Set upper limit switch pin as INPUT with pull-up resistor
  pinMode(LIMIT_SWITCH_DOWN, INPUT_PULLUP); // Set lower limit switch pin as INPUT with pull-up resistor
  pinMode(BRAKE_PIN, OUTPUT);
  digitalWrite(BRAKE_PIN, HIGH);  // Start with brake engaged for safety
WiFi.mode(WIFI_STA);  // Required for ESP-NOW

// Init ESP-NOW
if (esp_now_init() != ESP_OK) {
  Serial.println("Error initializing ESP-NOW");
  return;
}
Serial.println("ESP-NOW Initialized");

// Register receive callback
esp_now_register_recv_cb(OnDataRecv);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { // Wait until the connection is established
    delay(500);
    Serial.print("."); // Print dots while waiting
  }
  Serial.println();
  Serial.println("\nConnected to WiFi"); // Notify that WiFi is connected
  Serial.println("IP: " + WiFi.localIP().toString()); // Print IP Address
  Serial.println("MAC Address: " + WiFi.macAddress()); // Print MAC Address


  // Initialize NTP
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
  } else {
    Serial.println(&timeinfo, "Time initialized: %Y-%m-%d %H:%M:%S");
  }

server.on("/", []() {
  if (!isAuthenticated()) return;
  server.send(200, "text/html", htmlContent);
});

server.on("/up_start", []() {
  if (!isAuthenticated()) return;
  handleMovement("up");
  server.send(200, "text/plain", "Moving UP");
});

server.on("/down_start", []() {
  if (!isAuthenticated()) return;
  handleMovement("down");
  server.send(200, "text/plain", "Moving DOWN");
});

server.on("/stop", []() {
  if (!isAuthenticated()) return;
  stopMovement();
  server.send(200, "text/plain", "Stopped");
});



  // Changes the operating mode to the user preference
server.on("/setMode", []() {
    if (!isAuthenticated()) return;
    if (server.hasArg("mode")) {
      elevatorMode = (server.arg("mode") == "elevator");
      String mode = elevatorMode ? "Elevator Mode" : "Lift Mode";
      addToLog("Mode set to: " + mode);
      server.send(200, "text/plain", mode);
    }
  });


  // Allows users to adjust delay setting in milliseconds
  server.on("/setDelay", []() {
    if (!isAuthenticated()) return;
    if (server.hasArg("value")) {
      unsigned long newDelay = server.arg("value").toInt(); // Convert the value parameter to integer
      if (elevatorMode) {
        ELEVATOR_MODE_DELAY = newDelay; // Update delay for Elevator Mode if applicable
      } else {
        LIFT_MODE_DELAY = newDelay; // Update delay for Lift Mode if applicable
      }
      String response = "Delay set to " + String(newDelay) + "ms"; // Create response string
      addToLog(response); // Log the delay change
      server.send(200, "text/plain", response); // Send response back to client
    }
  });


// Allow users to adjust delay settings for LEDs in milliseconds
  server.on("/setLEDDelay", []() {
    if (!isAuthenticated()) return;
    if (server.hasArg("value")) {
      LED_CHECK_DELAY = server.arg("value").toInt();
    String msg = "LED check delay set to " + String(LED_CHECK_DELAY) + " ms";
    addToLog(msg);
    server.send(200, "text/plain", msg);
    }
  });


  // Sends system Status (mode, delay, logs) in JSON format
  server.on("/getStatus", []() {
  if (!isAuthenticated()) return;
  String json = "{";
  json += "\"mode\":\"" + String(elevatorMode ? "Elevator Mode" : "Lift Mode") + "\",";
  json += "\"delay\":" + String(elevatorMode ? ELEVATOR_MODE_DELAY : LIFT_MODE_DELAY) + ",";
  json += "\"logs\":\"" + escapeForJson(serialLogs) + "\",";
  json += "\"ledStatus\":\"" + escapeForJson(ledStatus) + "\",";
  json += "\"ledStatusHistory\":\"" + escapeForJson(ledStatusHistory) + "\",";
  json += "\"greenAlarms\":\"" + escapeForJson(greenAlarms) + "\",";
  json += "\"amberAlarms\":\"" + escapeForJson(amberAlarms) + "\",";
  json += "\"redAlarms\":\"" + escapeForJson(redAlarms) + "\",";
  
  // Add email information
  json += "\"emailEnabled\":" + String(emailNotificationsEnabled ? "true" : "false") + ",";
  json += "\"emails\":[";
  for (int i = 0; i < emailCount; i++) {
    json += "\"" + emailAddresses[i] + "\"";
    if (i < emailCount - 1) json += ",";
  }
  json += "]";
  
  json += "}";
  server.send(200, "application/json", json);
});

  // Clears the log history
  server.on("/clearLogs", []() {
    if (!isAuthenticated()) return;
    serialLogs = ""; // Clear the logs
    addToLog("Logs cleared"); // Log that logs have been cleared
    server.send(200, "text/plain", "Logs cleared"); // Send confirmation to client
  });

server.on("/downloadLogs", []() {
  if (!isAuthenticated()) return;

  File file = SPIFFS.open("/led_log.txt", FILE_READ);
  if (!file) {
    server.send(500, "text/plain", "Failed to open log file");
    return;
  }

  server.streamFile(file, "text/plain");
  file.close();
});
// Add these server endpoints inside your setup() function after the other server.on() calls:

server.on("/toggleEmail", []() {
  if (!isAuthenticated()) return;
  if (server.hasArg("enabled")) {
    emailNotificationsEnabled = (server.arg("enabled") == "true");
    String status = emailNotificationsEnabled ? "enabled" : "disabled";
    addToLog("Email notifications " + status);
    server.send(200, "text/plain", "Email notifications " + status);
  }
});

// Modify these endpoints to include saving to SPIFFS

server.on("/addEmail", []() {
  if (!isAuthenticated()) return;
  if (server.hasArg("email")) {
    String email = server.arg("email");
    if (emailCount < MAX_EMAILS) {
      emailAddresses[emailCount++] = email;
      addToLog("Added email: " + email);
      saveEmailsToSPIFFS();  // Save to SPIFFS
      server.send(200, "text/plain", "Email added successfully");
    } else {
      server.send(400, "text/plain", "Maximum number of emails reached (10)");
    }
  }
});

server.on("/removeEmail", []() {
  if (!isAuthenticated()) return;
  if (server.hasArg("index")) {
    int index = server.arg("index").toInt();
    if (index >= 0 && index < emailCount) {
      String removedEmail = emailAddresses[index];
      
      // Shift remaining emails
      for (int i = index; i < emailCount - 1; i++) {
        emailAddresses[i] = emailAddresses[i + 1];
      }
      emailCount--;
      
      addToLog("Removed email: " + removedEmail);
      saveEmailsToSPIFFS();  // Save to SPIFFS
      server.send(200, "text/plain", "Email removed successfully");
    } else {
      server.send(400, "text/plain", "Invalid email index");
    }
  }
});
server.on("/apply_brake", []() {
  if (!isAuthenticated()) return;
  applyBrake();
  server.send(200, "text/plain", "Brake applied");
});

server.on("/release_brake", []() {
  if (!isAuthenticated()) return;
  releaseBrake();
  server.send(200, "text/plain", "Brake released");
});

server.on("/stop_up", []() {
  if (!isAuthenticated()) return;
  stopUpMovement();
  server.send(200, "text/plain", "Upward movement stopped");
});

server.on("/stop_down", []() {
  if (!isAuthenticated()) return;
  stopDownMovement();
  server.send(200, "text/plain", "Downward movement stopped");
});
// Add this to your setup() function after SPIFFS initialization:
  loadEmailsFromSPIFFS();
// Starts the Web Server
  server.begin();
  addToLog("System initialized"); // Log that the system has been initialized
}


// Handles incoming web requests
void loop() { // Main loop function that runs repeatedly
  server.handleClient(); // Handle any incoming web server requests


  // Insert LED reading code here
  readDeviceOutputs(); // Call function to read and update LED outputs
 
  // Handle physical buttons (Checks if buttons presses and moves accordingly)
  static unsigned long lastButtonTime = 0; // Static variable to keep track of last button press time
  unsigned long currentDelay = elevatorMode ? ELEVATOR_MODE_DELAY : LIFT_MODE_DELAY; // Choose delay based on mode
 
  if (millis() - lastButtonTime >= currentDelay) { // If enough time has passed since the last action
    if (digitalRead(UP_BUTTON) == LOW) { // If UP button is pressed
      handleMovement("up"); // Handle upward movement
      lastButtonTime = millis(); // Update the last button press time
    } else if (digitalRead(DOWN_BUTTON) == LOW) { // If DOWN button is pressed
      handleMovement("down"); // Handle downward movement
      lastButtonTime = millis(); // Update the last button press time
    }
  }
 
  // Auto-stop in Elevator Mode (Stop Movement if a limit switch is triggered in Elevator Mode)
  if (elevatorMode) {
    if (digitalRead(UP_PIN) && digitalRead(LIMIT_SWITCH_UP)) stopMovement(); // Stop if upper limit reached
    if (digitalRead(DOWN_PIN) && digitalRead(LIMIT_SWITCH_DOWN)) stopMovement(); // Stop if lower limit reached

       // NEW: Emergency limit switch handling in elevator mode
  if (elevatorMode) {
    if (currentDirection == "up" && digitalRead(LIMIT_SWITCH_UP) == LOW) {
      addToLog("Emergency Stop: Upper limit switch held down");
      stopMovement();
    }
    if (currentDirection == "down" && digitalRead(LIMIT_SWITCH_DOWN) == LOW) {
      addToLog("Emergency Stop: Lower limit switch held down");
      stopMovement();
    }
  }
   delay(1);
  }
  }
// Add these functions after the other functions:

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






