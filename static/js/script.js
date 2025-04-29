// SMS Alert Management
let smsEnabled = localStorage.getItem('smsEnabled') === 'true';
let phoneNumbers = JSON.parse(localStorage.getItem('phoneNumbers') || '[]');

function initializeSMSSettings() {
    // Initialize toggle switch
    const smsToggle = document.getElementById('smsAlertEnabled');
    if (smsToggle) {
        smsToggle.checked = smsEnabled;
        smsToggle.addEventListener('change', toggleSMSAlerts);
    }

    // Initialize alert preferences
    const redAlerts = document.getElementById('smsRedAlerts');
    const amberAlerts = document.getElementById('smsAmberAlerts');
    const greenAlerts = document.getElementById('smsGreenAlerts');

    if (redAlerts) {
        redAlerts.checked = localStorage.getItem('smsRedAlerts') === 'true';
        redAlerts.addEventListener('change', e => localStorage.setItem('smsRedAlerts', e.target.checked));
    }
    if (amberAlerts) {
        amberAlerts.checked = localStorage.getItem('smsAmberAlerts') === 'true';
        amberAlerts.addEventListener('change', e => localStorage.setItem('smsAmberAlerts', e.target.checked));
    }
    if (greenAlerts) {
        greenAlerts.checked = localStorage.getItem('smsGreenAlerts') === 'true';
        greenAlerts.addEventListener('change', e => localStorage.setItem('smsGreenAlerts', e.target.checked));
    }

    // Initialize phone list
    const phoneList = document.getElementById('phoneList');
    if (phoneList) {
        phoneList.innerHTML = '';
        phoneNumbers.forEach(phone => addPhoneToList(phone));
    }

    // Add event listeners
    const addPhoneBtn = document.getElementById('addPhoneBtn');
    if (addPhoneBtn) {
        addPhoneBtn.addEventListener('click', addPhoneNumber);
    }

    const phoneInput = document.getElementById('phoneInput');
    if (phoneInput) {
        phoneInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addPhoneNumber();
            }
        });
    }

    const testSmsBtn = document.getElementById('testSmsBtn');
    if (testSmsBtn) {
        testSmsBtn.addEventListener('click', sendTestSMS);
    }
}

function toggleSMSAlerts(e) {
    smsEnabled = e.target.checked;
    localStorage.setItem('smsEnabled', smsEnabled);
    
    // Update UI elements
    const testSmsBtn = document.getElementById('testSmsBtn');
    if (testSmsBtn) {
        testSmsBtn.disabled = !smsEnabled;
    }
}

function validatePhoneNumber(phone) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
}

function addPhoneNumber() {
    const phoneInput = document.getElementById('phoneInput');
    const validationMsg = document.getElementById('phoneValidationMsg');
    
    if (!phoneInput || !validationMsg) {
        console.error('Required elements not found');
        return;
    }

    const phone = phoneInput.value.trim();

    if (!validatePhoneNumber(phone)) {
        validationMsg.textContent = 'Please enter a valid phone number (e.g., +1234567890)';
        validationMsg.style.display = 'block';
        return;
    }

    if (phoneNumbers.includes(phone)) {
        validationMsg.textContent = 'This phone number is already added';
        validationMsg.style.display = 'block';
        return;
    }

    phoneNumbers.push(phone);
    localStorage.setItem('phoneNumbers', JSON.stringify(phoneNumbers));
    addPhoneToList(phone);
    
    // Clear input and validation message
    phoneInput.value = '';
    validationMsg.textContent = '';
    validationMsg.style.display = 'none';
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
    
    const phoneList = document.getElementById('phoneList');
    if (phoneList) {
        const items = phoneList.getElementsByTagName('li');
        for (let item of items) {
            if (item.textContent.includes(phone)) {
                phoneList.removeChild(item);
                break;
            }
        }
    }
}

async function sendSMSAlert(message, alertType) {
    if (!smsEnabled) {
        console.log('SMS alerts are disabled');
        return;
    }

    const phones = phoneNumbers;
    if (!phones.length) {
        console.log('No phone numbers configured for SMS alerts');
        return;
    }

    // Check alert type preferences
    const redAlertsEnabled = localStorage.getItem('smsRedAlerts') === 'true';
    const amberAlertsEnabled = localStorage.getItem('smsAmberAlerts') === 'true';
    const greenAlertsEnabled = localStorage.getItem('smsGreenAlerts') === 'true';

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
                message: `${alertType.toUpperCase()} Alert: ${message}`,
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

    const testBtn = document.getElementById('testSmsBtn');
    if (testBtn) {
        testBtn.disabled = true;
    }

    try {
        await sendSMSAlert('This is a test message from your VPL Monitoring Dashboard', 'test');
        showNotification('Test SMS sent successfully!', 'success');
    } catch (error) {
        showNotification('Failed to send test SMS: ' + error.message, 'error');
        console.error('Test SMS Error:', error);
    } finally {
        if (testBtn) {
            testBtn.disabled = false;
        }
    }
}

// Initialize SMS settings when page loads
document.addEventListener('DOMContentLoaded', initializeSMSSettings); 