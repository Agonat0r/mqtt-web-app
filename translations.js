// Language translations for UI elements
const translations = {
  en: {
    // Login
    loginTitle: "🔐 USF Harmar MQTT Login",
    username: "Username",
    password: "Password",
    loginButton: "Login",
    invalidCredentials: "❌ Invalid credentials",

    // Navigation
    dashboard: "USF Harmar MQTT Dashboard",
    status: "📊 Status",
    general: "📋 General",
    commands: "🧠 Commands",
    alerts: "🚨 Alerts",
    customization: "🍩 Customization",

    // Status Panel
    liftSystemStatus: "📊 Lift System Status",
    direction: "Direction",
    position: "Position",
    target: "Target",
    topLimit: "Top Limit",
    bottomLimit: "Bottom Limit",
    doorSensor: "Door Sensor",
    emergencyStop: "Emergency Stop",
    alarms: "Alarms",
    none: "None",
    up: "Up",
    down: "Down",
    idle: "Idle",
    active: "Active",
    inactive: "Inactive",
    open: "Open",
    closed: "Closed",
    triggered: "Triggered",

    // Console
    generalConsole: "📋 General Console",
    terminal: "🖥️ Terminal",
    commandConsole: "🧠 Command Console",
    alertConsole: "🚨 Alert Console",
    waitingMessages: "Waiting for messages...",
    terminalInitialized: "[Terminal Initialized]",
    waitingCommands: "Waiting for commands...",
    waitingAlerts: "Waiting for alerts...",
    typeCommand: "Type command here...",

    // Customization
    theme: "Theme",
    themeDefault: "Default",
    themeDark: "Dark",
    themeUsf: "USF Theme",
    font: "Font",
    fontDefault: "Default",
    fontMonospace: "Monospace",
    fontSansSerif: "Sans Serif",
    showBorders: "Show Borders",
    reset: "Reset",

    // Tools
    enterEmail: "Enter your email...",
    sendReport: "📤 Send Report",
    exportLogs: "💾 Export Logs",
    saveLogs: "📁 Save",
    clearGeneral: "🧹 Clear General",
    clearCommands: "🧹 Clear Commands",
    clearAlerts: "🧹 Clear Alerts",

    // Connection Status
    connected: "✅ Connected to MQTT broker",
    subscribed: "🔔 Subscribed to topic: ",
    mqttError: "❌ MQTT Error: ",
    reconnecting: "🔁 Reconnecting...",
    logCleared: "Log cleared..."
  },
  de: {
    // Login
    loginTitle: "🔐 USF Harmar MQTT Anmeldung",
    username: "Benutzername",
    password: "Passwort",
    loginButton: "Anmelden",
    invalidCredentials: "❌ Ungültige Anmeldedaten",

    // Navigation
    dashboard: "USF Harmar MQTT Dashboard",
    status: "📊 Status",
    general: "📋 Allgemein",
    commands: "🧠 Befehle",
    alerts: "🚨 Warnungen",
    customization: "🍩 Anpassung",

    // Status Panel
    liftSystemStatus: "📊 Aufzugsystem Status",
    direction: "Richtung",
    position: "Position",
    target: "Ziel",
    topLimit: "Obere Grenze",
    bottomLimit: "Untere Grenze",
    doorSensor: "Türsensor",
    emergencyStop: "Notaus",
    alarms: "Alarme",
    none: "Keine",
    up: "Aufwärts",
    down: "Abwärts",
    idle: "Leerlauf",
    active: "Aktiv",
    inactive: "Inaktiv",
    open: "Offen",
    closed: "Geschlossen",
    triggered: "Ausgelöst",

    // Console
    generalConsole: "📋 Allgemeine Konsole",
    terminal: "🖥️ Terminal",
    commandConsole: "🧠 Befehlskonsole",
    alertConsole: "🚨 Warnungskonsole",
    waitingMessages: "Warte auf Nachrichten...",
    terminalInitialized: "[Terminal initialisiert]",
    waitingCommands: "Warte auf Befehle...",
    waitingAlerts: "Warte auf Warnungen...",
    typeCommand: "Befehl hier eingeben...",

    // Customization
    theme: "Design",
    themeDefault: "Standard",
    themeDark: "Dunkel",
    themeUsf: "USF Design",
    font: "Schriftart",
    fontDefault: "Standard",
    fontMonospace: "Monospace",
    fontSansSerif: "Sans Serif",
    showBorders: "Ränder anzeigen",
    reset: "Zurücksetzen",

    // Tools
    enterEmail: "E-Mail eingeben...",
    sendReport: "📤 Bericht senden",
    exportLogs: "💾 Logs exportieren",
    saveLogs: "📁 Speichern",
    clearGeneral: "🧹 Allgemein löschen",
    clearCommands: "🧹 Befehle löschen",
    clearAlerts: "🧹 Warnungen löschen",

    // Connection Status
    connected: "✅ Verbunden mit MQTT Broker",
    subscribed: "🔔 Abonniert Thema: ",
    mqttError: "❌ MQTT Fehler: ",
    reconnecting: "🔁 Verbinde neu...",
    logCleared: "Log gelöscht..."
  },
  // Add other languages here with the same structure
};

// Export the translations
export default translations; 