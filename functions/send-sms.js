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
    // Log environment variable presence (not their values)
    console.log('Environment variables check:', {
      hasSID: !!process.env.TWILIO_ACCOUNT_SID,
      hasToken: !!process.env.TWILIO_AUTH_TOKEN,
      hasPhone: !!process.env.TWILIO_PHONE_NUMBER
    });

    const data = JSON.parse(event.body);
    const { phones, message, timestamp } = data;

    console.log('Received request:', {
      numberOfPhones: phones?.length,
      hasMessage: !!message,
      timestamp
    });

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

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          message: 'Twilio configuration missing',
          details: {
            hasSID: !!process.env.TWILIO_ACCOUNT_SID,
            hasToken: !!process.env.TWILIO_AUTH_TOKEN,
            hasPhone: !!process.env.TWILIO_PHONE_NUMBER
          }
        })
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

    console.log('SMS sent successfully:', {
      numberOfMessages: results.length,
      messageIds: results.map(r => r.sid)
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'SMS sent successfully',
        results: results.map(r => r.sid)
      })
    };
  } catch (error) {
    console.error('Error sending SMS:', {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo
    });

    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Error sending SMS',
        error: {
          name: error.name,
          message: error.message,
          code: error.code,
          status: error.status,
          moreInfo: error.moreInfo
        }
      })
    };
  }
}; 