/**
 * AppScale SMS Service Adapter
 * Supports Semaphore (https://semaphore.co) and PhilSMS (https://philsms.com)
 * Handles phone normalization, masking, and audited SMS delivery.
 */

function normalizePhilippinePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('9')) {
    return '0' + digits; // 9171234567 -> 09171234567
  }
  if (digits.length === 11 && digits.startsWith('09')) {
    return digits; // 09171234567
  }
  if (digits.length === 12 && digits.startsWith('639')) {
    return '0' + digits.substring(2); // 639171234567 -> 09171234567
  }
  return digits;
}

function maskPhoneNumber(phone) {
  const norm = normalizePhilippinePhone(phone);
  if (!norm || norm.length < 7) return '******';
  // Example: 09661234526 -> 0966*****26
  const prefix = norm.substring(0, 4);
  const suffix = norm.substring(norm.length - 2);
  return `${prefix}*****${suffix}`;
}

async function sendVerificationSms({ phone, otp, customMessage }) {
  const normalized = normalizePhilippinePhone(phone);
  if (!normalized || normalized.length !== 11) {
    throw new Error('Invalid Philippine mobile number format.');
  }

  const message = customMessage || `AppScale: Your verification code is ${otp}. It expires in 5 minutes. Do not share this code.`;
  const maskedPhone = maskPhoneNumber(normalized);

  const provider = (process.env.SMS_PROVIDER || 'semaphore').toLowerCase().trim();
  const semaphoreApiKey = (process.env.SEMAPHORE_API_KEY || '').trim();
  const philSmsApiKey = (process.env.PHILSMS_API_KEY || '').trim();

  // 1. Semaphore Provider
  if (provider === 'semaphore' && semaphoreApiKey) {
    try {
      const response = await fetch('https://api.semaphore.co/api/v4/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: semaphoreApiKey,
          number: normalized,
          message: message,
          sendername: process.env.SEMAPHORE_SENDER_NAME || 'AppScale',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || (Array.isArray(data) && data[0]?.message) || 'Semaphore delivery failed');
      }

      console.log(`[SMS Service] Dispatched SMS to ${maskedPhone} via Semaphore`);
      return { success: true, provider: 'semaphore', recipient: maskedPhone };
    } catch (err) {
      console.error('[SMS Service] Semaphore Error:', err && err.message);
      throw err;
    }
  }

  // 2. PhilSMS Provider
  if (provider === 'philsms' && philSmsApiKey) {
    try {
      const response = await fetch('https://app.philsms.com/api/v3/sms/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${philSmsApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          recipient: '63' + normalized.substring(1), // format 639XXXXXXXXX
          sender_id: process.env.PHILSMS_SENDER_ID || 'PhilSMS',
          type: 'plain',
          message: message,
        }),
      });

      const data = await response.json();
      if (!response.ok || (data.status && data.status !== 'success')) {
        throw new Error(data.message || 'PhilSMS delivery failed');
      }

      console.log(`[SMS Service] Dispatched SMS to ${maskedPhone} via PhilSMS`);
      return { success: true, provider: 'philsms', recipient: maskedPhone };
    } catch (err) {
      console.error('[SMS Service] PhilSMS Error:', err && err.message);
      throw err;
    }
  }

  // 3. Sandbox / Mock Mode (when API keys are not yet provided in local/test environment)
  console.log(`[SMS Service Sandbox] Dispatched verification SMS to ${maskedPhone}. Message template: "AppScale: Your verification code is [PROTECTED]. It expires in 5 minutes."`);
  return { success: true, provider: 'sandbox', recipient: maskedPhone };
}

function isSmsConfigured() {
  const provider = (process.env.SMS_PROVIDER || 'semaphore').toLowerCase().trim();
  const semaphoreApiKey = (process.env.SEMAPHORE_API_KEY || '').trim();
  const philSmsApiKey = (process.env.PHILSMS_API_KEY || '').trim();
  return Boolean((provider === 'semaphore' && semaphoreApiKey) || (provider === 'philsms' && philSmsApiKey));
}

module.exports = {
  normalizePhilippinePhone,
  maskPhoneNumber,
  sendVerificationSms,
  isSmsConfigured,
};
