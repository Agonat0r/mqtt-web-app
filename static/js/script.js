// SMS Alert Management
let smsEnabled = localStorage.getItem('smsEnabled') === 'true';
let phoneNumbers = JSON.parse(localStorage.getItem('phoneNumbers') || '[]');

function initializeSMSSettings() {
    const smsEnabledCheckbox = document.getElementById('smsEnabled');
    const phoneList = document.getElementById('phoneList');
    
    if (smsEnabledCheckbox) {
        smsEnabledCheckbox.checked = smsEnabled;
    }
    
    if (phoneList) {
        phoneList.innerHTML = '';
        phoneNumbers.forEach(phone => {
            addPhoneToList(phone);
        });
    } else {
        console.warn('Phone list element not found');
    }
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
    const validationMsg = document.getElementById('phone-validation-msg');
    
    if (!phoneInput || !validationMsg) {
        console.error('Required elements not found');
        return;
    }

    const phone = phoneInput.value.trim();

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
    if (!phoneList) {
        console.error('Phone list element not found');
        return;
    }

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
    // Check if SMS alerts are enabled
    if (!smsEnabled) {
        console.log('SMS alerts are disabled');
        return;
    }

    // Get phone numbers from localStorage
    const phones = JSON.parse(localStorage.getItem('phoneNumbers') || '[]');
    if (!phones.length) {
        console.log('No phone numbers configured for SMS alerts');
        return;
    }

    // Check alert type preferences
    const redAlertsEnabled = localStorage.getItem('smsRedAlerts') === 'true';
    const amberAlertsEnabled = localStorage.getItem('smsAmberAlerts') === 'true';
    const greenAlertsEnabled = localStorage.getItem('smsGreenAlerts') === 'true';

    // Only send if the alert type is enabled
    if ((alertType === 'red' && !redAlertsEnabled) ||
        (alertType === 'amber' && !amberAlertsEnabled) ||
        (alertType === 'green' && !greenAlertsEnabled)) {
        console.log(`${alertType} alerts are disabled for SMS`);
        return;
    }

    try {
        const timestamp = new Date().toLocaleString();
        const response = await fetch('/.netlify/functions/send-sms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phones,
                message,
                timestamp
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to send SMS alert');
        }

        console.log('SMS alert sent successfully');
    } catch (error) {
        console.error('Error sending SMS alert:', error);
        // Optionally show an error message to the user
        showNotification('Failed to send SMS alert: ' + error.message, 'error');
    }
}

async function sendTestSMS() {
    if (!smsEnabled) {
        showNotification('Please enable SMS alerts first', 'error');
        return;
    }

    if (phoneNumbers.length === 0) {
        showNotification('Please add at least one phone number', 'error');
        return;
    }

    try {
        await sendSMSAlert('Test Alert: This is a test message from your VPL Monitoring Dashboard', 'test');
        showNotification('Test SMS sent successfully!', 'success');
    } catch (error) {
        showNotification('Failed to send test SMS: ' + error.message, 'error');
        console.error('Test SMS Error:', error);
    }
}

// Initialize SMS settings when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeSMSSettings();
}); 