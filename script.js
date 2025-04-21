// === Full script.js with Firestore logging, timestamps, translations, and MQTT handling ===
import translations from './translations.js';

// Initialize event handlers
document.addEventListener('DOMContentLoaded', () => {
  initializeEventHandlers();
  loadSettings();
  applySettings();
  updateAllText();
  mqttHandler.connect();
  
  // Subscribe to VPL topics
  ['vpl/status', 'vpl/telemetry', 'vpl/alerts'].forEach(topic => {
    mqttHandler.subscribe(topic);
  });
});

function initializeEventHandlers() {
  // Use event delegation for all data-action elements
  document.addEventListener('click', handleAction);
  document.addEventListener('change', handleAction);

  // Add input handler for terminal
  const terminalInput = document.getElementById('terminal-input');
  if (terminalInput) {
    terminalInput.addEventListener('keydown', handleTerminalInput);
  }
}

function handleAction(event) {
  const target = event.target;
  const action = target.getAttribute('data-action');
  if (!action) return;

  switch (action) {
    case 'login':
      handleLogin();
      break;
    case 'switch-tab':
      switchTab(target.value);
      break;
    case 'apply-theme':
      applyTheme();
      break;
    case 'apply-font':
      applyFont();
      break;
    case 'apply-borders':
      applyBorders();
      break;
    case 'reset-customizations':
      resetCustomizations();
      break;
    case 'switch-language':
      switchLanguage();
      break;
    case 'send-email':
      sendEmail();
      break;
    case 'export-logs':
      exportLogs();
      break;
    case 'save-logs':
      saveLogsToFile();
      break;
    case 'load-log':
      loadLogFromFile(event);
      break;
    case 'clear-log':
      const logId = target.getAttribute('data-log');
      if (logId) clearLog(logId);
      break;
  }
}

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

// MQTT Handler Class
class MQTTHandler {
  constructor() {
    this.client = null;
    this.config = {
      host: 'broker.hivemq.com',
      port: 8884,
      protocol: 'wss',
      path: '/mqtt',
      clientId: `vpl_dashboard_${Math.random().toString(16).slice(2, 10)}`,
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      keepalive: 60,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000
    };
  }

  connect() {
    try {
      this.client = mqtt.connect(this.config);

      this.client.on('connect', () => {
        this.updateConnectionStatus(true);
        this.client.subscribe('vpl/+/+');
        this.logMessage('Connected to MQTT broker');
      });

      this.client.on('message', (topic, message) => {
        this.handleMessage(topic, message);
        this.updateLastUpdate();
      });

      this.client.on('error', (error) => {
        this.logMessage(`Error: ${error.message}`, 'error');
        this.updateConnectionStatus(false);
      });

      this.client.on('close', () => {
        this.updateConnectionStatus(false);
      });

      this.client.on('reconnect', () => {
        this.logMessage('Reconnecting to MQTT broker...', 'info');
      });

    } catch (error) {
      this.logMessage(`Connection failed: ${error.message}`, 'error');
      this.updateConnectionStatus(false);
    }
  }

  handleMessage(topic, message) {
    try {
      const payload = JSON.parse(message.toString());
      const [device, category, type] = topic.split('/');

      switch (category) {
        case 'telemetry':
          this.updateTelemetry(payload);
          break;
        case 'status':
          this.updateStatus(payload);
          break;
        default:
          this.logMessage(`Received message on ${topic}: ${message.toString()}`);
      }

      // Play sounds for specific message types
      if (message.toString().startsWith("COMMAND:") || message.toString().startsWith("E")) {
        document.getElementById("command-sound")?.play();
      }
      if (message.toString().toLowerCase().includes("alert")) {
        document.getElementById("alert-sound")?.play();
      }

    } catch (error) {
      this.logMessage(`Error handling message: ${error.message}`, 'error');
    }
  }

  updateTelemetry(data) {
    if (data.position !== undefined) {
      elements.position.textContent = `${data.position}mm`;
    }
    if (data.speed !== undefined) {
      elements.speed.textContent = `${data.speed}mm/s`;
    }
    if (data.temperature !== undefined) {
      elements.temperature.textContent = `${data.temperature}°C`;
    }
  }

  updateStatus(data) {
    if (data.state) {
      elements.vplState.textContent = data.state;
      elements.vplState.className = `state-${data.state.toLowerCase()}`;
    }
  }

  updateConnectionStatus(connected) {
    elements.connectionStatus.textContent = connected ? 'Connected' : 'Disconnected';
    elements.connectionStatus.className = `status-indicator ${connected ? 'status-connected' : 'status-disconnected'}`;
    elements.mqttStatus.textContent = connected ? 'Connected' : 'Not Connected';
  }

  updateLastUpdate() {
    elements.lastUpdate.textContent = new Date().toLocaleTimeString();
  }

  logMessage(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.innerHTML = `
      <span class="log-time">${new Date().toLocaleTimeString()}</span>
      <span class="log-message">${message}</span>
    `;
    elements.messageLog.appendChild(logEntry);
    elements.messageLog.scrollTop = elements.messageLog.scrollHeight;
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.updateConnectionStatus(false);
      this.logMessage('Disconnected from MQTT broker');
    }
  }

  subscribe(topic) {
    if (!this.client?.connected) {
      this.client.subscribe(topic, (err) => {
        if (err) {
          console.error(`Failed to subscribe to ${topic}:`, err);
          this.logMessage(`Failed to subscribe to ${topic}: ${err.message}`, 'error');
        } else {
          this.logMessage(`Subscribed to ${topic}`);
        }
      });
    }
  }
}

// UI Elements
const elements = {
  connectionStatus: document.getElementById('connectionStatus'),
  mqttStatus: document.getElementById('mqttStatus'),
  lastUpdate: document.getElementById('lastUpdate'),
  vplState: document.getElementById('vplState'),
  position: document.getElementById('position'),
  speed: document.getElementById('speed'),
  temperature: document.getElementById('temperature'),
  messageLog: document.getElementById('messageLog'),
  clearLog: document.getElementById('clearLog'),
  exportLog: document.getElementById('exportLog'),
  themeSelector: document.getElementById('themeSelector'),
  fontSelector: document.getElementById('fontSelector'),
  borderToggle: document.getElementById('borderToggle'),
  resetCustomizations: document.getElementById('resetCustomizations'),
};

// Initialize MQTT Handler
const mqttHandler = new MQTTHandler();

function handleLogin() {
  const user = document.getElementById("login-username").value;
  const pass = document.getElementById("login-password").value;
  if (user === "Carlos" && pass === "mqtt2025") {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("main-app").classList.remove("hidden");
    mqttHandler.connect();
  } else {
    alert(t('invalidCredentials'));
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

// Event Listeners
elements.clearLog.addEventListener('click', () => {
  elements.messageLog.innerHTML = '';
  mqttHandler.logMessage('Log cleared');
});

elements.exportLog.addEventListener('click', () => {
  const logContent = elements.messageLog.innerText;
  const blob = new Blob([logContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vpl-log-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
