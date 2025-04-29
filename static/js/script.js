// SMS Alert Management
let smsEnabled = localStorage.getItem('smsEnabled') === 'true';
let phoneNumbers = JSON.parse(localStorage.getItem('phoneNumbers') || '[]');

function initializeSMSSettings() {
    document.getElementById('smsEnabled').checked = smsEnabled;
    const phoneList = document.getElementById('phoneList');
    phoneList.innerHTML = '';
    phoneNumbers.forEach(phone => {
        addPhoneToList(phone);
    });
}

function toggleSMSAlerts() {
    smsEnabled = document.getElementById('smsEnabled').checked;
    localStorage.setItem('smsEnabled', smsEnabled);
}

function validatePhoneNumber(phone) {
    // Basic phone validation - can be enhanced based on your needs
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
}

function addPhoneNumber() {
    const phoneInput = document.getElementById('phoneInput');
    const phone = phoneInput.value.trim();
    const validationMsg = document.getElementById('phone-validation-msg');

    if (!validatePhoneNumber(phone)) {
        validationMsg.textContent = 'Please enter a valid phone number';
        validationMsg.style.color = 'red';
        return;
    }

    if (phoneNumbers.includes(phone)) {
        validationMsg.textContent = 'This phone number is already added';
        validationMsg.style.color = 'red';
        return;
    }

    phoneNumbers.push(phone);
    localStorage.setItem('phoneNumbers', JSON.stringify(phoneNumbers));
    addPhoneToList(phone);
    phoneInput.value = '';
    validationMsg.textContent = '';
}

function addPhoneToList(phone) {
    const phoneList = document.getElementById('phoneList');
    const li = document.createElement('li');
    li.textContent = phone;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => removePhone(phone);
    li.appendChild(removeBtn);
    phoneList.appendChild(li);
}

function removePhone(phone) {
    phoneNumbers = phoneNumbers.filter(p => p !== phone);
    localStorage.setItem('phoneNumbers', JSON.stringify(phoneNumbers));
    initializeSMSSettings();
}

async function sendSMSAlert(message, alertType) {
    if (!smsEnabled) return;

    // Check if the alert type is enabled
    const redAlertsEnabled = document.getElementById('smsRedAlerts').checked;
    const amberAlertsEnabled = document.getElementById('smsAmberAlerts').checked;
    const greenAlertsEnabled = document.getElementById('smsGreenAlerts').checked;

    if ((alertType === 'red' && !redAlertsEnabled) ||
        (alertType === 'amber' && !amberAlertsEnabled) ||
        (alertType === 'green' && !greenAlertsEnabled)) {
        return;
    }

    const phoneNumbers = JSON.parse(localStorage.getItem('phoneNumbers') || '[]');
    if (phoneNumbers.length === 0) return;

    try {
        const response = await fetch('/.netlify/functions/send-sms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phones: phoneNumbers,
                message: message,
                timestamp: new Date().toISOString()
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to send SMS');
        }

        console.log('SMS alert sent successfully');
    } catch (error) {
        console.error('Error sending SMS alert:', error);
        showError('Failed to send SMS alert: ' + error.message);
    }
}

async function sendTestSMS() {
    if (!smsEnabled) {
        showError('SMS alerts are not enabled');
        return;
    }

    const phoneNumbers = JSON.parse(localStorage.getItem('phoneNumbers') || '[]');
    if (phoneNumbers.length === 0) {
        showError('No phone numbers added');
        return;
    }

    try {
        const response = await fetch('/.netlify/functions/send-sms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phones: phoneNumbers,
                message: 'This is a test SMS alert from your VPL Monitoring Dashboard.',
                timestamp: new Date().toISOString()
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to send test SMS');
        }

        showSuccess('Test SMS sent successfully');
    } catch (error) {
        console.error('Error sending test SMS:', error);
        showError('Failed to send test SMS: ' + error.message);
    }
}

// Initialize SMS settings when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeSMSSettings();
}); 