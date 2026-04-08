import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.SMS_API_KEY; // Same token is used for multichannel
const WABA_ID = process.env.WHATSAPP_WABA_ID;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;

/**
 * Send WhatsApp OTP Template Message
 * @param {string} to - Recipient phone number
 * @param {string} templateName - Approved template name
 * @param {string[]} variables - Array of variable values (e.g., [name, otp])
 * @returns {Promise<any>}
 */
export const sendWhatsAppOTP = async (to, templateName, variables = []) => {
    try {
        if (!API_KEY || !PHONE_ID) {
            console.error('WhatsApp configuration missing');
            return null;
        }

        // Format to E.164 (ensure + prefix and no spaces)
        let formattedPhone = to.replace(/\D/g, '');
        if (!formattedPhone.startsWith('91')) {
            formattedPhone = '91' + formattedPhone;
        }
        formattedPhone = '+' + formattedPhone;

        const url = `http://multichannel.buddyinfotech.in/api/v1/whatsapp/${PHONE_ID}/messages`;

        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "template",
            template: {
                name: templateName,
                language: { code: "en_US" },
                components: [
                    {
                        type: "body",
                        parameters: variables.map(v => ({
                            type: "text",
                            text: String(v)
                        }))
                    },
                    {
                        type: "button",
                        sub_type: "url",
                        index: 0,
                        parameters: [
                            {
                                type: "text",
                                text: String(variables[0]) // The OTP for the Copy Code button
                            }
                        ]
                    }
                ]
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();
        console.log('WhatsApp API Response:', data);
        return data;
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        return null;
    }
};
