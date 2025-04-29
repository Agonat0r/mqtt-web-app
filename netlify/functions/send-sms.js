const twilio = require('twilio');

exports.handler = async function(event, context) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
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
    const results = await Promise.all(
      phones.map(phone =>
        client.messages.create({
          body: `${message}\nTime: ${timestamp}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone
        })
      )
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        message: `SMS sent to ${phones.length} recipients`
      })
    };
  } catch (error) {
    console.error('SMS Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to send SMS',
        details: error.message 
      })
    };
  }
}; 