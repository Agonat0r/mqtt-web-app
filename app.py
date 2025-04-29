from twilio.rest import Client
import os
from dotenv import load_dotenv

load_dotenv()

# Twilio credentials
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.getenv('TWILIO_PHONE_NUMBER')

# Initialize Twilio client
twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

@app.route('/api/send-sms', methods=['POST'])
def send_sms():
    try:
        data = request.get_json()
        phones = data.get('phones', [])
        message = data.get('message', '')
        timestamp = data.get('timestamp', '')

        if not phones or not message:
            return jsonify({'error': 'Missing required fields'}), 400

        # Send SMS to each phone number
        for phone in phones:
            try:
                twilio_client.messages.create(
                    body=f"{message}\nTime: {timestamp}",
                    from_=TWILIO_PHONE_NUMBER,
                    to=phone
                )
            except Exception as e:
                print(f"Failed to send SMS to {phone}: {str(e)}")

        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500 