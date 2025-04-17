let client;

function log(message) {
  const logDiv = document.getElementById("log");
  logDiv.innerText += message + "\n";
  logDiv.scrollTop = logDiv.scrollHeight;
}

function connect() {
  const broker = document.getElementById("broker").value;
  const clientId = "client_" + Math.random().toString(16).substr(2, 8);

  client = new Paho.MQTT.Client(broker, clientId);

  client.onConnectionLost = () => log("🔌 Connection lost");
  client.onMessageArrived = (msg) => log(`📩 ${msg.destinationName}: ${msg.payloadString}`);

  client.connect({
    useSSL: broker.startsWith("wss"),
    onSuccess: () => log(`✅ Connected to ${broker}`),
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
  log("📤 Message sent");
}

function disconnect() {
  if (client && client.isConnected()) {
    client.disconnect();
    log("🛑 Disconnected");
  }
}
