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

async function sendSMSAlert(alertType, message) {
    if (!smsEnabled || phoneNumbers.length === 0) return;

    // Check if this alert type is enabled
    const alertPreference = localStorage.getItem(`${alertType.toLowerCase()}AlertsEnabled`);
    if (alertPreference !== 'true') return;

    try {
        const response = await fetch('/api/send-sms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phones: phoneNumbers,
                message: `${alertType} Alert: ${message}`,
                timestamp: new Date().toLocaleString()
            })
        });

        if (!response.ok) {
            throw new Error('Failed to send SMS alert');
        }
    } catch (error) {
        console.error('Error sending SMS alert:', error);
    }
}

async function sendTestSMS() {
    if (!smsEnabled || phoneNumbers.length === 0) {
        alert('Please enable SMS alerts and add at least one phone number');
        return;
    }

    try {
        await sendSMSAlert('Test', 'This is a test SMS alert');
        alert('Test SMS sent successfully!');
    } catch (error) {
        alert('Failed to send test SMS');
        console.error(error);
    }
}

// Initialize SMS settings when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeSMSSettings();
}); 