let brokerHost = "lb88002c.ala.us-east-1.emqxsl.com";
let brokerPort = 8084; // WSS port
let brokerPath = "/mqtt";
let brokerUser = "Carlos";
let brokerPass = "mqtt2025";
let topic = "usf/messages";
let client;
let loggedIn = true;

function handleLogin() {
  const userInput = document.getElementById("login-username").value;
  const passInput = document.getElementById("login-password").value;

  if (userInput === brokerUser && passInput === brokerPass) {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("main-app").classList.remove("hidden");
    loggedIn = true;
    connectToMQTT(brokerHost, brokerPort, brokerPath, brokerUser, brokerPass);
  } else {
    alert("❌ Invalid credentials");
  }
}

function connectToMQTT(host, port, path, username, password) {
  const clientId = "webClient_" + Math.random().toString(16).slice(2, 10);
  console.log("🌐 Connecting to MQTT at:", host, port, path, clientId);

  client = new Paho.MQTT.Client(host, Number(port), path, clientId);

  client.onConnectionLost = () => logToAll("🔌 Connection lost");
  client.onMessageArrived = onMessageArrived;

  client.connect({
    useSSL: true,
    userName: username,
    password: password,
    onSuccess: () => {
      logToAll("✅ Connected to MQTT broker");
      client.subscribe(topic);
      logToAll("🔔 Subscribed to topic: " + topic);

      // Start sending pings or status every 5 seconds
      setInterval(() => {
        const message = new Paho.MQTT.Message("🌐 Web Client Ping");
        message.destinationName = topic;
        client.send(message);
        log("general-log", "📤 Sent: Web Client Ping");
      }, 5000);
    },
    onFailure: (err) => {
      logToAll("❌ MQTT connect failed: " + err.errorMessage);
    }
  });
}

function onMessageArrived(message) {
  const msg = message.payloadString;
  log("general-log", "📩 " + msg);

  if (msg.startsWith("E")) log("command-log", "🧠 " + msg);
  if (msg.toLowerCase().includes("alert")) log("alert-log", "🚨 " + msg);
}

function log(id, text) {
  const el = document.getElementById(id);
  el.textContent += text + "\n";
  el.scrollTop = el.scrollHeight;
}

function logToAll(text) {
  ["general-log", "command-log", "alert-log"].forEach((id) => log(id, text));
}
