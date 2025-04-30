const twilio = require('twilio');

exports.handler = async function(event, context) {
    console.log('SMS Function Started', {
        method: event.httpMethod,
        headers: event.headers
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

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
        console.error('Missing Required Environment Variables');
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Configuration Error',
                message: 'Missing required Twilio configuration. Please check environment variables.',
                missing: Object.keys(envCheck).filter(key => !envCheck[key])
            })
        };
    }

    try {
        // Initialize Twilio client
        console.log('Initializing Twilio client');
        const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );

        // Parse request body
        console.log('Parsing request body');
        const data = JSON.parse(event.body);
        console.log('Received data:', {
            numberOfPhones: data.phones?.length,
            hasMessage: !!data.message,
            timestamp: data.timestamp
        });

        if (!data.phones || !data.message) {
            console.error('Invalid request data');
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: 'Invalid Request',
                    message: 'Both phones and message are required',
                    received: {
                        hasPhones: !!data.phones,
                        hasMessage: !!data.message
                    }
                })
            };
        }

        // Send SMS to each phone number
        console.log('Starting to send messages');
        const results = await Promise.all(data.phones.map(async (phone) => {
            try {
                console.log('Sending SMS to:', phone);
                const message = await client.messages.create({
                    body: data.message,
                    to: phone,
                    from: process.env.TWILIO_PHONE_NUMBER
                });
                console.log('SMS sent successfully to:', phone, 'SID:', message.sid);
                return {
                    phone,
                    status: 'success',
                    sid: message.sid
                };
            } catch (error) {
                console.error('Error sending to:', phone, error.message);
                return {
                    phone,
                    status: 'error',
                    error: error.message
                };
            }
        }));

        const failures = results.filter(r => r.status === 'error');
        if (failures.length > 0) {
            console.warn('Some messages failed to send:', failures);
            return {
                statusCode: 207,
                body: JSON.stringify({
                    message: 'Some messages failed to send',
                    results: results
                })
            };
        }

        console.log('All messages sent successfully');
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'All messages sent successfully',
                results: results
            })
        };

    } catch (error) {
        console.error('Function error:', error);
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