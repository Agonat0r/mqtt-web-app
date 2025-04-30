const twilio = require('twilio');

exports.handler = async function(event, context) {
    console.log('SMS Function Started', {
        method: event.httpMethod,
        headers: event.headers,
        path: event.path
    });

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        console.log('Method Not Allowed:', event.httpMethod);
        return {
            statusCode: 405,
            body: JSON.stringify({ 
                error: 'Method Not Allowed',
                message: 'Only POST requests are allowed'
            })
        };
    }

    // Check environment variables
    const envCheck = {
        TWILIO_ACCOUNT_SID: !!process.env.TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN: !!process.env.TWILIO_AUTH_TOKEN,
        TWILIO_PHONE_NUMBER: !!process.env.TWILIO_PHONE_NUMBER
    };

    console.log('Environment Variables Check:', envCheck);

    // Verify all required environment variables are present
    if (!Object.values(envCheck).every(Boolean)) {
        console.log('Missing Environment Variables');
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Configuration Error',
                message: 'Missing required Twilio configuration. Please check environment variables.',
                missingVars: Object.entries(envCheck)
                    .filter(([_, exists]) => !exists)
                    .map(([name]) => name)
            })
        };
    }

    try {
        // Parse request body
        const data = JSON.parse(event.body);
        console.log('Received Request Data:', {
            hasPhones: !!data.phones,
            phoneCount: data.phones?.length,
            hasMessage: !!data.message,
            messageLength: data.message?.length
        });

        const { phones, message } = data;

        // Validate input
        if (!phones || !Array.isArray(phones) || phones.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: 'Invalid Request',
                    message: 'No phone numbers provided'
                })
            };
        }

        if (!message) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: 'Invalid Request',
                    message: 'No message content provided'
                })
            };
        }

        // Initialize Twilio client
        const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );

        console.log('Sending SMS messages...');
        
        // Send SMS to each phone number
        const results = await Promise.all(phones.map(async (phone) => {
            try {
                const result = await client.messages.create({
                    body: message,
                    to: phone,
                    from: process.env.TWILIO_PHONE_NUMBER
                });
                console.log('SMS sent successfully to:', phone, 'SID:', result.sid);
                return { phone, status: 'success', sid: result.sid };
            } catch (error) {
                console.error('Failed to send SMS to:', phone, 'Error:', error.message);
                return { phone, status: 'failed', error: error.message };
            }
        }));

        const failedMessages = results.filter(r => r.status === 'failed');
        
        if (failedMessages.length > 0) {
            return {
                statusCode: 207,
                body: JSON.stringify({
                    message: 'Some messages failed to send',
                    results: results
                })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'All messages sent successfully',
                results: results
            })
        };

    } catch (error) {
        console.error('Function Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Server Error',
                message: error.message,
                details: error.stack
            })
        };
    }
}; 