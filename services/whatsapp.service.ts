/**
 * WhatsApp Notification Service
 * Sends automated WhatsApp messages for payment confirmations
 * 
 * Supported Providers:
 * 1. Twilio (Recommended)
 * 2. MSG91
 * 3. WhatsApp Business API
 */

interface PaymentDetails {
  name: string;
  email: string;
  phone: string;
  amount: number; // in paise
  orderId: string;
  paymentId?: string;
  isPremium: boolean;
}

interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send payment confirmation via WhatsApp
 */
export async function sendPaymentConfirmationWhatsApp(
  details: PaymentDetails
): Promise<WhatsAppResponse> {
  const provider = process.env.WHATSAPP_PROVIDER || 'twilio';

  console.log(`📱 Sending WhatsApp notification via ${provider}...`);

  try {
    switch (provider.toLowerCase()) {
      case 'twilio':
        return await sendViaTwilio(details);
      case 'msg91':
        return await sendViaMSG91(details);
      case 'waba':
        return await sendViaWhatsAppBusinessAPI(details);
      default:
        console.warn(`Unknown provider: ${provider}. Skipping WhatsApp notification.`);
        return { success: false, error: 'Unknown provider' };
    }
  } catch (error: any) {
    console.error('WhatsApp notification error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send via Twilio WhatsApp API
 */
async function sendViaTwilio(details: PaymentDetails): Promise<WhatsAppResponse> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER; // Format: whatsapp:+14155238886

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('Twilio credentials not configured. Skipping WhatsApp notification.');
    return { success: false, error: 'Twilio not configured' };
  }

  // Format phone number for WhatsApp (must include country code)
  const toNumber = formatPhoneForWhatsApp(details.phone);
  const message = generatePaymentMessage(details);

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: `whatsapp:${toNumber}`,
          Body: message,
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      console.log('✅ WhatsApp sent via Twilio:', data.sid);
      return { success: true, messageId: data.sid };
    } else {
      console.error('❌ Twilio error:', data.message);
      return { success: false, error: data.message };
    }
  } catch (error: any) {
    console.error('❌ Twilio request failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send via MSG91 WhatsApp API
 */
async function sendViaMSG91(details: PaymentDetails): Promise<WhatsAppResponse> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_WHATSAPP_TEMPLATE_ID;

  if (!authKey || !templateId) {
    console.warn('MSG91 credentials not configured. Skipping WhatsApp notification.');
    return { success: false, error: 'MSG91 not configured' };
  }

  const phone = formatPhoneForWhatsApp(details.phone);

  try {
    const response = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: authKey,
      },
      body: JSON.stringify({
        integrated_number: process.env.MSG91_WHATSAPP_NUMBER,
        content_type: 'template',
        payload: {
          to: phone,
          type: 'template',
          template: {
            name: templateId,
            language: {
              code: 'en',
              policy: 'deterministic',
            },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: details.name },
                  { type: 'text', text: `₹${(details.amount / 100).toFixed(2)}` },
                  { type: 'text', text: details.orderId },
                ],
              },
            ],
          },
        },
      }),
    });

    const data = await response.json();

    if (response.ok && data.type === 'success') {
      console.log('✅ WhatsApp sent via MSG91');
      return { success: true, messageId: data.message };
    } else {
      console.error('❌ MSG91 error:', data.message);
      return { success: false, error: data.message };
    }
  } catch (error: any) {
    console.error('❌ MSG91 request failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send via WhatsApp Business API (Direct)
 */
async function sendViaWhatsAppBusinessAPI(details: PaymentDetails): Promise<WhatsAppResponse> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;

  if (!accessToken || !phoneNumberId || !templateName) {
    console.warn('WhatsApp Business API not configured. Skipping notification.');
    return { success: false, error: 'WhatsApp Business API not configured' };
  }

  const phone = formatPhoneForWhatsApp(details.phone);

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: 'en_US',
            },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: details.name },
                  { type: 'text', text: `₹${(details.amount / 100).toFixed(2)}` },
                  { type: 'text', text: details.orderId },
                ],
              },
            ],
          },
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      console.log('✅ WhatsApp sent via Business API:', data.messages?.[0]?.id);
      return { success: true, messageId: data.messages?.[0]?.id };
    } else {
      console.error('❌ WhatsApp Business API error:', data.error?.message);
      return { success: false, error: data.error?.message };
    }
  } catch (error: any) {
    console.error('❌ WhatsApp Business API request failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Format phone number for WhatsApp (with country code)
 */
function formatPhoneForWhatsApp(phone: string): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If doesn't start with country code, assume India (+91)
  if (cleaned.startsWith('91')) {
    return `+${cleaned}`;
  } else if (cleaned.length === 10) {
    return `+91${cleaned}`;
  } else {
    return `+${cleaned}`;
  }
}

/**
 * Generate payment confirmation message
 */
function generatePaymentMessage(details: PaymentDetails): string {
  const amount = (details.amount / 100).toFixed(2);
  
  return `🎉 *Payment Successful!*

Hi ${details.name},

Thank you for your payment! Your transaction has been completed successfully.

*Payment Details:*
💰 Amount: ₹${amount}
📝 Order ID: ${details.orderId}
${details.paymentId ? `🔑 Payment ID: ${details.paymentId}` : ''}
📧 Email: ${details.email}

${details.isPremium ? `
🌟 *You are now a PREMIUM member!*
✅ Access to all premium features
✅ Valid for 1 year
✅ 24/7 Virtual Study Space
` : ''}

You can now login at: https://virtuallibrary.in
Use your email (${details.email}) to login via OTP.

Need help? Reply to this message or contact us at support@virtuallibrary.in

Welcome to Virtual Library! 📚✨`;
}

/**
 * Send welcome WhatsApp for premium members
 */
export async function sendWelcomeWhatsApp(
  name: string,
  phone: string,
  email: string
): Promise<WhatsAppResponse> {
  const provider = process.env.WHATSAPP_PROVIDER || 'twilio';

  const welcomeMessage = `🎉 *Welcome to Virtual Library Premium!*

Hi ${name},

Congratulations! You're now part of our premium community.

*What's Next?*
1️⃣ Login at https://virtuallibrary.in
2️⃣ Use your email: ${email}
3️⃣ Verify via OTP
4️⃣ Start your study journey!

*Your Premium Benefits:*
✅ 24/7 Virtual Study Space
✅ Expert-Led Mental Health Sessions
✅ Forest Study Groups
✅ Priority Support
✅ Valid for 1 year

Questions? We're here to help!
Reply to this message anytime.

Happy Studying! 📚💪`;

  console.log(`📱 Sending welcome WhatsApp via ${provider}...`);

  try {
    if (provider === 'twilio') {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

      if (!accountSid || !authToken || !fromNumber) {
        return { success: false, error: 'Twilio not configured' };
      }

      const toNumber = formatPhoneForWhatsApp(phone);

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          },
          body: new URLSearchParams({
            From: fromNumber,
            To: `whatsapp:${toNumber}`,
            Body: welcomeMessage,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Welcome WhatsApp sent:', data.sid);
        return { success: true, messageId: data.sid };
      } else {
        return { success: false, error: data.message };
      }
    }

    return { success: false, error: 'Provider not supported for welcome message' };
  } catch (error: any) {
    console.error('❌ Welcome WhatsApp failed:', error.message);
    return { success: false, error: error.message };
  }
}

