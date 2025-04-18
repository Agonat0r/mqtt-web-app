// -----------------------------
// 🔐 Login System
// -----------------------------
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

// -----------------------------
// 🌐 MQTT Setup (via EMQX)
// -----------------------------
let client;
const host = "10.226.176.234";  // Your IP address
const port = 8083;
const path = "/mqtt";
const topic = "usf/messages";

function connectToMQTT() {
  const clientId = "webClient_" + Math.random().toString(16).substr(2, 8);

  client = new Paho.MQTT.Client(host, Number(port), path, clientId);

  client.onMessageArrived = onMessageArrived;
  client.onConnectionLost = () => logToAll("🔌 Connection lost");

  client.connect({
    useSSL: false, // ❗ TLS is disabled in your MQTT setup
    userName: "admin",
    password: "mqtt2025",
    onSuccess: () => {
      logToAll("✅ Connected to MQTT broker");
      client.subscribe(topic);
      logToAll("🔔 Subscribed to topic: " + topic);
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

// -----------------------------
// 🗂️ Tab Switching
// -----------------------------
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById(`${tabId}-tab`).classList.remove('hidden');
}

// -----------------------------
// 💾 Export Logs (.txt / .csv)
// -----------------------------
function exportLogs() {
  const format = document.getElementById('file-format').value;
  const logs = {
    general: document.getElementById('general-log').textContent.trim(),
    command: document.getElementById('command-log').textContent.trim(),
    alert: document.getElementById('alert-log').textContent.trim()
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
  const userEmail = document.getElementById('user-email').value;
  if (!userEmail) {
    alert("❗ Please enter your email address.");
    return;
  }

  const fullLog =
    "=== General Logs ===\n" + document.getElementById('general-log').textContent.trim() + "\n\n" +
    "=== Command Logs ===\n" + document.getElementById('command-log').textContent.trim() + "\n\n" +
    "=== Alert Logs ===\n" + document.getElementById('alert-log').textContent.trim();

  const form = document.createElement("form");
  form.setAttribute("id", "email-form");

  const fields = {
    title: "MQTT Report",
    name: "USF Harmar Dashboard",
    time: new Date().toLocaleString(),
    message: fullLog,
    to_email: userEmail
  };

  for (const key in fields) {
    const input = document.createElement("input");
    input.setAttribute("type", "hidden");
    input.setAttribute("name", key);
    input.setAttribute("value", fields[key]);
    form.appendChild(input);
  }

  document.body.appendChild(form);

  emailjs.sendForm("service_lsa1r4i", "template_vnrbr1d", "#email-form")
    .then(() => {
      alert("✅ Report sent!");
      form.remove();
    })
    .catch(err => {
      console.error("EmailJS Error:", err);
      alert("❌ Failed to send email.");
      form.remove();
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
  document.querySelector("button[onclick='exportLogs()']").textContent = "💾 " + langMap[lang].exportLogs;
}

// -----------------------------
// 📧 EmailJS Init
// -----------------------------
window.addEventListener("DOMContentLoaded", () => {
  if (typeof emailjs !== "undefined") {
    emailjs.init("7osg1XmfdRC2z68Xt"); // ✅ Your EmailJS public key
  } else {
    console.error("❌ EmailJS SDK not loaded.");
  }
});
