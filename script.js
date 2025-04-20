let brokerHost = "wss://lb88002c.ala.us-east-1.emqxsl.com:8084/mqtt";
let topic = "usf/messages";
let client;
let loggedIn = false;

function handleLogin() {
  const userInput = document.getElementById("login-username").value;
  const passInput = document.getElementById("login-password").value;

  if (userInput === "Carlos" && passInput === "mqtt2025") {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("main-app").classList.remove("hidden");
    loggedIn = true;
    connectToMQTT();
  } else {
    alert("❌ Invalid credentials");
  }
}

function connectToMQTT() {
  const clientId = "mqttjs_" + Math.random().toString(16).substr(2, 8);
  const options = {
    clientId,
    username: "Carlos",
    password: "mqtt2025",
    keepalive: 60,
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000
  };

  console.log("🔌 Connecting to:", brokerHost);
  client = mqtt.connect(brokerHost, options);

  client.on("connect", () => {
    logToAll("✅ Connected to MQTT broker");
    client.subscribe(topic, { qos: 0 }, () => {
      logToAll("🔔 Subscribed to topic: " + topic);
    });
  });

  client.on("error", (err) => {
    logToAll("❌ MQTT connection error: " + err.message);
    client.end();
  });

  client.on("reconnect", () => {
    logToAll("🔁 Reconnecting to broker...");
  });

  client.on("message", (topic, message) => {
    const msg = message.toString();
    log("terminal-log", `[RECV] ${msg}`);
    log("general-log", "📩 " + msg);
  
    if (msg.startsWith("E") || msg.startsWith("COMMAND:")) {
      log("command-log", "🧠 " + msg);
    }
  
    if (msg.toLowerCase().includes("alert")) {
      log("alert-log", "🚨 " + msg);
    }
  });
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach((el) => el.classList.add("hidden"));
  document.getElementById(`${tabId}-tab`).classList.remove("hidden");
}

function log(id, text) {
  const el = document.getElementById(id);
  el.textContent += text + "\n";
  el.scrollTop = el.scrollHeight;
}

function logToAll(text) {
  ["general-log", "command-log", "alert-log"].forEach((id) => log(id, text));
}

function handleTerminalInput(event) {
  if (event.key === "Enter") {
    const inputField = document.getElementById("terminal-input");
    const text = inputField.value.trim();
    if (text && client && client.connected) {
      client.publish(topic, text);
      log("terminal-log", `[SEND] ${text}`);
      inputField.value = "";
    } else {
      log("terminal-log", "[WARN] Cannot send, MQTT not connected.");
    }
  }
}

function exportLogs() {
  const format = document.getElementById("file-format").value;
  const logs = {
    general: document.getElementById("general-log").textContent.trim(),
    command: document.getElementById("command-log").textContent.trim(),
    alert: document.getElementById("alert-log").textContent.trim()
  };

  let content = "";
  if (format === "csv") {
    content = "Type,Message\n";
    content += logs.general.split('\n').map(l => `General,"${l}"`).join('\n') + '\n';
    content += logs.command.split('\n').map(l => `Command,"${l}"`).join('\n') + '\n';
    content += logs.alert.split('\n').map(l => `Alert,"${l}"`).join('\n');
  } else {
    content = `=== General ===\n${logs.general}\n\n=== Commands ===\n${logs.command}\n\n=== Alerts ===\n${logs.alert}`;
  }

  const blob = new Blob([content], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `mqtt_log.${format}`;
  link.click();
}

function sendEmail() {
  const userEmail = document.getElementById("user-email").value;
  if (!userEmail) return alert("❗ Please enter your email.");

  const fullLog = `
    === General Logs ===
    ${document.getElementById('general-log').textContent.trim()}
    === Command Logs ===
    ${document.getElementById('command-log').textContent.trim()}
    === Alert Logs ===
    ${document.getElementById('alert-log').textContent.trim()}
  `;

  const form = document.getElementById('email-form');
  form.title.value = "MQTT Report";
  form.name.value = "USF Harmar Dashboard";
  form.time.value = new Date().toLocaleString();
  form.message.value = fullLog;
  form.to_email.value = userEmail;

  emailjs.sendForm("service_lsa1r4i", "template_vnrbr1d", "#email-form")
    .then(() => alert("✅ Report sent!"))
    .catch(err => alert("❌ Failed to send email."));
}

const langMap = {
  en: {
    dashboardTitle: "USF Harmar MQTT Dashboard",
    general: "General Console",
    commands: "Command Console",
    alerts: "Alert Console",
    sendReport: "Send Report",
    exportLogs: "Export Logs"
  },
  es: {
    dashboardTitle: "Panel MQTT de USF Harmar",
    general: "Consola General",
    commands: "Consola de Comandos",
    alerts: "Consola de Alertas",
    sendReport: "Enviar Informe",
    exportLogs: "Exportar Registros"
  }
};

function switchLanguage() {
  const lang = document.getElementById("language-selector").value;
  document.querySelector(".nav-title").textContent = langMap[lang].dashboardTitle;
  document.querySelector("#general-tab h2").textContent = "📋 " + langMap[lang].general;
  document.querySelector("#commands-tab h2").textContent = "🧠 " + langMap[lang].commands;
  document.querySelector("#alerts-tab h2").textContent = "🚨 " + langMap[lang].alerts;
  document.querySelector("button[onclick='sendEmail()']").textContent = "📤 " + langMap[lang].sendReport;
  document.querySelector("button[onclick='exportLogs()']").textContent = "💾 " + langMap[lang].exportLogs;
}

window.addEventListener("DOMContentLoaded", () => {
  if (typeof emailjs !== "undefined") {
    emailjs.init("7osg1XmfdRC2z68Xt");
    console.log("📧 EmailJS initialized");
  }

  if (typeof mqtt !== "undefined") {
    console.log("✅ mqtt.js loaded");
  }
});
