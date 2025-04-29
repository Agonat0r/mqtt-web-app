// SMS Alert Management
let smsEnabled = localStorage.getItem('smsEnabled') === 'true';
let phoneNumbers = JSON.parse(localStorage.getItem('phoneNumbers') || '[]');

function initializeSMSSettings() {
    // Wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupSMSElements);
    } else {
        setupSMSElements();
    }
}

function setupSMSElements() {
    // Get all required elements
    const elements = {
        smsToggle: document.getElementById('smsEnabled'),
        redAlerts: document.getElementById('smsRedAlerts'),
        amberAlerts: document.getElementById('smsAmberAlerts'),
        greenAlerts: document.getElementById('smsGreenAlerts'),
        phoneList: document.getElementById('phoneList'),
        addPhoneBtn: document.getElementById('addPhoneBtn'),
        phoneInput: document.getElementById('phoneInput'),
        testSmsBtn: document.getElementById('sendTestSMS'),
        validationMsg: document.getElementById('phoneValidationMsg')
    };

    // Check if we're on a page with SMS elements
    if (!elements.smsToggle) {
        return; // Not on a page with SMS elements, exit gracefully
    }

    // Initialize toggle switch
    elements.smsToggle.checked = smsEnabled;
    elements.smsToggle.addEventListener('change', (event) => toggleSMSAlerts(event, elements));

    // Initialize alert preferences
    if (elements.redAlerts) {
        elements.redAlerts.checked = localStorage.getItem('smsRedAlerts') !== 'false';
        elements.redAlerts.addEventListener('change', e => localStorage.setItem('smsRedAlerts', e.target.checked));
    }
    if (elements.amberAlerts) {
        elements.amberAlerts.checked = localStorage.getItem('smsAmberAlerts') !== 'false';
        elements.amberAlerts.addEventListener('change', e => localStorage.setItem('smsAmberAlerts', e.target.checked));
    }
    if (elements.greenAlerts) {
        elements.greenAlerts.checked = localStorage.getItem('smsGreenAlerts') === 'true';
        elements.greenAlerts.addEventListener('change', e => localStorage.setItem('smsGreenAlerts', e.target.checked));
    }

    // Initialize phone list
    if (elements.phoneList) {
        elements.phoneList.innerHTML = '';
        phoneNumbers.forEach(phone => addPhoneToList(phone, elements));
    }

    // Add event listeners
    if (elements.addPhoneBtn) {
        elements.addPhoneBtn.addEventListener('click', () => addPhoneNumber(elements));
    }

    if (elements.phoneInput) {
        elements.phoneInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addPhoneNumber(elements);
            }
        });
    }

    if (elements.testSmsBtn) {
        elements.testSmsBtn.addEventListener('click', () => sendTestSMS(elements));
        elements.testSmsBtn.disabled = !smsEnabled;
    }
}

function toggleSMSAlerts(event, elements) {
    smsEnabled = event.target.checked;
    localStorage.setItem('smsEnabled', smsEnabled);
    
    // Update UI elements
    if (elements.testSmsBtn) {
        elements.testSmsBtn.disabled = !smsEnabled;
    }
    
    // Show/hide validation message
    if (elements.validationMsg) {
        elements.validationMsg.textContent = '';
        elements.validationMsg.style.display = 'none';
    }
}

function validatePhoneNumber(phone) {
    // Basic international phone number validation
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.trim());
}

function addPhoneNumber(elements) {
    const phone = elements.phoneInput.value.trim();
    
    // Clear previous validation message
    elements.validationMsg.textContent = '';
    elements.validationMsg.style.display = 'none';
    
    if (!phone) {
        elements.validationMsg.textContent = 'Please enter a phone number';
        elements.validationMsg.style.display = 'block';
        return;
    }
    
    if (!validatePhoneNumber(phone)) {
        elements.validationMsg.textContent = 'Please enter a valid international phone number (e.g., +1234567890)';
        elements.validationMsg.style.display = 'block';
        return;
    }
    
    if (phoneNumbers.includes(phone)) {
        elements.validationMsg.textContent = 'This phone number is already in the list';
        elements.validationMsg.style.display = 'block';
        return;
    }
    
    // Add phone to list and save
    phoneNumbers.push(phone);
    localStorage.setItem('phoneNumbers', JSON.stringify(phoneNumbers));
    addPhoneToList(phone, elements);
    
    // Clear input
    elements.phoneInput.value = '';
}

function addPhoneToList(phone, elements) {
    const li = document.createElement('li');
    li.className = 'phone-item';
    
    const phoneText = document.createElement('span');
    phoneText.textContent = phone;
    li.appendChild(phoneText);
    
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.className = 'remove-phone';
    removeBtn.onclick = () => removePhone(phone, li, elements);
    li.appendChild(removeBtn);
    
    elements.phoneList.appendChild(li);
}

function removePhone(phone, listItem, elements) {
    // Remove from UI
    listItem.remove();
    
    // Remove from storage
    phoneNumbers = phoneNumbers.filter(p => p !== phone);
    localStorage.setItem('phoneNumbers', JSON.stringify(phoneNumbers));
    
    // Clear any validation messages
    if (elements.validationMsg) {
        elements.validationMsg.textContent = '';
        elements.validationMsg.style.display = 'none';
    }
}

async function sendSMSAlert(alertType, message) {
    if (!smsEnabled) return;
    
    // Check if this alert type is enabled
    const alertTypeEnabled = localStorage.getItem(`sms${alertType}Alerts`);
    if (alertTypeEnabled === 'false') return;
    
    if (phoneNumbers.length === 0) {
        console.warn('No phone numbers configured for SMS alerts');
        return;
    }
    
    try {
        const timestamp = new Date().toISOString();
        const response = await fetch('/.netlify/functions/send-sms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phones: phoneNumbers,
                message: `${alertType} Alert: ${message}`,
                timestamp: timestamp
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        console.log(`SMS alert sent successfully to ${phoneNumbers.length} recipients`);
    } catch (error) {
        console.error('Error sending SMS alert:', error);
    }
}

async function sendTestSMS(elements) {
    if (!smsEnabled || phoneNumbers.length === 0) {
        elements.validationMsg.textContent = 'Please enable SMS alerts and add at least one phone number';
        elements.validationMsg.style.display = 'block';
        return;
    }
    
    try {
        elements.testSmsBtn.disabled = true;
        await sendSMSAlert('Test', 'This is a test SMS alert from your VPL Monitoring Dashboard');
        elements.validationMsg.textContent = 'Test SMS sent successfully!';
        elements.validationMsg.style.display = 'block';
    } catch (error) {
        elements.validationMsg.textContent = 'Failed to send test SMS. Please try again.';
        elements.validationMsg.style.display = 'block';
    } finally {
        elements.testSmsBtn.disabled = false;
    }
}

// Email Alert Management
let emailEnabled = localStorage.getItem('emailEnabled') === 'true';
let emailAddresses = JSON.parse(localStorage.getItem('emailAddresses') || '[]');

function initializeEmailSettings() {
    // Wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupEmailElements);
    } else {
        setupEmailElements();
    }
}

function setupEmailElements() {
    const elements = {
        emailToggle: document.getElementById('emailAlertEnabled'),
        redAlerts: document.getElementById('emailRedAlerts'),
        amberAlerts: document.getElementById('emailAmberAlerts'),
        greenAlerts: document.getElementById('emailGreenAlerts'),
        emailList: document.getElementById('emailList'),
        addEmailBtn: document.getElementById('addEmailAlertBtn'),
        emailInput: document.getElementById('emailAlertInput'),
        testEmailBtn: document.getElementById('sendTestEmail'),
        validationMsg: document.getElementById('emailValidationMsg')
    };

    if (!elements.emailToggle) {
        return; // Not on a page with email elements
    }

    // Initialize toggle switch
    elements.emailToggle.checked = emailEnabled;
    elements.emailToggle.addEventListener('change', (event) => {
        emailEnabled = event.target.checked;
        localStorage.setItem('emailEnabled', emailEnabled);
        if (elements.testEmailBtn) {
            elements.testEmailBtn.disabled = !emailEnabled;
        }
    });

    // Initialize alert preferences
    if (elements.redAlerts) {
        elements.redAlerts.checked = localStorage.getItem('emailRedAlerts') !== 'false';
        elements.redAlerts.addEventListener('change', e => localStorage.setItem('emailRedAlerts', e.target.checked));
    }
    if (elements.amberAlerts) {
        elements.amberAlerts.checked = localStorage.getItem('emailAmberAlerts') !== 'false';
        elements.amberAlerts.addEventListener('change', e => localStorage.setItem('emailAmberAlerts', e.target.checked));
    }
    if (elements.greenAlerts) {
        elements.greenAlerts.checked = localStorage.getItem('emailGreenAlerts') === 'true';
        elements.greenAlerts.addEventListener('change', e => localStorage.setItem('emailGreenAlerts', e.target.checked));
    }

    // Initialize email list
    if (elements.emailList) {
        elements.emailList.innerHTML = '';
        emailAddresses.forEach(email => addEmailToList(email, elements));
    }

    // Add event listeners
    if (elements.testEmailBtn) {
        elements.testEmailBtn.addEventListener('click', () => sendTestEmail(elements));
        elements.testEmailBtn.disabled = !emailEnabled;
    }
}

async function sendTestEmail(elements) {
    if (!emailEnabled || emailAddresses.length === 0) {
        elements.validationMsg.textContent = 'Please enable email alerts and add at least one email address';
        elements.validationMsg.style.display = 'block';
        return;
    }

    try {
        elements.testEmailBtn.disabled = true;
        await emailjs.send(
            'service_lsa1r4i',  // Your EmailJS service ID
            'template_vnrbr1d', // Your EmailJS template ID
            {
                to_email: emailAddresses.join(', '),
                alert_type: 'TEST',
                alert_message: 'This is a test email alert from your VPL Monitoring Dashboard',
                timestamp: new Date().toLocaleString()
            }
        );
        elements.validationMsg.textContent = 'Test email sent successfully!';
        elements.validationMsg.style.color = '#4CAF50';
        elements.validationMsg.style.display = 'block';
    } catch (error) {
        console.error('Failed to send test email:', error);
        elements.validationMsg.textContent = 'Failed to send test email. Please try again.';
        elements.validationMsg.style.color = '#ff4444';
        elements.validationMsg.style.display = 'block';
    } finally {
        elements.testEmailBtn.disabled = false;
        setTimeout(() => {
            elements.validationMsg.textContent = '';
            elements.validationMsg.style.display = 'none';
        }, 5000);
    }
}

// Initialize both SMS and Email settings when the script loads
initializeSMSSettings();
initializeEmailSettings(); 