// === Full script.js with Firestore logging, timestamps, translations, and MQTT handling ===

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
