// === Full script.js with Firestore logging, timestamps, translations, and MQTT handling ===
import translations from './translations.js';

// Current language
let currentLang = 'en';

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

// 🔒 Set Firebase rules in Firestore console for testing:
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /{document=**} {
//       allow read, write: if true;
//     }
//   }
// }

// === Customization Settings ===
const SETTINGS_KEY = 'usf_harmar_settings';
let currentSettings = {
  theme: 'default',
  font: 'default',
  showBorders: false,
  fontSize: 'normal',
  language: 'en'
};

// Load settings on startup
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  applySettings();
  updateAllText();
});

// Translation helper function
function t(key) {
  return translations[currentLang]?.[key] || translations.en[key] || key;
}

// Update all text content in the UI
function updateAllText() {
  // Login screen
  document.getElementById('login-title').textContent = t('loginTitle');
  document.getElementById('login-username').placeholder = t('username');
  document.getElementById('login-password').placeholder = t('password');
  document.querySelector('#login-screen button').textContent = t('loginButton');

  // Navigation
  document.querySelector('.nav-title').textContent = t('dashboard');
  
  // Update tab selector options
  const tabSelector = document.querySelector('.nav-tabs select');
  tabSelector.innerHTML = `
    <option value="status">${t('status')}</option>
    <option value="general">${t('general')}</option>
    <option value="commands">${t('commands')}</option>
    <option value="alerts">${t('alerts')}</option>
    <option value="customization">${t('customization')}</option>
  `;

  // Status panel
  document.getElementById('status-title').textContent = t('liftSystemStatus');
  document.querySelectorAll('.status-section p').forEach(p => {
    const label = p.querySelector('span:first-child');
    if (label) {
      const key = label.textContent.replace(':', '').toLowerCase();
      label.textContent = t(key) + ':';
    }
  });

  // Console tabs
  document.getElementById('general-title').textContent = t('generalConsole');
  document.getElementById('terminal-input').placeholder = t('typeCommand');
  document.getElementById('commands-title').textContent = t('commandConsole');
  document.getElementById('alerts-title').textContent = t('alertConsole');

  // Customization panel
  document.getElementById('customization-title').textContent = t('customization');
  document.querySelector('label[for="theme-selector"]').textContent = t('theme') + ':';
  document.querySelector('label[for="font-selector"]').textContent = t('font') + ':';
  document.querySelector('label[for="border-toggle"]').textContent = t('showBorders');
  document.querySelector('#customization-tab button').textContent = t('reset');

  // Update select options
  const themeSelector = document.getElementById('theme-selector');
  themeSelector.innerHTML = `
    <option value="default">${t('themeDefault')}</option>
    <option value="dark">${t('themeDark')}</option>
    <option value="usf">${t('themeUsf')}</option>
  `;

  const fontSelector = document.getElementById('font-selector');
  fontSelector.innerHTML = `
    <option value="default">${t('fontDefault')}</option>
    <option value="monospace">${t('fontMonospace')}</option>
    <option value="sans-serif">${t('fontSansSerif')}</option>
  `;

  // Tools panel
  document.getElementById('user-email').placeholder = t('enterEmail');
  document.querySelector('button[onclick="sendEmail()"]').textContent = t('sendReport');
  document.querySelector('button[onclick="exportLogs()"]').textContent = t('exportLogs');
  document.querySelector('button[onclick="saveLogsToFile()"]').textContent = t('saveLogs');

  // Clear buttons
  document.querySelector('button[onclick="clearLog(\'general-log\')"]').textContent = t('clearGeneral');
  document.querySelector('button[onclick="clearLog(\'command-log\')"]').textContent = t('clearCommands');
  document.querySelector('button[onclick="clearLog(\'alert-log\')"]').textContent = t('clearAlerts');

  // Update initial log messages
  if (document.getElementById('general-log').textContent.includes('Waiting for messages')) {
    document.getElementById('general-log').textContent = t('waitingMessages');
  }
  if (document.getElementById('terminal-log').textContent.includes('[Terminal Initialized]')) {
    document.getElementById('terminal-log').textContent = t('terminalInitialized');
  }
  if (document.getElementById('command-log').textContent.includes('Waiting for commands')) {
    document.getElementById('command-log').textContent = t('waitingCommands');
  }
  if (document.getElementById('alert-log').textContent.includes('Waiting for alerts')) {
    document.getElementById('alert-log').textContent = t('waitingAlerts');
  }
}

function switchLanguage() {
  const lang = document.getElementById('language-selector').value;
  currentLang = lang;
  currentSettings.language = lang;
  saveSettings();
  updateAllText();
}

function loadSettings() {
  const saved = localStorage.getItem(SETTINGS_KEY);
  if (saved) {
    currentSettings = { ...currentSettings, ...JSON.parse(saved) };
    
    // Update UI to match loaded settings
    document.getElementById('theme-selector').value = currentSettings.theme;
    document.getElementById('font-selector').value = currentSettings.font;
    document.getElementById('border-toggle').checked = currentSettings.showBorders;
    document.getElementById('language-selector').value = currentSettings.language;
    currentLang = currentSettings.language;
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
}

function applySettings() {
  applyTheme();
  applyFont();
  applyBorders();
}

function applyTheme() {
  const theme = document.getElementById('theme-selector').value;
  document.body.classList.remove('dark-mode', 'usf-mode');
  
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
  } else if (theme === 'usf') {
    document.body.classList.add('usf-mode');
  }
  
  currentSettings.theme = theme;
  saveSettings();
}

function applyFont() {
  const font = document.getElementById('font-selector').value;
  const fontMap = {
    'default': "'Segoe UI', sans-serif",
    'monospace': "'Courier New', monospace",
    'sans-serif': "Arial, sans-serif"
  };
  
  document.body.style.fontFamily = fontMap[font] || fontMap.default;
  currentSettings.font = font;
  saveSettings();
}

function applyBorders() {
  const showBorders = document.getElementById('border-toggle').checked;
  document.querySelectorAll('.status-section, .tools-panel, pre').forEach(el => {
    if (showBorders) {
      el.classList.add('bordered');
    } else {
      el.classList.remove('bordered');
    }
  });
  
  currentSettings.showBorders = showBorders;
  saveSettings();
}

function resetCustomizations() {
  currentSettings = {
    theme: 'default',
    font: 'default',
    showBorders: false,
    fontSize: 'normal'
  };
  
  document.getElementById('theme-selector').value = 'default';
  document.getElementById('font-selector').value = 'default';
  document.getElementById('border-toggle').checked = false;
  
  applySettings();
  saveSettings();
}

function clearLog(id) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = '';
    // Add a subtle animation when clearing
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = t('logCleared');
      el.style.opacity = '1';
    }, 300);
  }
}

// === MQTT Configuration ===
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
    alert(t('invalidCredentials'));
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
    logToAll(t('connected'));
    client.subscribe(topic, () => logToAll(t('subscribed') + topic));
  });

  client.on("error", (err) => {
    logToAll(t('mqttError') + err.message);
    client.end();
  });

  client.on("reconnect", () => logToAll(t('reconnecting')));

  client.on("message", (topic, message) => {
    const msg = message.toString();
    log("terminal-log", `[RECV] ${msg}`, "general", msg);

    if (msg.startsWith("COMMAND:") || msg.startsWith("E")) {
      log("command-log", msg, "command", msg);
      document.getElementById("command-sound")?.play();
    } else {
      log("general-log", msg, "general", msg);
    }

    if (msg.toLowerCase().includes("alert")) {
      log("alert-log", msg, "alert", msg);
      document.getElementById("alert-sound")?.play();
    }

    updateStatusPanel(msg);
  });
}

function updateStatusPanel(msg) {
  if (msg.includes("UP")) document.getElementById("status-direction").textContent = t('up');
  if (msg.includes("DOWN")) document.getElementById("status-direction").textContent = t('down');
  if (msg.includes("IDLE")) document.getElementById("status-direction").textContent = t('idle');

  if (msg.includes("POS:")) {
    const pos = msg.split("POS:")[1].split(" ")[0];
    document.getElementById("status-position").textContent = pos;
  }

  if (msg.includes("TARGET:")) {
    const tgt = msg.split("TARGET:")[1].split(" ")[0];
    document.getElementById("status-target").textContent = tgt;
  }

  if (msg.includes("LIMIT_TOP")) document.getElementById("limit-top").textContent = t('active');
  if (msg.includes("LIMIT_BOTTOM")) document.getElementById("limit-bottom").textContent = t('active');

  if (msg.includes("DOOR_OPEN")) document.getElementById("door-sensor").textContent = t('open');
  if (msg.includes("DOOR_CLOSED")) document.getElementById("door-sensor").textContent = t('closed');

  if (msg.includes("EMERGENCY")) document.getElementById("emergency-stop").textContent = t('triggered');
  if (msg.includes("NORMAL")) document.getElementById("emergency-stop").textContent = t('inactive');

  if (msg.includes("ALARM")) {
    const alarm = msg.split("ALARM:")[1] || t('none');
    document.getElementById("active-alarms").textContent = alarm;
  }
}

function log(id, text, type = "general", rawCommand = null) {
  const timestamp = new Date();
  const lang = document.getElementById("language-selector")?.value || "en";
  const translated = `[${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString()}] ${translatePrefix(text, lang)}`;
  const el = document.getElementById(id);
  if (el) {
    el.textContent += translated + "\n";
    el.scrollTop = el.scrollHeight;
  }

  db.collection("logs").add({
    type,
    tab: id,
    message: text,
    timestamp,
    lang,
    command: rawCommand || ""
  }).catch(err => {
    console.error("❌ Firestore write failed:", err);
  });
}

function logToAll(text) {
  ["general-log", "command-log", "alert-log"].forEach(id => log(id, text));
}

function translatePrefix(text, lang) {
  const map = {
    en: { '[SEND]': '[SEND]', '[RECV]': '[RECV]', '[WARN]': '[WARN]' },
    es: { '[SEND]': '[ENVIADO]', '[RECV]': '[RECIBIDO]', '[WARN]': '[AVISO]' },
    zh: { '[SEND]': '[发送]', '[RECV]': '[接收]', '[WARN]': '[警告]' },
    hi: { '[SEND]': '[भेजा गया]', '[RECV]': '[प्राप्त]', '[WARN]': '[चेतावनी]' },
    ar: { '[SEND]': '[مرسل]', '[RECV]': '[مستلم]', '[WARN]': '[تحذير]' },
    bn: { '[SEND]': '[প্রেরিত]', '[RECV]': '[গৃহীত]', '[WARN]': '[সতর্কতা]' },
    pt: { '[SEND]': '[ENVIADO]', '[RECV]': '[RECEBIDO]', '[WARN]': '[AVISO]' },
    ru: { '[SEND]': '[ОТПРАВ]', '[RECV]': '[ПРИНЯТ]', '[WARN]': '[ПРЕД]' },
    ja: { '[SEND]': '[送信]', '[RECV]': '[受信]', '[WARN]': '[警告]' },
    de: { '[SEND]': '[GESENDET]', '[RECV]': '[EMPFANGEN]', '[WARN]': '[WARNUNG]' }
  };
  const dictionary = map[lang] || map.en;
  for (const prefix in dictionary) {
    if (text.includes(prefix)) {
      return text.replace(prefix, dictionary[prefix]);
    }
  }
  return text;
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.add("hidden");
  });
  document.getElementById(`${tabId}-tab`)?.classList.remove("hidden");
}
