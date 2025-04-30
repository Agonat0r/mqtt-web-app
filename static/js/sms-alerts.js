// SMS Alerts Module

// Initialize phone number list
let phoneNumbers = [];

// Load phone numbers from local storage
function loadPhoneNumbers() {
    const saved = localStorage.getItem('sms_subscribers');
    if (saved) {
        phoneNumbers = JSON.parse(saved);
        updatePhoneList();
    }
}

// Save phone numbers to local storage
function savePhoneNumbers() {
    localStorage.setItem('sms_subscribers', JSON.stringify(phoneNumbers));
}

// Add a phone number
function addPhoneNumber(phone) {
    if (!phone || phoneNumbers.includes(phone)) return false;
    phoneNumbers.push(phone);
    savePhoneNumbers();
    updatePhoneList();
    return true;
}

// Remove a phone number
function removePhoneNumber(phone) {
    const index = phoneNumbers.indexOf(phone);
    if (index > -1) {
        phoneNumbers.splice(index, 1);
        savePhoneNumbers();
        updatePhoneList();
        return true;
    }
    return false;
}

// Update the phone list display
function updatePhoneList() {
    const list = document.getElementById('phoneList');
    if (!list) return;

    list.innerHTML = '';
    phoneNumbers.forEach(phone => {
        const item = document.createElement('div');
        item.className = 'phone-item';
        item.innerHTML = `
            <span>${phone}</span>
            <button onclick="removePhoneNumber('${phone}')">Remove</button>
        `;
        list.appendChild(item);
    });
}

// Send SMS to all subscribers
async function sendSMSToAll(message) {
    if (!phoneNumbers.length) return false;

    try {
        const response = await fetch('/.netlify/functions/send-sms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phones: phoneNumbers,
                message: message
            })
        });

        if (!response.ok) throw new Error('Failed to send SMS');
        return true;
    } catch (error) {
        console.error('SMS Error:', error);
        return false;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadPhoneNumbers();

    // Add event listener for the add phone form
    const addPhoneForm = document.getElementById('addPhoneForm');
    if (addPhoneForm) {
        addPhoneForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('phoneInput');
            if (input && input.value) {
                addPhoneNumber(input.value.trim());
                input.value = '';
            }
        });
    }
});

// Export functions for use in other modules
window.addPhoneNumber = addPhoneNumber;
window.removePhoneNumber = removePhoneNumber;
window.sendSMSToAll = sendSMSToAll; 