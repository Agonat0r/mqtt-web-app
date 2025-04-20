// ✅ Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAoRdVB4cu6FGVnCbssFl-uTzGWSYHF_7o",
  authDomain: "usf-harmar-mqtt-dashboar-3a6ed.firebaseapp.com",
  projectId: "usf-harmar-mqtt-dashboar-3a6ed",
  storageBucket: "usf-harmar-mqtt-dashboar-3a6ed.firebasestorage.app",
  messagingSenderId: "469430781334",
  appId: "1:469430781334:web:d1fd378dd95a8753d289b7",
  measurementId: "G-JR8BJYRZFW"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let brokerHost = "wss://lb88002c.ala.us-east-1.emqxsl.com:8084/mqtt";
let topic = "usf/messages";
let client;
let loggedIn = false;

function handleLogin() {
  const user = document.getElementById("login-username").value;
  const pass = document.getElementById("login-password").value;
  if (user === "Carlos" && pass === "mqtt2025") {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("main-app").classList.remove("hidden");
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

  client = mqtt.connect(brokerHost, options);

  client.on("connect", () => {
    logToAll("✅ Connected to MQTT broker");
    client.subscribe(topic, () => logToAll("🔔 Subscribed to topic: " + topic));
  });

  client.on("error", (err) => {
    logToAll("❌ MQTT Error: " + err.message);
    client.end();
  });

  client.on("reconnect", () => logToAll("🔁 Reconnecting..."));

  client.on("message", (topic, message) => {
    const msg = message.toString();
    log("terminal-log", `[RECV] ${msg}`);

    if (msg.startsWith("COMMAND:") || msg.startsWith("E")) {
      log("command-log", "🧠 " + msg);
      document.getElementById("command-sound").play();
    } else {
      log("general-log", "📩 " + msg);
    }

    if (msg.toLowerCase().includes("alert")) {
      log("alert-log", "🚨 " + msg);
      document.getElementById("alert-sound").play();
    }

    updateStatusPanel(msg);
  });
}

function updateStatusPanel(msg) {
  if (msg.includes("UP")) document.getElementById("status-direction").textContent = "Up";
  if (msg.includes("DOWN")) document.getElementById("status-direction").textContent = "Down";
  if (msg.includes("IDLE")) document.getElementById("status-direction").textContent = "Idle";

  if (msg.includes("POS:")) {
    const pos = msg.split("POS:")[1].split(" ")[0];
    document.getElementById("status-position").textContent = pos;
  }

  if (msg.includes("TARGET:")) {
    const tgt = msg.split("TARGET:")[1].split(" ")[0];
    document.getElementById("status-target").textContent = tgt;
  }

  if (msg.includes("LIMIT_TOP")) document.getElementById("limit-top").textContent = "Active";
  if (msg.includes("LIMIT_BOTTOM")) document.getElementById("limit-bottom").textContent = "Active";

  if (msg.includes("DOOR_OPEN")) document.getElementById("door-sensor").textContent = "Open";
  if (msg.includes("DOOR_CLOSED")) document.getElementById("door-sensor").textContent = "Closed";

  if (msg.includes("EMERGENCY")) document.getElementById("emergency-stop").textContent = "Triggered";
  if (msg.includes("NORMAL")) document.getElementById("emergency-stop").textContent = "Inactive";

  if (msg.includes("ALARM")) {
    const alarm = msg.split("ALARM:")[1] || "Unknown";
    document.getElementById("active-alarms").textContent = alarm;
  }
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  document.getElementById(`${tabId}-tab`).classList.remove("hidden");
}

function log(id, text) {
  const el = document.getElementById(id);
  el.textContent += text + "\n";
  el.scrollTop = el.scrollHeight;
}

function logToAll(text) {
  ["general-log", "command-log", "alert-log"].forEach(id => log(id, text));
}

function handleTerminalInput(e) {
  if (e.key === "Enter") {
    const input = document.getElementById("terminal-input");
    const text = input.value.trim();
    if (text && client?.connected) {
      client.publish(topic, text);
      log("terminal-log", `[SEND] ${text}`);
      input.value = "";
    } else {
      log("terminal-log", "[WARN] MQTT not connected");
    }
  }
}

function clearLog(id) {
  const el = document.getElementById(id);
  if (el) el.textContent = "";
}

function exportLogs() {
  const format = document.getElementById("file-format").value;
  const logs = {
    general: document.getElementById("general-log").textContent,
    command: document.getElementById("command-log").textContent,
    alert: document.getElementById("alert-log").textContent
  };
  let content = "";

  if (format === "csv") {
    content = "Type,Message\n";
    for (const [type, data] of Object.entries(logs)) {
      content += data.split("\n").map(line => `${type},"${line}"`).join("\n") + "\n";
    }
  } else {
    content = `=== General ===\n${logs.general}\n\n=== Command ===\n${logs.command}\n\n=== Alert ===\n${logs.alert}`;
  }

  const blob = new Blob([content], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mqtt_log.${format}`;
  a.click();
}

function sendEmail() {
  const email = document.getElementById("user-email").value;
  if (!email) return alert("Enter your email!");

  const logs = `
    === General ===
    ${document.getElementById("general-log").textContent}
    === Command ===
    ${document.getElementById("command-log").textContent}
    === Alert ===
    ${document.getElementById("alert-log").textContent}
  `;

  const form = document.getElementById("email-form");
  form.title.value = "MQTT Report";
  form.name.value = "USF Harmar Dashboard";
  form.time.value = new Date().toLocaleString();
  form.message.value = logs;
  form.to_email.value = email;

  emailjs.sendForm("service_lsa1r4i", "template_vnrbr1d", "#email-form")
    .then(() => alert("✅ Report sent!"))
    .catch(() => alert("❌ Email send failed"));
}

// === UI Customization ===
function applyTheme() {
  const theme = document.getElementById("theme-selector").value;
  document.body.className = ""; // Reset
  if (theme === "dark") document.body.classList.add("dark-mode");
  if (theme === "usf") document.body.classList.add("usf-mode");
  localStorage.setItem("selectedTheme", theme);
}

function applyFont() {
  const font = document.getElementById("font-selector").value;
  document.body.style.fontFamily = font === "default" ? "" : font;
  localStorage.setItem("selectedFont", font);
}

function applyBorders() {
  const toggle = document.getElementById("border-toggle").checked;
  ["general-log", "command-log", "alert-log", "terminal-log"].forEach(id => {
    const el = document.getElementById(id);
    el.classList.toggle("bordered", toggle);
  });
  localStorage.setItem("borderedLogs", toggle);
}

function resetCustomizations() {
  localStorage.clear();
  document.body.className = "";
  document.body.style.fontFamily = "";
  document.getElementById("theme-selector").value = "default";
  document.getElementById("font-selector").value = "default";
  document.getElementById("border-toggle").checked = false;
  applyTheme();
  applyFont();
  applyBorders();
  alert("🎨 Customization Reset!");
}

function saveLogsToFile() {
  const content = `
    === General ===\n${document.getElementById("general-log").textContent}
    === Commands ===\n${document.getElementById("command-log").textContent}
    === Alerts ===\n${document.getElementById("alert-log").textContent}
  `;
  const blob = new Blob([content], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "mqtt_logs.txt";
  a.click();
}

function loadLogFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const sections = text.split("=== ");
    sections.forEach(sec => {
      if (sec.includes("General ===")) document.getElementById("general-log").textContent = sec.split("===\n")[1] || "";
      if (sec.includes("Commands ===")) document.getElementById("command-log").textContent = sec.split("===\n")[1] || "";
      if (sec.includes("Alerts ===")) document.getElementById("alert-log").textContent = sec.split("===\n")[1] || "";
    });
  };
  reader.readAsText(file);
}

function switchLanguage() {
  const lang = document.getElementById("language-selector").value;
  const map = langMap[lang] || langMap["en"];
  document.querySelector(".nav-title").textContent = map.dashboardTitle;
  document.querySelector("#general-tab h2").textContent = map.general;
  document.querySelector("#commands-tab h2").textContent = map.commands;
  document.querySelector("#alerts-tab h2").textContent = map.alerts;
  document.querySelector("#status-tab h2").textContent = map.status;
  document.querySelector("button[onclick='sendEmail()']").textContent = map.sendReport;
  document.querySelector("button[onclick='exportLogs()']").textContent = map.exportLogs;
}

// === Translations ===
const langMap = {
  en: { dashboardTitle: "USF Harmar MQTT Dashboard", general: "📋 General Console", commands: "🧠 Command Console", alerts: "🚨 Alert Console", status: "📊 Lift System Status", sendReport: "📤 Send Report", exportLogs: "💾 Export Logs" },
  es: { dashboardTitle: "Panel MQTT de USF Harmar", general: "📋 Consola General", commands: "🧠 Consola de Comandos", alerts: "🚨 Consola de Alertas", status: "📊 Estado del Elevador", sendReport: "📤 Enviar Informe", exportLogs: "💾 Exportar Registros" },
  zh: { dashboardTitle: "USF Harmar MQTT仪表盘", general: "📋 常规控制台", commands: "🧠 指令控制台", alerts: "🚨 警报控制台", status: "📊 电梯状态", sendReport: "📤 发送报告", exportLogs: "💾 导出日志" },
  hi: { dashboardTitle: "USF हारमार MQTT डैशबोर्ड", general: "📋 सामान्य कंसोल", commands: "🧠 कमांड कंसोल", alerts: "🚨 अलर्ट कंसोल", status: "📊 लिफ्ट स्थिति", sendReport: "📤 रिपोर्ट भेजें", exportLogs: "💾 लॉग्स निर्यात करें" },
  ar: { dashboardTitle: "لوحة معلومات USF Harmar", general: "📋 وحدة التحكم العامة", commands: "🧠 وحدة الأوامر", alerts: "🚨 وحدة التنبيهات", status: "📊 حالة المصعد", sendReport: "📤 إرسال التقرير", exportLogs: "💾 تصدير السجلات" },
  bn: { dashboardTitle: "USF Harmar MQTT ড্যাশবোর্ড", general: "📋 সাধারণ কনসোল", commands: "🧠 কমান্ড কনসোল", alerts: "🚨 এলার্ট কনসোল", status: "📊 লিফট স্ট্যাটাস", sendReport: "📤 রিপোর্ট পাঠান", exportLogs: "💾 লগ রপ্তানি করুন" },
  pt: { dashboardTitle: "Painel MQTT USF Harmar", general: "📋 Console Geral", commands: "🧠 Console de Comandos", alerts: "🚨 Console de Alertas", status: "📊 Status do Elevador", sendReport: "📤 Enviar Relatório", exportLogs: "💾 Exportar Logs" },
  ru: { dashboardTitle: "Панель USF Harmar MQTT", general: "📋 Общая консоль", commands: "🧠 Консоль команд", alerts: "🚨 Консоль тревог", status: "📊 Статус лифта", sendReport: "📤 Отправить отчет", exportLogs: "💾 Экспорт логов" },
  ja: { dashboardTitle: "USF Harmar MQTT ダッシュボード", general: "📋 一般コンソール", commands: "🧠 コマンドコンソール", alerts: "🚨 アラートコンソール", status: "📊 リフトステータス", sendReport: "📤 レポート送信", exportLogs: "💾 ログをエクスポート" },
  de: { dashboardTitle: "USF Harmar MQTT-Dashboard", general: "📋 Allgemeine Konsole", commands: "🧠 Befehls-Konsole", alerts: "🚨 Alarm-Konsole", status: "📊 Aufzugsstatus", sendReport: "📤 Bericht senden", exportLogs: "💾 Logs exportieren" }
};

window.addEventListener("DOMContentLoaded", () => {
  emailjs.init("7osg1XmfdRC2z68Xt");
  loadCustomizations();
});
