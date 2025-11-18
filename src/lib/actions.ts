'use server';

export async function sendSmsAction(to: string, message: string): Promise<{ success: boolean; message: string }> {
  const apiKey = process.env.TEXTBEE_API_KEY;
  const deviceId = process.env.TEXTBEE_DEVICE_ID;

  if (!apiKey || !deviceId) {
    const errorMessage = 'SMS Error: API key or Device ID is not configured on the server.';
    console.error(errorMessage);
    return { success: false, message: errorMessage };
  }

  // Construct the correct URL with deviceId in the path and apiKey as a query param.
  const url = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/sendSMS?apiKey=${apiKey}`;

  // The payload now only contains the sms object.
  const payload = {
    sms: {
      to,
      message,
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('SMS sent successfully:', result);
      return { success: true, message: 'SMS sent successfully!' };
    } else {
      console.error('Failed to send SMS:', result.message || 'Unknown error');
      return { success: false, message: `Failed to send SMS: ${result.message || 'Unknown error'}` };
    }
  } catch (error: any) {
    console.error('Error sending SMS:', error);
    return { success: false, message: `An error occurred: ${error.message}` };
  }
}
