// --- Login System ---
function handleLogin() {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  if (username === 'admin' && password === 'mqtt2025') {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    connectToMQTT();
  } else {
    alert('❌ Invalid credentials');
  }
}

// --- MQTT Setup ---
let client;
const host = "lb88002c.ala.us-east-1.emqxsl.com";
const port = 8084;
const topic = "usf/messages";

function connectToMQTT() {
  const clientId = "webClient_" + Math.random().toString(16).substr(2, 8);
  client = new Paho.MQTT.Client(host, port, clientId);

  client.onMessageArrived = onMessageArrived;
  client.onConnectionLost = () => logToAll("🔌 Connection lost");

  client.connect({
    useSSL: true,
    userName: "Carlos",
    password: "Pena",
    onSuccess: () => {
      logToAll("✅ Connected to MQTT broker");
      client.subscribe(topic);
    },
    onFailure: (err) => {
      logToAll("❌ MQTT connect failed: " + err.errorMessage);
    }
  });
}

function onMessageArrived(message) {
  const msg = message.payloadString;

  if (msg.startsWith("E")) {
    log("command-log", "🧠 " + msg);
  } else if (msg.toLowerCase().includes("alert")) {
    log("alert-log", "🚨 " + msg);
  } else {
    log("general-log", "📩 " + msg);
  }
}

function log(id, text) {
  const el = document.getElementById(id);
  el.textContent += text + "\n";
  el.scrollTop = el.scrollHeight;
}

function logToAll(text) {
  log("general-log", text);
  log("command-log", text);
  log("alert-log", text);
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById(tabId + '-tab').classList.remove('hidden');
}
