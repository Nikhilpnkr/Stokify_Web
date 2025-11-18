
"use server";

import Twilio from 'twilio';

type SendSmsActionParams = {
    to: string;
    message: string;
};

export async function sendSmsAction(params: SendSmsActionParams) {
    const { to, message } = params;
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
        const errorMessage = "Twilio credentials are not configured on the server.";
        console.error("sendSmsAction Error:", errorMessage);
        return { success: false, error: errorMessage };
    }

    const client = Twilio(accountSid, authToken);
    const formattedTo = `+${to}`;

    try {
        const response = await client.messages.create({
            body: message,
            from: fromNumber,
            to: formattedTo
        });

        console.log("SMS sent successfully via server action:", response.sid);
        return { success: true, data: { sid: response.sid } };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Exception in sendSmsAction:", errorMessage);
        return { success: false, error: errorMessage };
    }
}
