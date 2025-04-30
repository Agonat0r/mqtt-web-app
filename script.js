// === Full script.js with Firestore logging, timestamps, translations, and MQTT handling ===
import { translations } from './translations.js';

// Initialize EmailJS
(function() {
    emailjs.init("7osg1XmfdRC2z68Xt"); // Replace with your actual EmailJS public key
})();

// Global state
let loggedIn = false;
let currentLang = 'en';

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
    terminalInput.addEventListener('keydown', sendCommand);
  }

  // Add handler for test email button
  const testEmailButton = document.querySelector('#testEmailBtn');
  if (testEmailButton) {
    testEmailButton.addEventListener('click', sendTestEmail);
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
      clearLog(targetId);
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

// Collections
const emailCollection = db.collection('emailSubscribers');
const alertsCollection = db.collection('alerts');

// Function to save alert to Firebase
async function saveAlertToFirebase(type, message) {
    try {
        await alertsCollection.add({
            type: type,
            message: message,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('Alert saved to Firebase');
    } catch (error) {
        console.error('Error saving alert to Firebase:', error);
    }
}

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
 * Ensures every text element in the application is translated.
 */
function updateAllText() {
    const currentLang = localStorage.getItem('language') || 'en';
    const texts = translations[currentLang];

    // Update all elements with data-translate attribute
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (texts[key]) {
            if (element.tagName === 'INPUT' && element.type === 'text') {
                element.placeholder = texts[key];
            } else if (element.tagName === 'SELECT') {
                Array.from(element.options).forEach(option => {
                    const optionKey = option.getAttribute('data-translate');
                    if (optionKey && texts[optionKey]) {
                        option.textContent = texts[optionKey];
                    }
                });
            } else {
                element.textContent = texts[key];
            }
        }
    });

    // Login screen
    updateElementText('login-title', 'loginTitle');
    updateElementPlaceholder('login-username', 'username');
    updateElementPlaceholder('login-password', 'password');
    updateElementText('[data-action="login"]', 'loginButton');

    // Navigation
    updateElementText('.nav-title', 'dashboard');
    
    // Status section
    updateElementText('#status-title', 'liftSystemStatus');
    updateElementText('#mqttStatus', translations[currentLang].notConnected);
    updateElementText('#lastUpdate', translations[currentLang].never);
    updateElementText('#vplState', translations[currentLang].unknown);

    // Terminal sections
    updateElementText('#general-title', 'generalConsole');
    updateElementText('#commands-title', 'commandConsole');
    updateElementText('#alerts-title', 'alertConsole');
    updateElementPlaceholder('#terminal-input', 'typeCommand');

    // Customization section
    updateElementText('#customization-title', 'customization');
    updateElementText('label[for="themeSelector"]', 'theme');
    updateElementText('label[for="fontSelector"]', 'font');
    updateElementText('label[for="borderToggle"]', 'showBorders');
    updateElementText('#resetCustomizations', 'reset');

    // Update all buttons
    document.querySelectorAll('[data-action="clear-log"]').forEach(btn => 
        btn.textContent = translations[currentLang].clearLog);
    document.querySelectorAll('[data-action="export-log"]').forEach(btn => 
        btn.textContent = translations[currentLang].exportLog);
    document.querySelectorAll('[data-action="email-log"]').forEach(btn => 
        btn.textContent = translations[currentLang].emailLog);

    // Update selectors
    updateSelector('themeSelector', {
        'default': 'themeDefault',
        'dark': 'themeDark',
        'usf': 'themeUsf'
    });

    updateSelector('fontSelector', {
        'default': 'fontDefault',
        'monospace': 'fontMonospace',
        'sans-serif': 'fontSansSerif'
    });

    // Update language selector
    const languageSelector = document.getElementById('languageSelector');
    if (languageSelector) {
        languageSelector.innerHTML = `
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
        `;
        languageSelector.value = currentLang;
    }

    // Update initial terminal messages if empty
    updateInitialTerminalMessages();
}

/**
 * Helper function to update element text content
 */
function updateElementText(selector, key) {
    const element = typeof selector === 'string' ? 
        document.querySelector(selector) : selector;
    if (element && translations[currentLang]?.[key]) {
        element.textContent = translations[currentLang][key];
    }
}

/**
 * Helper function to update input placeholder text
 */
function updateElementPlaceholder(selector, key) {
    const element = typeof selector === 'string' ? 
        document.getElementById(selector) : selector;
    if (element && translations[currentLang]?.[key]) {
        element.placeholder = translations[currentLang][key];
    }
}

/**
 * Helper function to update select options
 */
function updateSelector(id, options) {
    const selector = document.getElementById(id);
    if (selector) {
        Object.entries(options).forEach(([value, key]) => {
            const option = selector.querySelector(`option[value="${value}"]`);
            if (option) {
                option.textContent = translations[currentLang][key];
            }
        });
    }
}

/**
 * Updates initial terminal messages if they're in their default state
 */
function updateInitialTerminalMessages() {
    const terminals = {
        messageLog: 'waitingMessages',
        'command-log': 'waitingCommands',
        'alert-log': 'waitingAlerts'
    };

    Object.entries(terminals).forEach(([id, key]) => {
        const terminal = document.getElementById(id);
        if (terminal && (
            terminal.textContent.includes('Waiting for') || 
            terminal.textContent.trim() === ''
        )) {
            terminal.textContent = translations[currentLang][key];
        }
    });
}

/**
 * Switches the application language and updates the UI.
 * Saves the new language preference to settings.
 */
function switchLanguage(event) {
  const lang = event.target.value;
  if (!translations[lang]) {
    console.error('Translation not found for language:', lang);
    return;
  }
  
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
  console.log('Applying theme:', theme);
  
  // Remove all theme classes first
  document.body.classList.remove('theme-default', 'theme-dark', 'theme-usf');
  
  // Apply the selected theme class
  document.body.classList.add('theme-' + theme);
  
  // Update status cards background for better visibility in different themes
  const statusCards = document.querySelectorAll('.status-card, .telemetry-card');
  statusCards.forEach(card => {
    card.classList.remove('theme-default', 'theme-dark', 'theme-usf');
    card.classList.add('theme-' + theme);
  });
  
  currentSettings.theme = theme;
  saveSettings();
  
  // Show feedback message
  showMessage(t('themeChanged'), 'success');
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
  if (!el) return;
  
  // Add fade-out animation
  el.style.transition = 'opacity 0.5s ease';
  el.style.opacity = '0';
  
  // After fade out, clear content and show feedback
  setTimeout(() => {
    el.textContent = '';
    
    // Create and add feedback message
    const feedback = document.createElement('div');
    feedback.className = 'log-entry info';
    feedback.innerHTML = `[${new Date().toLocaleTimeString()}] Terminal cleared`;
    
    // Reset opacity and add feedback
    el.style.opacity = '1';
    el.appendChild(feedback);
    
    // Scroll to show feedback
    el.scrollTop = el.scrollHeight;
  }, 500);
}

// Add styles for clear animation
document.head.querySelector('style').textContent += `
  .terminal {
    transition: opacity 0.5s ease;
  }
`;

// MQTT Configuration
const brokerConfig = {
    host: 'lb88002c.ala.us-east-1.emqxsl.com',
    port: 8084,
    path: '/mqtt',
    username: 'Carlos',
    password: 'mqtt2025',
    clientId: 'webClient_' + Math.random().toString(16).substr(2, 8)
};

// Terminal elements
const messageLog = document.getElementById('messageLog');
const commandLog = document.getElementById('command-log');
const terminalInput = document.getElementById('terminal-input');

// Connect to MQTT broker
const client = mqtt.connect(`wss://${brokerConfig.host}:${brokerConfig.port}${brokerConfig.path}`, {
    username: brokerConfig.username,
    password: brokerConfig.password,
    clientId: brokerConfig.clientId,
    clean: true
});

// MQTT connection handling
client.on('connect', () => {
    console.log('Connected to MQTT broker');
    logToTerminal('Connected to MQTT broker', 'success');
    
    // Subscribe to all relevant topics
    const topics = ['usf/messages', 'usf/logs/alerts', 'usf/logs/general', 'usf/logs/command'];
    topics.forEach(topic => {
        client.subscribe(topic, (err) => {
            if (err) {
                console.error('Subscription error for ' + topic + ':', err);
                logToTerminal('Failed to subscribe to ' + topic, 'error');
            } else {
                logToTerminal('Subscribed to ' + topic, 'info');
            }
        });
    });
});

client.on('error', (error) => {
    console.error('MQTT Error:', error);
    logToTerminal('MQTT Error: ' + error.message, 'error');
});

client.on('message', (topic, message) => {
    console.log('Received message:', topic, message.toString());
    try {
        const payload = JSON.parse(message.toString());
        
        // Handle different message types
        if (payload.type === 'red' || payload.type === 'amber' || payload.type === 'green') {
            handleAlarm(payload);
        } else if (payload.type === 'command') {
            logToCommandTerminal(payload.message || 'Command received', payload.type);
        } else {
            // Default to general terminal for other messages
            logToTerminal(payload.message || message.toString(), 'info');
        }
    } catch (e) {
        console.error('Error parsing message:', e);
        logToTerminal('Error parsing message: ' + message.toString(), 'error');
    }
});

// Terminal logging functions
function logToTerminal(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `[${timestamp}] ${message}`;
    messageLog.appendChild(logEntry);
    messageLog.scrollTop = messageLog.scrollHeight;
}

function logToCommandTerminal(message, type = 'command') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `[${timestamp}] ${message}`;
    commandLog.appendChild(logEntry);
    commandLog.scrollTop = commandLog.scrollHeight;
}

function handleAlarm(alarm) {
    const timestamp = new Date().toLocaleTimeString();
    const alarmEntry = document.createElement('div');
    alarmEntry.className = `alarm-entry ${alarm.type}`; // Use the type directly from ESP32
    alarmEntry.innerHTML = `[${timestamp}] ${alarm.message}`;
    
    // Add to appropriate alarm section based on the type from ESP32
    const alarmContainer = document.getElementById(`${alarm.type}Alarms`);
    if (alarmContainer) {
        alarmContainer.appendChild(alarmEntry);
        alarmContainer.scrollTop = alarmContainer.scrollHeight;
        // Also log to general terminal
        logToTerminal(`[${alarm.type.toUpperCase()} ALARM] ${alarm.message}`, 'warning');
    }
}

// Terminal input handling
terminalInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const command = terminalInput.value.trim().toUpperCase();
        if (command) {
            // Log the command to the command terminal
            logToCommandTerminal(`> ${command}`, 'command');
            
            // Create command payload
            const payload = {
                type: 'command',
                message: command,
                timestamp: new Date().toISOString()
            };
            
            // Publish to both general and command topics
            client.publish('usf/messages', JSON.stringify(payload), { qos: 1 }, (err) => {
                if (err) {
                    console.error('Failed to publish command:', err);
                    logToCommandTerminal('Failed to send command', 'error');
                }
            });
            
            // Handle specific lift commands
            if (command === 'UP' || command === 'DOWN' || command === 'STOP') {
                const liftPayload = {
                    type: 'command',
                    message: `COMMAND:${command}`,
                    timestamp: new Date().toISOString()
                };
                
                // Send to motor control topic
                client.publish('usf/messages', JSON.stringify(liftPayload), { qos: 1 }, (err) => {
                    if (err) {
                        console.error('Failed to send lift command:', err);
                        logToCommandTerminal('Failed to send lift command', 'error');
                    }
                });
            }
            
            // Clear the input
            terminalInput.value = '';
        }
    }
});

// Add helper buttons for lift control
const terminalContainer = document.getElementById('command-log').parentElement;
const controlButtonsDiv = document.createElement('div');
controlButtonsDiv.className = 'terminal-controls';
controlButtonsDiv.innerHTML = `
    <button onclick="sendLiftCommand('UP')">UP</button>
    <button onclick="sendLiftCommand('DOWN')">DOWN</button>
    <button onclick="sendLiftCommand('STOP')">STOP</button>
`;
terminalContainer.insertBefore(controlButtonsDiv, terminalInput);

// Add styles for the control buttons
document.head.querySelector('style').textContent += `
    .terminal-controls {
        margin: 10px 0;
        display: flex;
        gap: 10px;
    }
    .terminal-controls button {
        padding: 5px 15px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    .terminal-controls button:hover {
        background-color: #45a049;
    }
`;

// Function to send lift commands
window.sendLiftCommand = function(command) {
    const payload = {
        type: 'command',
        message: `COMMAND:${command}`,
        timestamp: new Date().toISOString()
    };
    
    // Log the command
    logToCommandTerminal(`> ${command}`, 'command');
    
    // Send to motor control topic
    client.publish('usf/messages', JSON.stringify(payload), { qos: 1 }, (err) => {
        if (err) {
            console.error('Failed to send lift command:', err);
            logToCommandTerminal('Failed to send lift command', 'error');
        }
    });
};

// Clear log buttons
document.querySelectorAll('[data-action="clear-log"]').forEach(button => {
    button.addEventListener('click', () => {
        const targetId = button.getAttribute('data-target');
        const terminal = document.getElementById(targetId);
        if (terminal) {
            terminal.innerHTML = '';
        }
        // Also clear logs on the ESP32 backend
        fetch('/clearLogs')
            .then(res => res.text())
            .then(msg => {
                showMessage(msg || 'Logs cleared', 'success');
            })
            .catch(() => {
                showMessage('Failed to clear logs on device', 'error');
            });
    });
});

// Handle Login
function handleLogin(event) {
    if (!event) {
        console.error('Login event is undefined');
        return;
    }
    event.preventDefault();
    
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    
    if (!usernameInput || !passwordInput) {
        console.error('Login form elements not found');
        showMessage(t('loginError'), 'error');
        return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        showMessage(t('enterCredentials'), 'error');
        return;
    }

    if (username === 'admin' && password === 'admin') {
        loggedIn = true;
        const loginContainer = document.querySelector('.login-container');
        const mainApp = document.getElementById('main-app');
        
        if (!loginContainer || !mainApp) {
            console.error('Required DOM elements not found');
            return;
        }

        loginContainer.classList.add('hidden');
        mainApp.classList.remove('hidden');
        
        // Clear the form
        usernameInput.value = '';
        passwordInput.value = '';
        
        // Show success message
        showMessage(t('loginSuccess'), 'success');
    } else {
        loggedIn = false;
        showMessage(t('invalidCredentials'), 'error');
    }
}

// Handle Tab Switching
function handleTabSwitch(event) {
    const selectedTab = event.target.value;
    const tabContents = document.querySelectorAll('.tab-content');
    
    // First verify we have both the selected value and tab contents
    if (!selectedTab || !tabContents.length) {
        console.error('Tab switching error: Missing elements');
        return;
    }

    // Log for debugging
    console.log('Switching to tab:', selectedTab);

    // Show selected tab content and hide others
    tabContents.forEach(content => {
        if (content.id === selectedTab + '-tab') {
            content.classList.remove('hidden');
            console.log('Showing tab:', content.id);
        } else {
            content.classList.add('hidden');
            console.log('Hiding tab:', content.id);
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

// Add CSS for alarm styling
const style = document.createElement('style');
style.textContent = `
  .alarm-entry {
    padding: 8px;
    margin: 4px 0;
    border-radius: 4px;
  }
  .alarm-entry.red {
    background-color: rgba(255, 0, 0, 0.1);
    border-left: 4px solid red;
  }
  .alarm-entry.amber {
    background-color: rgba(255, 165, 0, 0.1);
    border-left: 4px solid orange;
  }
  .alarm-entry.green {
    background-color: rgba(0, 255, 0, 0.1);
    border-left: 4px solid green;
  }
  .email-form {
    margin: 20px 0;
  }
  .email-list {
    margin-top: 20px;
  }
  .email-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    margin: 4px 0;
    background-color: #f5f5f5;
    border-radius: 4px;
  }
  .email-item button {
    background-color: #ff4444;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
  }
`;
document.head.appendChild(style);

// Add translations for email management
const emailTranslations = {
    en: {
        emailSettings: 'Email Settings',
        enterEmail: 'Enter email address',
        addEmail: 'Add Email',
        remove: 'Remove',
        invalidEmail: 'Invalid email address',
        emailAdded: 'Email added successfully',
        emailRemoved: 'Email removed successfully',
        errorAddingEmail: 'Error adding email',
        errorRemovingEmail: 'Error removing email',
        errorLoadingEmails: 'Error loading emails'
    },
    de: {
        emailSettings: 'E-Mail-Einstellungen',
        enterEmail: 'E-Mail-Adresse eingeben',
        addEmail: 'E-Mail hinzufügen',
        remove: 'Entfernen',
        invalidEmail: 'Ungültige E-Mail-Adresse',
        emailAdded: 'E-Mail erfolgreich hinzugefügt',
        emailRemoved: 'E-Mail erfolgreich entfernt',
        errorAddingEmail: 'Fehler beim Hinzufügen der E-Mail',
        errorRemovingEmail: 'Fehler beim Entfernen der E-Mail',
        errorLoadingEmails: 'Fehler beim Laden der E-Mails'
    }
};

// Update translations object
Object.keys(translations).forEach(lang => {
    translations[lang] = { ...translations[lang], ...emailTranslations[lang] };
});

// Make email functions globally accessible
window.addEmailSubscriber = async function() {
  const emailInput = document.getElementById('email-input');
  const email = emailInput.value.trim();
  
  if (!email || !validateEmail(email)) {
    showMessage(t('invalidEmail'), 'error');
    return;
  }

  try {
    await emailCollection.add({
      email: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    emailInput.value = '';
    showMessage(t('emailAdded'), 'success');
    loadEmailSubscribers();
  } catch (error) {
    console.error('Error adding email:', error);
    showMessage(t('errorAddingEmail'), 'error');
  }
}

window.removeEmailSubscriber = async function(docId) {
  try {
    await emailCollection.doc(docId).delete();
    showMessage(t('emailRemoved'), 'success');
    loadEmailSubscribers();
  } catch (error) {
    console.error('Error removing email:', error);
    showMessage(t('errorRemovingEmail'), 'error');
  }
}

// Update the email tab creation to use event delegation instead of inline onclick
document.addEventListener('DOMContentLoaded', () => {
  const tabSelector = document.getElementById('tab-selector');
  if (tabSelector) {
    const emailOption = document.createElement('option');
    emailOption.value = 'email-settings';
    emailOption.textContent = t('emailSettings');
    tabSelector.appendChild(emailOption);
  }

  // Add email settings tab content
  const mainApp = document.getElementById('main-app');
  if (mainApp) {
    const emailTab = document.createElement('div');
    emailTab.id = 'email-settings-tab';
    emailTab.className = 'tab-content hidden';
    emailTab.innerHTML = `
      <h3>${t('emailSettings')}</h3>
      <div class="email-form">
        <input type="email" id="email-input" placeholder="${t('enterEmail')}">
        <button id="add-email-btn" data-action="add-email">${t('addEmail')}</button>
      </div>
      <div id="email-list" class="email-list"></div>
    `;
    mainApp.appendChild(emailTab);

    // Add event listener for the add email button
    const addEmailBtn = emailTab.querySelector('#add-email-btn');
    if (addEmailBtn) {
      addEmailBtn.addEventListener('click', window.addEmailSubscriber);
    }
  }

  // Load existing email subscribers
  loadEmailSubscribers();
});

// Update loadEmailSubscribers to use event delegation instead of inline onclick
async function loadEmailSubscribers() {
  const emailList = document.getElementById('email-list');
  if (!emailList) return;

  try {
    const snapshot = await emailCollection.get();
    emailList.innerHTML = '';
    
    snapshot.forEach(doc => {
      const div = document.createElement('div');
      div.className = 'email-item';
      const docId = doc.id;
      div.innerHTML = `
        <span>${doc.data().email}</span>
        <button data-docid="${docId}" data-action="remove-email">${t('remove')}</button>
      `;
      emailList.appendChild(div);
    });

    // Add event listeners for remove buttons using event delegation
    emailList.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-action="remove-email"]');
      if (removeBtn) {
        const docId = removeBtn.dataset.docid;
        window.removeEmailSubscriber(docId);
      }
    });
  } catch (error) {
    console.error('Error loading emails:', error);
    showMessage(t('errorLoadingEmails'), 'error');
  }
}

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
 * Sends the log content via email using EmailJS
 * Requires EmailJS to be initialized with your public key
 * Uses the template "template_vnrbr1d" from service "service_lsa1r4i"
 */
async function sendLogEmail() {
    const modal = document.getElementById('emailModal');
    const targetId = modal.dataset.targetLog;
    const emailInput = document.getElementById('emailInput');
    const terminal = document.getElementById(targetId);
    const submitButton = document.querySelector('[data-action="send-email"]');
    
    if (!terminal || !emailInput.value) {
        showMessage(t('invalidEmailOrContent'), 'error');
        return;
    }

    try {
        // Disable submit button and show loading state
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = t('sending');
        }

        // Send email using EmailJS
        await emailjs.send(
            "service_lsa1r4i", 
            "template_vnrbr1d",
            {
                to_email: emailInput.value,
                log_content: terminal.innerText,
                log_type: targetId,
                timestamp: new Date().toLocaleString()
            }
        );
        
        showMessage(t('emailSent'), 'success');
        closeEmailModal();
    } catch (error) {
        console.error('Email error:', error);
        showMessage(t('emailError') + ': ' + error.message, 'error');
    } finally {
        // Re-enable submit button and restore text
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = t('sendEmail');
        }
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

// Add event listener for language changes
document.getElementById('languageSelector').addEventListener('change', function(e) {
    const selectedLang = e.target.value;
    localStorage.setItem('language', selectedLang);
    updateAllText();
});

// Call updateAllText on page load
document.addEventListener('DOMContentLoaded', function() {
    const savedLang = localStorage.getItem('language') || 'en';
    document.getElementById('languageSelector').value = savedLang;
    updateAllText();
});

/**
 * Sends a test email to verify email alert configuration
 */
async function sendTestEmail() {
    const emailList = document.querySelectorAll('#emailList .email-item span');
    if (emailList.length === 0) {
        showMessage('Please add at least one email address first', 'error');
        return;
    }

    try {
        // Disable the test button while sending
        const testButton = document.querySelector('#testEmailBtn');
        if (testButton) {
            testButton.disabled = true;
            testButton.textContent = 'Sending...';
        }

        // Send test email to all subscribed addresses
        for (const emailElement of emailList) {
            const email = emailElement.textContent;
            await emailjs.send(
                "service_lsa1r4i",
                "template_vnrbr1d",
                {
                    to_email: email,
                    subject: "Test Alert from VPL Monitoring System",
                    message: "This is a test alert from your VPL Monitoring System. If you received this, your email alerts are working correctly.",
                    timestamp: new Date().toLocaleString()
                }
            );
        }

        showMessage('Test email sent successfully!', 'success');
    } catch (error) {
        console.error('Failed to send test email:', error);
        showMessage('Failed to send test email: ' + error.message, 'error');
    } finally {
        // Re-enable the test button
        const testButton = document.querySelector('#testEmailBtn');
        if (testButton) {
            testButton.disabled = false;
            testButton.textContent = 'Send Test Email';
        }
    }
}
