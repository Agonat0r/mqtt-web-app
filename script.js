// -----------------------------
// 🔐 Login System
// -----------------------------
let brokerHost = "lb88002c.ala.us-east-1.emqxsl.com";
let brokerPort = 8084;
let brokerPath = "/mqtt";
let brokerUser = "Carlos";
let brokerPass = "mqtt2025";
let topic = "usf/messages";
let client;
let loggedIn = false;

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

// -----------------------------
// 🌐 MQTT Setup (WSS Config)
// -----------------------------
function connectToMQTT(host, port, path, username, password) {
  const clientId = "webClient_" + Math.random().toString(16).slice(2, 10);
  console.log("🌐 Connecting to MQTT at:", host, port, path, clientId);

  try {
    if (typeof Paho === "undefined" || typeof Paho.MQTT === "undefined" || typeof Paho.MQTT.Client === "undefined") {
      
      return;
    }

    client = new Paho.MQTT.Client("lb88002c.ala.us-east-1.emqxsl.com", 8084, "/mqtt", clientId);

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
      },
      onFailure: (err) => {
        logToAll("❌ MQTT connect failed: " + err.errorMessage);
      }
    });
  } catch (error) {
    console.error("🚨 MQTT Client Init Error:", error);
  }
}

function onMessageArrived(message) {
  const msg = message.payloadString;
  if (msg.startsWith("E")) log("command-log", "🧠 " + msg);
  else if (msg.toLowerCase().includes("alert")) log("alert-log", "🚨 " + msg);
  else log("general-log", "📩 " + msg);
}

function log(id, text) {
  const el = document.getElementById(id);
  el.textContent += text + "\n";
  el.scrollTop = el.scrollHeight;
}

function logToAll(text) {
  ["general-log", "command-log", "alert-log"].forEach((id) => log(id, text));
}

// -----------------------------
// 🗂️ Tab Switching
// -----------------------------
function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach((el) => el.classList.add("hidden"));
  document.getElementById(`${tabId}-tab`).classList.remove("hidden");
}

// -----------------------------
// 📂 Export Logs
// -----------------------------
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

// -----------------------------
// 📧 Send Report via EmailJS
// -----------------------------
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
    .catch(err => {
      
      alert("❌ Failed to send email.");
    });
}

// -----------------------------
// 🌐 Language Switcher
// -----------------------------
const langMap = {
  en: {
    dashboardTitle: "USF Harmar MQTT Dashboard",
    general: "General Console",
    commands: "Command Console",
    alerts: "Alert Console",
    login: "Login",
    sendReport: "Send Report",
    exportLogs: "Export Logs"
  },
  es: {
    dashboardTitle: "Panel MQTT de USF Harmar",
    general: "Consola General",
    commands: "Consola de Comandos",
    alerts: "Consola de Alertas",
    login: "Iniciar sesión",
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
  document.querySelector("button[onclick='exportLogs()']").textContent = "📂 " + langMap[lang].exportLogs;
}

// -----------------------------
// ✅ Init Check
// -----------------------------
window.addEventListener("DOMContentLoaded", () => {
  if (typeof emailjs !== "undefined") {
    emailjs.init("7osg1XmfdRC2z68Xt");
    console.log("📧 EmailJS initialized");
  }

  if (typeof Paho !== "undefined" && typeof Paho.MQTT !== "undefined") {
    console.log("✅ Paho MQTT loaded from local libs/paho-mqtt.js");
  } else {

  }
});
