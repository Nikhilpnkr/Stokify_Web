
"use server";

import { sendSms } from "@/lib/sms";

type SendSmsActionParams = {
    to: string;
    message: string;
};

export async function sendSmsAction(params: SendSmsActionParams) {
    try {
        const result = await sendSms(params);
        if (!result.success) {
            console.error("SMS action failed:", result.error);
            return { success: false, error: result.error };
        }
        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        console.error("Exception in sendSmsAction:", errorMessage);
        return { success: false, error: errorMessage };
    }
}
