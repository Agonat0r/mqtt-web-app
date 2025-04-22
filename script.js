// === Full script.js with Firestore logging, timestamps, translations, and MQTT handling ===
import translations from './translations.js';

/**
 * Initializes the application when the DOM is fully loaded.
 * Sets up event handlers, loads settings, applies UI customizations,
 * updates text translations, but does NOT connect to MQTT until login.
 */
document.addEventListener('DOMContentLoaded', () => {
  initializeEventHandlers();
  loadSettings();
  applySettings();
  updateAllText();
  // MQTT connection happens after login
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
      handleLogin(event);
      break;
    case 'switch-tab':
      handleTabSwitch(event);
      break;
    case 'clear-log':
      const targetId = target.getAttribute('data-target');
      clearTerminal(targetId);
      break;
    case 'export-log':
      const exportId = target.getAttribute('data-target');
      exportLog(exportId);
      break;
    case 'email-log':
      const emailId = target.getAttribute('data-target');
      showEmailModal(emailId);
      break;
    case 'send-email':
      sendLogEmail();
      break;
    case 'close-modal':
      closeEmailModal();
      break;
    case 'switch-language':
      switchLanguage(event);
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
function switchLanguage(event) {
  const lang = event.target.value;
  currentLang = lang;
  currentSettings.language = lang;
  saveSettings();
  updateAllText();
  showMessage(t('languageChanged'), 'success');
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
    
    currentLang = currentSettings.language || 'en';
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

// CA Certificate for MQTT WSS Connection
const ca_cert = `-----BEGIN CERTIFICATE-----
MIIDrzCCApegAwIBAgIQCDvgVpBCRrGhdWrJWZHHSjANBgkqhkiG9w0BAQUFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBD
QTAeFw0wNjExMTAwMDAwMDBaFw0zMTExMTAwMDAwMDBaMGExCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j
b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IENBMIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4jvhEXLeqKTTo1eqUKKPC3eQyaKl7hLOllsB
CSDMAZOnTjC3U/dDxGkAV53ijSLdhwZAAIEJzs4bg7/fzTtxRuLWZscFs3YnFo97
nh6Vfe63SKMI2tavegw5BmV/Sl0fvBf4q77uKNd0f3p4mVmFaG5cIzJLv07A6Fpt
43C/dxC//AH2hdmoRBBYMql1GNXRor5H4idq9Joz+EkIYIvUX7Q6hL+hqkpMfT7P
T19sdl6gSzeRntwi5m3OFBqOasv+zbMUZBfHWymeMr/y7vrTC0LUq7dBMtoM1O/4
gdW7jVg/tRvoSSiicNoxBN33shbyTApOB6jtSj1etX+jkMOvJwIDAQABo2MwYTAO
BgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUA95QNVbR
TLtm8KPiGxvDl7I90VUwHwYDVR0jBBgwFoAUA95QNVbRTLtm8KPiGxvDl7I90VUw
DQYJKoZIhvcNAQEFBQADggEBAMucN6pIExIK+t1EnE9SsPTfrgT1eXkIoyQY/Esr
hMAtudXH/vTBH1jLuG2cenTnmCmrEbXjcKChzUyImZOMkXDiqw8cvpOp/2PV5Adg
06O/nVsJ8dWO41P0jmP6P6fbtGbfYmbW0W5BjfIttep3Sp+dWOIrWcBAI+0tKIJF
PnlUkiaY4IBIqDfv8NZ5YBberOgOzW6sRBc4L0na4UU+Krk2U886UAb3LujEV0ls
YSEY1QSteDwsOoBrp+uvFRTp2InBuThs4pFsiv9kuXclVzDAGySj4dzp30d8tbQk
CAUw7C29C79Fv1C5qfPrmAESrciIxpg0X40KPMbp1ZWVbd4=
-----END CERTIFICATE-----`;

// DOM Elements
const loginContainer = document.querySelector('.login-container');
const mainApp = document.querySelector('#main-app');
const tabSelector = document.querySelector('.tab-selector');
const tabContents = document.querySelectorAll('.tab-content');
const generalTerminal = document.querySelector('#general-terminal');
const commandTerminal = document.querySelector('#command-terminal');
const terminalInput = document.querySelector('#terminal-input');

// Initialize MQTT Client
function initializeMQTTClient() {
    client = mqtt.connect(brokerHost, {
        username: 'Carlos',
        password: 'mqtt2025',
        clientId: 'mqtt-dashboard-' + Math.random().toString(16).substr(2, 8),
        clean: true,
        reconnectPeriod: 4000,
        connectTimeout: 30000,
        ca: ca_cert
    });

    setupMQTTEventHandlers();
}

// Setup MQTT Event Handlers
function setupMQTTEventHandlers() {
    client.on('connect', () => {
        console.log('Connected to MQTT broker');
        updateConnectionStatus('connected');
        client.subscribe(topic, (err) => {
            if (err) {
                console.error('Subscription error:', err);
                logToTerminal('Error subscribing to topic: ' + err.message, 'error');
            } else {
                logToTerminal('Subscribed to topic: ' + topic, 'success');
            }
        });
    });

    client.on('message', (topic, message) => {
        try {
            const payload = JSON.parse(message.toString());
            handleMQTTMessage(payload);
        } catch (e) {
            logToTerminal('Error parsing message: ' + e.message, 'error');
        }
    });

    client.on('error', (err) => {
        console.error('MQTT Error:', err);
        updateConnectionStatus('error');
        logToTerminal('MQTT Error: ' + err.message, 'error');
    });

    client.on('close', () => {
        console.log('Connection closed');
        updateConnectionStatus('disconnected');
        logToTerminal('Connection closed', 'warning');
    });

    client.on('reconnect', () => {
        console.log('Attempting to reconnect...');
        updateConnectionStatus('connecting');
        logToTerminal('Attempting to reconnect...', 'info');
    });
}

// Handle MQTT Messages
function handleMQTTMessage(payload) {
    switch (payload.type) {
        case 'telemetry':
            updateTelemetryData(payload.data);
            logToTerminal('Telemetry: ' + JSON.stringify(payload.data), 'info');
            break;
        case 'status':
            updateStatusData(payload.data);
            logToTerminal('Status: ' + JSON.stringify(payload.data), 'info');
            break;
        case 'command':
            logToCommandTerminal('Command: ' + JSON.stringify(payload.data), 'command');
            break;
        case 'alert':
            handleAlert(payload.data);
            break;
        default:
            logToTerminal('Unknown message type: ' + payload.type, 'warning');
    }
}

// Update Connection Status
function updateConnectionStatus(status) {
    const statusIndicator = document.querySelector('.status-indicator');
    if (!statusIndicator) return;

    statusIndicator.className = 'status-indicator';
    statusIndicator.classList.add('status-' + status);
    
    const statusText = {
        connected: 'Connected',
        disconnected: 'Disconnected',
        connecting: 'Connecting...',
        error: 'Connection Error'
    };
    
    statusIndicator.textContent = statusText[status] || status;
}

// Log to Terminal
function logToTerminal(message, type = 'info') {
    if (!generalTerminal) return;

    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry ' + type;
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    generalTerminal.appendChild(logEntry);
    generalTerminal.scrollTop = generalTerminal.scrollHeight;
}

// Log to Command Terminal
function logToCommandTerminal(message, type = 'command') {
    if (!commandTerminal) return;

    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry ' + type;
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    commandTerminal.appendChild(logEntry);
    commandTerminal.scrollTop = commandTerminal.scrollHeight;
}

// Clear Terminal
function clearTerminal(terminalId) {
    const terminal = document.getElementById(terminalId);
    if (terminal) {
        terminal.innerHTML = '';
    }
}

// Handle Login
function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    if (username === 'admin' && password === 'admin') {
        loggedIn = true;
        loginContainer.classList.add('hidden');
        mainApp.classList.remove('hidden');
        initializeMQTTClient();
    } else {
        alert('Invalid credentials. Please try again.');
    }
}

// Handle Tab Switching
function handleTabSwitch(event) {
    const selectedTab = event.target.value;
    tabContents.forEach(content => {
        if (content.id === selectedTab) {
            content.classList.remove('hidden');
        } else {
            content.classList.add('hidden');
        }
    });
}

// Send Command
function sendCommand(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const command = terminalInput.value.trim();
        
        if (command) {
            const payload = {
                type: 'command',
                data: { command: command }
            };
            
            client.publish(topic, JSON.stringify(payload), (err) => {
                if (err) {
                    logToCommandTerminal('Error sending command: ' + err.message, 'error');
                } else {
                    logToCommandTerminal('Command sent: ' + command, 'success');
                }
            });
            
            terminalInput.value = '';
        }
    }
}

// Update Status Data
function updateStatusData(data) {
    const statusGrid = document.querySelector('.status-grid');
    if (!statusGrid) return;

    // Clear existing status cards
    statusGrid.innerHTML = '';

    // Create new status cards
    Object.entries(data).forEach(([key, value]) => {
        const card = document.createElement('div');
        card.className = 'status-card';
        card.innerHTML = `
            <h3>${key}</h3>
            <p>${value}</p>
        `;
        statusGrid.appendChild(card);
    });
}

// Update Telemetry Data
function updateTelemetryData(data) {
    const telemetryGrid = document.querySelector('.telemetry-grid');
    if (!telemetryGrid) return;

    // Clear existing telemetry cards
    telemetryGrid.innerHTML = '';

    // Create new telemetry cards
    Object.entries(data).forEach(([key, value]) => {
        const card = document.createElement('div');
        card.className = 'telemetry-card';
        card.innerHTML = `
            <h3>${key}</h3>
            <p>${typeof value === 'object' ? JSON.stringify(value) : value}</p>
        `;
        telemetryGrid.appendChild(card);
    });
}

// Handle Alert
function handleAlert(data) {
    logToTerminal('Alert: ' + JSON.stringify(data), 'alert');
    // You can add additional alert handling here, such as showing a notification
}

// Event Listeners
document.getElementById('login-form').addEventListener('submit', handleLogin);
tabSelector.addEventListener('change', handleTabSwitch);
terminalInput.addEventListener('keypress', sendCommand);

// Clear log buttons
document.querySelectorAll('[data-action="clear-log"]').forEach(button => {
    button.addEventListener('click', () => {
        const terminalId = button.getAttribute('data-target');
        clearTerminal(terminalId);
    });
});

// Export log buttons
document.querySelectorAll('[data-action="export-log"]').forEach(button => {
    button.addEventListener('click', () => {
        const terminalId = button.getAttribute('data-target');
        const terminal = document.getElementById(terminalId);
        if (!terminal) return;

        const logContent = terminal.innerText;
        const blob = new Blob([logContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${terminalId}-${new Date().toISOString()}.log`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    });
});

// Initialize EmailJS
emailjs.init("7osg1XmfdRC2z68Xt");

/**
 * Shows the email modal for sending logs
 * @param {string} targetId - The ID of the log to email
 */
function showEmailModal(targetId) {
    const modal = document.getElementById('emailModal');
    modal.classList.remove('hidden');
    modal.dataset.targetLog = targetId;
}

/**
 * Closes the email modal
 */
function closeEmailModal() {
    const modal = document.getElementById('emailModal');
    modal.classList.add('hidden');
    document.getElementById('emailInput').value = '';
}

/**
 * Sends the log content via email
 */
async function sendLogEmail() {
    const modal = document.getElementById('emailModal');
    const targetId = modal.dataset.targetLog;
    const emailInput = document.getElementById('emailInput');
    const terminal = document.getElementById(targetId);
    
    if (!terminal || !emailInput.value) return;

    try {
        await emailjs.send("service_lsa1r4i", "template_vnrbr1d", {
            to_email: emailInput.value,
            log_content: terminal.innerText,
            log_type: targetId
        });
        
        showMessage(t('emailSent'), 'success');
        closeEmailModal();
    } catch (error) {
        console.error('Email error:', error);
        showMessage(t('emailError'), 'error');
    }
}

/**
 * Shows a temporary message to the user
 * @param {string} message - The message to show
 * @param {string} type - The type of message ('success' or 'error')
 */
function showMessage(message, type = 'success') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `${type}-message`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// Update the exportLog function:

function exportLog(targetId) {
    const terminal = document.getElementById(targetId);
    if (!terminal) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${targetId}-${timestamp}.log`;
    const logContent = terminal.innerText;
    
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    showMessage(t('logExported'), 'success');
}
