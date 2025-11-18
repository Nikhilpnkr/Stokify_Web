
"use server";

const TEXTBEE_API_URL = "https://api.textbee.dev/api/v1/messaging";

type SendSmsActionParams = {
    to: string;
    message: string;
};

export async function sendSmsAction(params: SendSmsActionParams) {
    const { to, message } = params;
    const apiKey = process.env.TEXTBEE_API_KEY;

    if (!apiKey) {
        const errorMessage = "API key for SMS service is not configured on the server.";
        console.error("sendSmsAction Error:", errorMessage);
        return { success: false, error: errorMessage };
    }

    const formattedTo = to.startsWith('+') ? to.substring(1) : to;
    const sanitizedMessage = message.replace(/Rps/g, 'INR');

    try {
        const response = await fetch(TEXTBEE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apiKey: apiKey,
                deviceId: "YOUR_DEVICE_ID", // Added deviceId here
                sms: {
                    to: [formattedTo],
                    message: sanitizedMessage,
                },
            }),
        });

        if (!response.ok) {
            const responseData = await response.json().catch(() => ({ message: 'Failed to parse error response from Textbee' }));
            console.error('Textbee API Error:', responseData);
            const apiErrorMessage = responseData.message || `Failed to send SMS with status: ${response.status}`;
            throw new Error(apiErrorMessage);
        }

        const responseData = await response.json();
        console.log("SMS sent successfully via server action:", responseData);
        return { success: true, data: responseData };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Exception in sendSmsAction:", errorMessage);
        return { success: false, error: errorMessage };
    }
}
