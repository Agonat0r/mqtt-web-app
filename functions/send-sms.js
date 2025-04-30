const twilio = require('twilio');

// Initialize Twilio client with environment variables
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const { phones, message, timestamp } = data;

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'No phone numbers provided' })
      };
    }

    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'No message provided' })
      };
    }

    // Send SMS to each phone number
    const results = await Promise.all(
      phones.map(phone => 
        client.messages.create({
          body: `${message}\nTimestamp: ${timestamp}`,
          to: phone,
          from: process.env.TWILIO_PHONE_NUMBER
        })
      )
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'SMS sent successfully',
        results: results.map(r => r.sid)
      })
    };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Error sending SMS',
        error: error.message 
      })
    };
  }
}; 