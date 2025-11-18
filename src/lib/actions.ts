
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
        console.warn("TEXTBEE_API_KEY is not set. SMS will not be sent.");
        return { success: false, error: "API key not configured." };
    }

    // Textbee expects numbers with country code but without '+'
    const formattedTo = to.startsWith('+') ? to.substring(1) : to;
    
    // Sanitize message
    const sanitizedMessage = message.replace(/Rps/g, 'Rps');
    
    try {
        const response = await fetch(TEXTBEE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apiKey,
                sms: {
                    to: [formattedTo],
                    message: sanitizedMessage,
                },
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to send SMS');
        }

        const data = await response.json();
        console.log("SMS sent successfully via server action:", data);
        return { success: true };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Exception in sendSmsAction:", errorMessage);
        return { success: false, error: errorMessage };
    }
}
