
"use server";

const TEXTBEE_API_URL = "https://api.textbee.dev/api/v1/messaging";

type SendSmsActionParams = {
    to: string;
    message: string;
};

export async function sendSmsAction(params: SendSmsActionParams) {
    const { to, message } = params;
    // This will be read from the server's environment variables
    const apiKey = process.env.TEXTBEE_API_KEY;

    if (!apiKey) {
        console.error("TEXTBEE_API_KEY is not set on the server. SMS will not be sent.");
        return { success: false, error: "API key not configured on the server." };
    }

    // Textbee expects numbers with country code but without '+'
    const formattedTo = to.startsWith('+') ? to.substring(1) : to;
    
    // Sanitize message - this is a good practice
    const sanitizedMessage = message.replace(/Rps/g, 'INR');
    
    try {
        const response = await fetch(TEXTBEE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apiKey: apiKey,
                sms: {
                    to: [formattedTo],
                    message: sanitizedMessage,
                },
            }),
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error('Textbee API Error:', responseData);
            throw new Error(responseData.message || `Failed to send SMS with status: ${response.status}`);
        }

        console.log("SMS sent successfully via server action:", responseData);
        return { success: true, data: responseData };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Exception in sendSmsAction:", errorMessage);
        return { success: false, error: errorMessage };
    }
}
