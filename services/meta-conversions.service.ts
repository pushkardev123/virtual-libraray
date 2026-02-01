import { ServerEvent, EventRequest, UserData, CustomData, Content } from 'facebook-nodejs-business-sdk';

/**
 * Meta Conversions API Service
 * Sends server-side conversion events to Meta (Facebook) for tracking
 */

interface PurchaseEventData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  amount: number;
  currency?: string;
  orderId: string;
  paymentId?: string;
  eventSourceUrl?: string;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Send Purchase event to Meta Conversions API
 */
export async function sendMetaPurchaseEvent(data: PurchaseEventData): Promise<void> {
  try {
    // Validate required environment variables
    const pixelId = process.env.META_PIXEL_ID;
    const accessToken = process.env.META_CONVERSIONS_API_ACCESS_TOKEN;

    if (!pixelId || !accessToken) {
      console.warn('⚠️ Meta Conversions API not configured. Skipping event tracking.');
      return;
    }

    // Prepare user data with hashing (Meta will hash it again for better privacy)
    const userData = new UserData()
      .setEmails(data.email ? [normalizeAndHash(data.email.toLowerCase().trim())] : [])
      .setPhones(data.phone ? [normalizeAndHash(data.phone.replace(/\D/g, ''))] : [])
      .setClientIpAddress(data.ipAddress)
      .setClientUserAgent(data.userAgent);

    // Set first name and last name if available
    if (data.firstName) {
      userData.setFirstNames([normalizeAndHash(data.firstName.toLowerCase().trim())]);
    }
    if (data.lastName) {
      userData.setLastNames([normalizeAndHash(data.lastName.toLowerCase().trim())]);
    }

    // Prepare custom data for purchase
    const customData = new CustomData()
      .setCurrency(data.currency || 'INR')
      .setValue(data.amount)
      .setOrderId(data.orderId)
      .setContentType('product')
      .setContents([
        new Content()
          .setId('premium_membership')
          .setQuantity(1)
          .setItemPrice(data.amount)
      ]);

    // Create server event
    const serverEvent = new ServerEvent()
      .setEventName('Purchase')
      .setEventTime(Math.floor(Date.now() / 1000))
      .setUserData(userData)
      .setCustomData(customData)
      .setEventSourceUrl(data.eventSourceUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com')
      .setActionSource('website');

    // Send event to Meta
    const eventRequest = new EventRequest(accessToken, pixelId)
      .setEvents([serverEvent]);

    // Set test event code if provided (for testing mode)
    if (process.env.META_TEST_EVENT_CODE) {
      eventRequest.setTestEventCode(process.env.META_TEST_EVENT_CODE);
    }

    const response = await eventRequest.execute();

    console.log('✅ Meta Purchase event sent successfully:', {
      orderId: data.orderId,
      amount: data.amount,
      eventsReceived: response.events_received,
      fbtrace_id: response.fbtrace_id,
    });

  } catch (error: any) {
    // Log error but don't throw - conversion tracking failures shouldn't break payment flow
    console.error('❌ Failed to send Meta Purchase event:', error.message);
    if (error.response?.data) {
      console.error('Meta API Error Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

/**
 * Send InitiateCheckout event to Meta Conversions API
 */
export async function sendMetaInitiateCheckoutEvent(data: Omit<PurchaseEventData, 'paymentId'>): Promise<void> {
  try {
    const pixelId = process.env.META_PIXEL_ID;
    const accessToken = process.env.META_CONVERSIONS_API_ACCESS_TOKEN;

    if (!pixelId || !accessToken) {
      console.warn('⚠️ Meta Conversions API not configured. Skipping event tracking.');
      return;
    }

    const userData = new UserData()
      .setEmails(data.email ? [normalizeAndHash(data.email.toLowerCase().trim())] : [])
      .setPhones(data.phone ? [normalizeAndHash(data.phone.replace(/\D/g, ''))] : [])
      .setClientIpAddress(data.ipAddress)
      .setClientUserAgent(data.userAgent);

    if (data.firstName) {
      userData.setFirstNames([normalizeAndHash(data.firstName.toLowerCase().trim())]);
    }
    if (data.lastName) {
      userData.setLastNames([normalizeAndHash(data.lastName.toLowerCase().trim())]);
    }

    const customData = new CustomData()
      .setCurrency(data.currency || 'INR')
      .setValue(data.amount)
      .setContentType('product')
      .setContents([
        new Content()
          .setId('premium_membership')
          .setQuantity(1)
          .setItemPrice(data.amount)
      ]);

    const serverEvent = new ServerEvent()
      .setEventName('InitiateCheckout')
      .setEventTime(Math.floor(Date.now() / 1000))
      .setUserData(userData)
      .setCustomData(customData)
      .setEventSourceUrl(data.eventSourceUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com')
      .setActionSource('website');

    const eventRequest = new EventRequest(accessToken, pixelId)
      .setEvents([serverEvent]);

    // Set test event code if provided (for testing mode)
    if (process.env.META_TEST_EVENT_CODE) {
      eventRequest.setTestEventCode(process.env.META_TEST_EVENT_CODE);
    }

    const response = await eventRequest.execute();

    console.log('✅ Meta InitiateCheckout event sent successfully:', {
      orderId: data.orderId,
      amount: data.amount,
      eventsReceived: response.events_received,
    });

  } catch (error: any) {
    console.error('❌ Failed to send Meta InitiateCheckout event:', error.message);
  }
}

/**
 * Normalize and hash data for Meta's privacy requirements
 * Meta expects SHA-256 hashed values for PII
 */
function normalizeAndHash(value: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Test Meta Conversions API connection
 */
export async function testMetaConversionsAPI(): Promise<{ success: boolean; message: string }> {
  try {
    const pixelId = process.env.META_PIXEL_ID;
    const accessToken = process.env.META_CONVERSIONS_API_ACCESS_TOKEN;

    if (!pixelId || !accessToken) {
      return {
        success: false,
        message: 'Meta Pixel ID or Access Token not configured',
      };
    }

    // Send a test event
    const userData = new UserData()
      .setEmails([normalizeAndHash('test@example.com')])
      .setClientIpAddress('127.0.0.1')
      .setClientUserAgent('Test Agent');

    const customData = new CustomData()
      .setCurrency('INR')
      .setValue(1);

    const serverEvent = new ServerEvent()
      .setEventName('PageView')
      .setEventTime(Math.floor(Date.now() / 1000))
      .setUserData(userData)
      .setCustomData(customData)
      .setEventSourceUrl(process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com')
      .setActionSource('website');

    const eventRequest = new EventRequest(accessToken, pixelId)
      .setEvents([serverEvent]);

    // Set test event code if provided (for testing mode)
    if (process.env.META_TEST_EVENT_CODE) {
      eventRequest.setTestEventCode(process.env.META_TEST_EVENT_CODE);
    }

    const response = await eventRequest.execute();

    return {
      success: true,
      message: `Meta Conversions API connected successfully. Events received: ${response.events_received}`,
    };

  } catch (error: any) {
    return {
      success: false,
      message: `Meta Conversions API error: ${error.message}`,
    };
  }
}
