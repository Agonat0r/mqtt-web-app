// SMS Alert Management
const phoneInput = document.getElementById('phoneInput-main');
const phoneList = document.getElementById('phoneList');
const phoneValidationMsg = document.getElementById('phoneValidationMsg');
const smsAlertEnabled = document.getElementById('smsAlertEnabled');
const testSmsBtn = document.getElementById('testSmsBtn');
const testAlertStatus = document.getElementById('testAlertStatus');

// Load saved SMS settings
window.addEventListener('load', () => {
  const savedPhones = JSON.parse(localStorage.getItem('smsAlerts') || '[]');
  savedPhones.forEach(phone => addPhoneToList(phone));
  
  const smsEnabled = localStorage.getItem('smsAlertEnabled') === 'true';
  if (smsAlertEnabled) {
    smsAlertEnabled.checked = smsEnabled;
  }
});

// Phone number validation function
function isValidPhone(phone) {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

// Add phone to the list
function addPhoneToList(phone) {
  const phoneItem = document.createElement('div');
  phoneItem.className = 'phone-item';
  phoneItem.innerHTML = `
    <span class="phone-text">${phone}</span>
    <button class="delete-phone-btn" onclick="removePhone(this)">×</button>
  `;
  phoneList.appendChild(phoneItem);
  savePhones();
}

// Remove phone from the list
function removePhone(button) {
  button.parentElement.remove();
  savePhones();
}

// Save phones to localStorage
function savePhones() {
  const phones = Array.from(phoneList.querySelectorAll('.phone-text'))
    .map(span => span.textContent);
  localStorage.setItem('smsAlerts', JSON.stringify(phones));
}

// Add phone subscriber function
function addPhoneSubscriber() {
  const phoneInput = document.getElementById('phoneInput-main');
  const phoneValidationMsg = document.getElementById('phoneValidationMsg');
  const phone = phoneInput.value.trim();

  if (!phone) {
    phoneValidationMsg.textContent = 'Please enter a phone number';
    phoneValidationMsg.style.color = '#ff4444';
    return;
  }
  if (!isValidPhone(phone)) {
    phoneValidationMsg.textContent = 'Please enter a valid phone number (e.g., +1234567890)';
    phoneValidationMsg.style.color = '#ff4444';
    return;
  }
  
  const existingPhones = Array.from(document.querySelectorAll('.phone-text'))
    .map(span => span.textContent);
  if (existingPhones.includes(phone)) {
    phoneValidationMsg.textContent = 'This phone number is already in the list';
    phoneValidationMsg.style.color = '#ff4444';
    return;
  }

  addPhoneToList(phone);
  phoneInput.value = '';
  phoneValidationMsg.textContent = 'Phone number added successfully';
  phoneValidationMsg.style.color = '#4CAF50';
  setTimeout(() => {
    phoneValidationMsg.textContent = '';
  }, 3000);
}

// Save SMS alert enabled state
if (smsAlertEnabled) {
  smsAlertEnabled.addEventListener('change', () => {
    localStorage.setItem('smsAlertEnabled', smsAlertEnabled.checked);
  });
}

// Function to send SMS alerts using Twilio
async function sendSmsAlert(type, message) {
  if (!smsAlertEnabled?.checked) return;
  
  const alertTypeEnabled = document.getElementById(`${type}AlertEnabled`)?.checked;
  if (!alertTypeEnabled) return;

  const phones = Array.from(phoneList?.querySelectorAll('.phone-text') || [])
    .map(span => span.textContent);
  
  if (phones.length === 0) return;

  try {
    const response = await fetch('/.netlify/functions/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phones: phones,
        message: `${type.toUpperCase()} Alert: ${message}`,
        timestamp: new Date().toLocaleString()
      })
    });

    if (!response.ok) {
      throw new Error('Failed to send SMS');
    }

    console.log('SMS alert sent successfully');
  } catch (error) {
    console.error('Failed to send SMS alert:', error);
  }
}

// Test SMS button click handler
if (testSmsBtn) {
  testSmsBtn.addEventListener('click', async () => {
    if (!smsAlertEnabled?.checked) {
      testAlertStatus.textContent = 'Please enable SMS alerts first';
      testAlertStatus.style.color = '#ff4444';
      return;
    }

    const phones = Array.from(phoneList?.querySelectorAll('.phone-text') || [])
      .map(span => span.textContent);
    
    if (phones.length === 0) {
      testAlertStatus.textContent = 'Please add at least one phone number';
      testAlertStatus.style.color = '#ff4444';
      return;
    }

    testSmsBtn.disabled = true;
    testAlertStatus.textContent = 'Sending test SMS...';
    testAlertStatus.style.color = '#2196F3';

    try {
      const response = await fetch('/.netlify/functions/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phones: phones,
          message: 'This is a test SMS to verify your alert configuration.',
          timestamp: new Date().toLocaleString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send SMS');
      }

      testAlertStatus.textContent = 'Test SMS sent successfully!';
      testAlertStatus.style.color = '#4CAF50';
    } catch (error) {
      console.error('Failed to send test SMS:', error);
      testAlertStatus.textContent = 'Failed to send test SMS. Please try again.';
      testAlertStatus.style.color = '#ff4444';
    } finally {
      testSmsBtn.disabled = false;
      setTimeout(() => {
        testAlertStatus.textContent = '';
      }, 5000);
    }
  });
}

// Add debug logging for SMS operations
function logSMSDebug(message, data = null) {
  const debugInfo = document.getElementById('smsDebugInfo');
  const debugLog = document.getElementById('smsDebugLog');
  
  if (debugInfo && debugLog) {
    debugInfo.style.display = 'block';
    const timestamp = new Date().toISOString();
    const logEntry = data 
      ? `[${timestamp}] ${message}\nData: ${JSON.stringify(data, null, 2)}\n\n`
      : `[${timestamp}] ${message}\n\n`;
    
    debugLog.textContent = logEntry + debugLog.textContent;
  }
} 