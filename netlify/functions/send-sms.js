const twilio = require('twilio');

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse the incoming request body
    const data = JSON.parse(event.body);
    const { phones, message, timestamp } = data;

    // Validate required fields
    if (!phones || !phones.length || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Initialize Twilio client
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Send SMS to each phone number
    const promises = phones.map(phone =>
      client.messages.create({
        body: `${message}\nTime: ${timestamp}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      })
    );

    // Wait for all messages to be sent
    await Promise.all(promises);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}; 