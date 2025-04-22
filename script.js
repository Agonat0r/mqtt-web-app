// === Full script.js with Firestore logging, timestamps, translations, and MQTT handling ===
import translations from './translations.js';

/**
 * Initializes the application when the DOM is fully loaded.
 * Sets up event handlers, loads settings, applies UI customizations,
 * updates text translations, and establishes MQTT connection.
 */
document.addEventListener('DOMContentLoaded', () => {
  initializeEventHandlers();
  loadSettings();
  applySettings();
  updateAllText();
  mqttHandler.connect();
});

/**
 * Sets up all event handlers for the application.
 * Uses event delegation for data-action elements and
 * sets up terminal input handling if available.
 */
function initializeEventHandlers() {
  document.addEventListener('click', handleAction);
  document.addEventListener('change', handleAction);

  const terminalInput = document.getElementById('terminal-input');
  if (terminalInput) {
    terminalInput.addEventListener('keydown', handleTerminalInput);
  }
}

/**
 * Handles all action events through event delegation.
 * Routes different actions to their appropriate handler functions.
 * @param {Event} event - The triggered event object
 */
function handleAction(event) {
  const target = event.target;
  const action = target.getAttribute('data-action');
  if (!action) return;

  // Play click sound for all actions
  document.getElementById('click-sound')?.play().catch(err => console.log('Click sound not loaded yet'));

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

/**
 * Translates a key into the current language.
 * Falls back to English if translation is not found.
 * @param {string} key - The translation key to look up
 * @returns {string} The translated text
 */
function t(key) {
  return translations[currentLang]?.[key] || translations.en[key] || key;
}

/**
 * Updates all text content in the UI to the current language.
 * Handles login screen, navigation, status panel, console tabs,
 * customization panel, and tools panel text.
 */
function updateAllText() {
  // Login screen
  const loginElements = {
    title: document.getElementById('login-title'),
    username: document.getElementById('login-username'),
    password: document.getElementById('login-password'),
    button: document.querySelector('#login-screen button')
  };

  if (loginElements.title) loginElements.title.textContent = t('loginTitle');
  if (loginElements.username) loginElements.username.placeholder = t('username');
  if (loginElements.password) loginElements.password.placeholder = t('password');
  if (loginElements.button) loginElements.button.textContent = t('loginButton');

  // Navigation
  const navTitle = document.querySelector('.nav-title');
  if (navTitle) navTitle.textContent = t('dashboard');
  
  // Update tab selector options
  const tabSelector = document.querySelector('.nav-tabs select');
  if (tabSelector) {
    tabSelector.innerHTML = `
      <option value="status">${t('status')}</option>
      <option value="general">${t('general')}</option>
      <option value="commands">${t('commands')}</option>
      <option value="alerts">${t('alerts')}</option>
      <option value="customization">${t('customization')}</option>
    `;
  }

  // Status panel
  const statusTitle = document.getElementById('status-title');
  if (statusTitle) statusTitle.textContent = t('liftSystemStatus');

  // Update status section labels
  document.querySelectorAll('.status-section p').forEach(p => {
    const label = p.querySelector('span:first-child');
    if (label) {
      const key = label.textContent.replace(':', '').toLowerCase();
      label.textContent = t(key) + ':';
    }
  });

  // Console tabs
  const consoleElements = {
    general: document.getElementById('general-title'),
    terminal: document.getElementById('terminal-input'),
    commands: document.getElementById('commands-title'),
    alerts: document.getElementById('alerts-title')
  };

  if (consoleElements.general) consoleElements.general.textContent = t('generalConsole');
  if (consoleElements.terminal) consoleElements.terminal.placeholder = t('typeCommand');
  if (consoleElements.commands) consoleElements.commands.textContent = t('commandConsole');
  if (consoleElements.alerts) consoleElements.alerts.textContent = t('alertConsole');

  // Customization panel
  const customElements = {
    title: document.getElementById('customization-title'),
    themeLabel: document.querySelector('label[for="themeSelector"]'),
    fontLabel: document.querySelector('label[for="fontSelector"]'),
    borderLabel: document.querySelector('label[for="borderToggle"]'),
    resetButton: document.querySelector('#resetCustomizations')
  };

  if (customElements.title) customElements.title.textContent = t('customization');
  if (customElements.themeLabel) customElements.themeLabel.textContent = t('theme') + ':';
  if (customElements.fontLabel) customElements.fontLabel.textContent = t('font') + ':';
  if (customElements.borderLabel) customElements.borderLabel.textContent = t('showBorders');
  if (customElements.resetButton) customElements.resetButton.textContent = t('reset');

  // Update theme selector options
  const themeSelector = document.getElementById('themeSelector');
  if (themeSelector) {
    themeSelector.innerHTML = `
      <option value="default">${t('themeDefault')}</option>
      <option value="dark">${t('themeDark')}</option>
      <option value="usf">${t('themeUsf')}</option>
    `;
  }

  // Update font selector options
  const fontSelector = document.getElementById('fontSelector');
  if (fontSelector) {
    fontSelector.innerHTML = `
      <option value="default">${t('fontDefault')}</option>
      <option value="monospace">${t('fontMonospace')}</option>
      <option value="sans-serif">${t('fontSansSerif')}</option>
    `;
  }

  // Update initial log messages
  const logs = {
    general: document.getElementById('messageLog'),
    terminal: document.getElementById('terminal-log'),
    command: document.getElementById('command-log'),
    alert: document.getElementById('alert-log')
  };

  if (logs.general && logs.general.textContent.includes('Waiting for messages')) {
    logs.general.textContent = t('waitingMessages');
  }
  if (logs.terminal && logs.terminal.textContent.includes('[Terminal Initialized]')) {
    logs.terminal.textContent = t('terminalInitialized');
  }
  if (logs.command && logs.command.textContent.includes('Waiting for commands')) {
    logs.command.textContent = t('waitingCommands');
  }
  if (logs.alert && logs.alert.textContent.includes('Waiting for alerts')) {
    logs.alert.textContent = t('waitingAlerts');
  }
}

/**
 * Switches the application language and updates the UI.
 * Saves the new language preference to settings.
 */
function switchLanguage() {
  const lang = document.getElementById('language-selector').value;
  currentLang = lang;
  currentSettings.language = lang;
  saveSettings();
  updateAllText();
}

/**
 * Loads saved settings from localStorage and updates UI elements.
 * Includes null checks for all UI elements.
 */
function loadSettings() {
  const saved = localStorage.getItem(SETTINGS_KEY);
  if (saved) {
    currentSettings = { ...currentSettings, ...JSON.parse(saved) };
    
    const themeSelector = document.getElementById('theme-selector');
    const fontSelector = document.getElementById('font-selector');
    const borderToggle = document.getElementById('border-toggle');
    const languageSelector = document.getElementById('language-selector');

    if (themeSelector) themeSelector.value = currentSettings.theme;
    if (fontSelector) fontSelector.value = currentSettings.font;
    if (borderToggle) borderToggle.checked = currentSettings.showBorders;
    if (languageSelector) languageSelector.value = currentSettings.language;
    
    currentLang = currentSettings.language;
  }
}

/**
 * Saves current settings to localStorage.
 */
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
}

/**
 * Applies all current settings to the UI.
 * Includes theme, font, and border settings.
 */
function applySettings() {
  applyTheme();
  applyFont();
  applyBorders();
}

/**
 * Applies the selected theme to the application.
 * Updates body classes and saves the setting.
 */
function applyTheme() {
  const themeSelector = document.getElementById('themeSelector');
  if (!themeSelector) return;
  
  const theme = themeSelector.value;
  document.body.classList.remove('dark-mode', 'usf-mode');
  
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
  } else if (theme === 'usf') {
    document.body.classList.add('usf-mode');
  }
  
  currentSettings.theme = theme;
  saveSettings();
}

/**
 * Applies the selected font to the application.
 * Updates body font-family and saves the setting.
 */
function applyFont() {
  const fontSelector = document.getElementById('fontSelector');
  if (!fontSelector) return;
  
  const font = fontSelector.value;
  const fontMap = {
    'default': "'Segoe UI', sans-serif",
    'monospace': "'Courier New', monospace",
    'sans-serif': "Arial, sans-serif"
  };
  
  document.body.style.fontFamily = fontMap[font] || fontMap.default;
  currentSettings.font = font;
  saveSettings();
}

/**
 * Toggles border visibility on UI elements.
 * Updates element classes and saves the setting.
 */
function applyBorders() {
  const borderToggle = document.getElementById('borderToggle');
  if (!borderToggle) return;
  
  const showBorders = borderToggle.checked;
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

/**
 * Resets all customization settings to their defaults.
 * Updates UI elements and saves the default settings.
 */
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

/**
 * Clears the specified log with an animation effect.
 * @param {string} id - The ID of the log element to clear
 */
function clearLog(id) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = '';
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = t('logCleared');
      el.style.opacity = '1';
    }, 300);
  }
}

// MQTT Configuration
let brokerHost = "wss://lb88002c.ala.us-east-1.emqxsl.com:8084/mqtt";
let topic = "usf/messages";
let client;
let loggedIn = false;

/**
 * MQTT Handler Class
 * Manages all MQTT connections, subscriptions, and message handling.
 */
class MQTTHandler {
  /**
   * Initializes a new MQTT handler with configuration.
   */
  constructor() {
    this.client = null;
    this.config = {
      // Using WebSocket connection
      protocol: 'wss',
      hostname: 'lb88002c.ala.us-east-1.emqxsl.com',
      port: 8084,
      path: '/mqtt',
      clientId: `vpl_dashboard_${Math.random().toString(16).slice(2, 10)}`,
      username: 'usf-harmar',
      password: 'harmar2025',
      keepalive: 60,
      clean: true,
      reconnectPeriod: 4000,
      connectTimeout: 30 * 1000,
      rejectUnauthorized: false
    };
  }

  /**
   * Establishes connection to the MQTT broker and sets up event handlers.
   */
  connect() {
    try {
      // Use the brokerHost directly for connection
      this.client = mqtt.connect(brokerHost, {
        clientId: this.config.clientId,
        username: this.config.username,
        password: this.config.password,
        keepalive: this.config.keepalive,
        clean: this.config.clean,
        reconnectPeriod: this.config.reconnectPeriod,
        connectTimeout: this.config.connectTimeout,
        rejectUnauthorized: this.config.rejectUnauthorized
      });

      this.client.on('connect', () => {
        this.updateConnectionStatus(true);
        this.logMessage('Connected to EMQX broker');
        
        // Subscribe to the authorized topic
        this.client.subscribe(topic, (err) => {
          if (err) {
            this.logMessage(`Subscription error: ${err.message}`, 'error');
          } else {
            this.logMessage(`Subscribed to ${topic}`);
          }
        });
      });

      this.client.on('message', (receivedTopic, message) => {
        try {
          const payload = JSON.parse(message.toString());
          
          // Check message type from payload
          if (payload.type === 'telemetry') {
            this.updateTelemetry(payload.data);
          } else if (payload.type === 'status') {
            this.updateStatus(payload.data);
          }

          this.logMessage(`Received on ${receivedTopic}: ${message.toString()}`);
          this.updateLastUpdate();
        } catch (error) {
          this.logMessage(`Error handling message: ${error.message}`, 'error');
        }
      });

      this.client.on('error', (error) => {
        this.logMessage(`MQTT Error: ${error.message}`, 'error');
        this.updateConnectionStatus(false);
      });

      this.client.on('close', () => {
        this.logMessage('Connection closed', 'warn');
        this.updateConnectionStatus(false);
      });

      this.client.on('reconnect', () => {
        this.logMessage('Attempting to reconnect...', 'info');
      });

    } catch (error) {
      this.logMessage(`Connection failed: ${error.message}`, 'error');
      this.updateConnectionStatus(false);
    }
  }

  /**
   * Updates telemetry data in the UI.
   * @param {Object} data - The telemetry data object
   */
  updateTelemetry(data) {
    if (data.position !== undefined && elements.position) {
      elements.position.textContent = `${data.position}mm`;
    }
    if (data.speed !== undefined && elements.speed) {
      elements.speed.textContent = `${data.speed}mm/s`;
    }
    if (data.temperature !== undefined && elements.temperature) {
      elements.temperature.textContent = `${data.temperature}°C`;
    }
  }

  /**
   * Updates VPL status in the UI.
   * @param {Object} data - The status data object
   */
  updateStatus(data) {
    if (data.state && elements.vplState) {
      elements.vplState.textContent = data.state;
      elements.vplState.className = `state-${data.state.toLowerCase()}`;
    }
  }

  /**
   * Updates connection status indicators in the UI.
   * @param {boolean} connected - Whether the client is connected
   */
  updateConnectionStatus(connected) {
    if (elements.connectionStatus) {
      elements.connectionStatus.textContent = connected ? 'Connected' : 'Disconnected';
      elements.connectionStatus.className = `status-indicator ${connected ? 'status-connected' : 'status-disconnected'}`;
    }
    if (elements.mqttStatus) {
      elements.mqttStatus.textContent = connected ? 'Connected' : 'Not Connected';
    }
  }

  /**
   * Updates the last update timestamp in the UI.
   */
  updateLastUpdate() {
    if (elements.lastUpdate) {
      elements.lastUpdate.textContent = new Date().toLocaleTimeString();
    }
  }

  /**
   * Adds a message to the message log with timestamp.
   * @param {string} message - The message to log
   * @param {string} type - The type of message (info, error, etc.)
   */
  logMessage(message, type = 'info') {
    if (!elements.messageLog) return;
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.innerHTML = `
      <span class="log-time">${new Date().toLocaleTimeString()}</span>
      <span class="log-message">${message}</span>
    `;
    elements.messageLog.appendChild(logEntry);
    elements.messageLog.scrollTop = elements.messageLog.scrollHeight;
  }

  /**
   * Disconnects from the MQTT broker.
   */
  disconnect() {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.updateConnectionStatus(false);
      this.logMessage('Disconnected from MQTT broker');
    }
  }

  /**
   * Subscribes to an MQTT topic.
   * @param {string} topic - The topic to subscribe to
   */
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

// UI Elements object with null checks
const elements = {
  connectionStatus: document.getElementById('connectionStatus') || null,
  mqttStatus: document.getElementById('mqttStatus') || null,
  lastUpdate: document.getElementById('lastUpdate') || null,
  vplState: document.getElementById('vplState') || null,
  position: document.getElementById('position') || null,
  speed: document.getElementById('speed') || null,
  temperature: document.getElementById('temperature') || null,
  messageLog: document.getElementById('messageLog') || null,
  clearLog: document.getElementById('clearLog') || null,
  exportLog: document.getElementById('exportLog') || null,
  themeSelector: document.getElementById('themeSelector') || null,
  fontSelector: document.getElementById('fontSelector') || null,
  borderToggle: document.getElementById('borderToggle') || null,
  resetCustomizations: document.getElementById('resetCustomizations') || null,
};

// Initialize MQTT Handler
const mqttHandler = new MQTTHandler();

/**
 * Handles user login authentication.
 * Validates credentials and shows/hides appropriate screens.
 */
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

/**
 * Logs a message to specified log and Firestore.
 * @param {string} id - The ID of the log element
 * @param {string} text - The message text
 * @param {string} type - The type of log entry
 * @param {string|null} rawCommand - The raw command if applicable
 */
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

/**
 * Logs a message to all available logs.
 * @param {string} text - The message to log
 */
function logToAll(text) {
  ["general-log", "command-log", "alert-log"].forEach(id => log(id, text));
}

/**
 * Translates message prefixes based on language.
 * @param {string} text - The text containing prefixes to translate
 * @param {string} lang - The target language
 * @returns {string} The text with translated prefixes
 */
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

/**
 * Switches between different tabs in the UI.
 * @param {string} tabId - The ID of the tab to switch to
 */
function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.add("hidden");
  });
  document.getElementById(`${tabId}-tab`)?.classList.remove("hidden");
}

// Event Listeners with null checks
if (elements.clearLog) {
  elements.clearLog.addEventListener('click', () => {
    if (elements.messageLog) {
      elements.messageLog.innerHTML = '';
      mqttHandler.logMessage('Log cleared');
    }
  });
}

if (elements.exportLog) {
  elements.exportLog.addEventListener('click', () => {
    if (!elements.messageLog) return;
    
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
}
