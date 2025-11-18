
const TEXTBEE_API_URL = "https://api.textbee.dev/api/v1/messaging";

type SendSmsParams = {
    to: string;
    message: string;
};

export async function sendSms({ to, message }: SendSmsParams) {
    const apiKey = process.env.TEXTBEE_API_KEY;

    if (!apiKey) {
        console.warn("TEXTBEE_API_KEY is not set. SMS will not be sent.");
        return Promise.resolve({ success: false, error: "API key not configured." });
    }

    // Textbee expects numbers with country code but without '+'
    const formattedTo = to.startsWith('+') ? to.substring(1) : to;
    
    // Sanitize message: remove symbols, keep it simple
    const sanitizedMessage = message.replace(/₹/g, 'Rps');
    
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
        console.log("SMS sent successfully:", data);
        return { success: true, data };

    } catch (error) {
        console.error("Error sending SMS via Textbee:", error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}
