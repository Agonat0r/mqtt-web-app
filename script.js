let client;

function log(message) {
  const logDiv = document.getElementById("log");
  logDiv.innerText += message + "\n";
  logDiv.scrollTop = logDiv.scrollHeight;
}

function connect() {
  const broker = document.getElementById("broker").value;
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const clientId = "client_" + Math.random().toString(16).substr(2, 8);

  // Strip protocol and port from broker URL for Paho format
  let host, port;
  try {
    const url = new URL(broker);
    host = url.hostname;
    port = url.port || (url.protocol === "wss:" ? 8084 : 1883); // fallback
  } catch (e) {
    log("❌ Invalid broker URL");
    return;
  }

  client = new Paho.MQTT.Client(host, Number(port), clientId);

  client.onConnectionLost = () => log("🔌 Connection lost");
  client.onMessageArrived = (msg) => log(`📩 ${msg.destinationName}: ${msg.payloadString}`);

  client.connect({
    useSSL: broker.startsWith("wss"),
    userName: username,
    password: password,
    onSuccess: () => log(`✅ Connected to ${broker} as ${clientId}`),
    onFailure: (err) => log("❌ Failed to connect: " + err.errorMessage)
  });
}

function subscribe() {
  const topic = document.getElementById("topic").value;
  if (client && client.isConnected()) {
    client.subscribe(topic);
    log("🔔 Subscribed to " + topic);
  }
}

function publish() {
  const topic = document.getElementById("topic").value;
  const message = new Paho.MQTT.Message(document.getElementById("message").value);
  message.destinationName = topic;
  client.send(message);
  log("📤 Message sent to " + topic);
}

function disconnect() {
  if (client && client.isConnected()) {
    client.disconnect();
    log("🛑 Disconnected");
  }
}
