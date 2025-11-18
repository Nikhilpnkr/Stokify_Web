
"use server";

type SendSmsActionParams = {
    to: string;
    message: string;
};

export async function sendSmsAction(params: SendSmsActionParams) {
    const { to, message } = params;
    
    const apiKey = process.env.TEXTBEE_API_KEY;
    const deviceId = process.env.TEXTBEE_DEVICE_ID;

    if (!apiKey || !deviceId) {
        const errorMessage = "Textbee API key or Device ID are not configured on the server.";
        console.error("sendSmsAction Error:", errorMessage);
        return { success: false, error: errorMessage };
    }

    try {
        const response = await fetch("https://api.textbee.dev/api/v1/gateway/messages", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "apiKey": apiKey,
                "deviceId": deviceId,
                "sms": {
                    "address": [to],
                    "message": message
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(errorData || 'Failed to send SMS');
        }

        const data = await response.json();
        console.log("SMS sent successfully via server action:", data);
        return { success: true, data: data };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Exception in sendSmsAction:", errorMessage);
        return { success: false, error: errorMessage };
    }
}
