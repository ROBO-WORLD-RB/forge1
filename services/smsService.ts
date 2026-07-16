/**
 * SMS/OTP Verification Service
 * Handles phone number verification via OTP codes
 * Twilio (primary) or Africa's Talking (fallback). When neither is configured
 * or send fails, returns displayCode so beta users can still verify on-screen.
 *
 * NOTE (beta): Signup/login UI no longer calls sendOTP/verifyOTP — verification is deferred.
 * Keep this module for a future rollout. formatPhoneNumber may still be used by signup.
 */

import { logger } from '../utils/logger';

export interface SendOTPResult {
  success: boolean;
  error?: string;
  expiresAt?: Date;
  /**
   * Present when SMS was NOT delivered (no provider / send failed).
   * Shown on-screen so beta signup is not blocked. Hidden when SMS succeeds.
   */
  displayCode?: string;
  /** @deprecated use displayCode — kept for older callers */
  devCode?: string;
  smsDelivered?: boolean;
  warning?: string;
}

export interface VerifyOTPResult {
  success: boolean;
  error?: string;
}

// OTP expiry time in minutes
const OTP_EXPIRY_MINUTES = 10;

// Twilio Configuration from environment
const TWILIO_SID = import.meta.env.VITE_TWILIO_ACCOUNT_SID as string | undefined;
const TWILIO_TOKEN = import.meta.env.VITE_TWILIO_AUTH_TOKEN as string | undefined;
const TWILIO_PHONE = import.meta.env.VITE_TWILIO_PHONE_NUMBER as string | undefined;

// Africa's Talking (optional alternative)
const AT_API_KEY = import.meta.env.VITE_AT_API_KEY as string | undefined;
const AT_USERNAME = import.meta.env.VITE_AT_USERNAME as string | undefined;

const OTP_STORAGE_KEY = 'forge_otp_store';

// In-memory + sessionStorage so OTP survives soft remounts during signup
const otpStore = new Map<string, { code: string; expiresAt: Date }>();

function isTwilioConfigured(): boolean {
  return Boolean(
    TWILIO_SID &&
      TWILIO_SID.startsWith('AC') &&
      TWILIO_TOKEN &&
      TWILIO_PHONE
  );
}

function isAfricaTalkingConfigured(): boolean {
  return Boolean(
    AT_API_KEY &&
      AT_USERNAME &&
      AT_API_KEY !== 'your_africastalking_api_key' &&
      AT_USERNAME !== 'your_africastalking_username'
  );
}

export function isSmsProviderConfigured(): boolean {
  return isTwilioConfigured() || isAfricaTalkingConfigured();
}

function persistOtpStore() {
  try {
    const entries = Array.from(otpStore.entries()).map(([phone, entry]) => [
      phone,
      { code: entry.code, expiresAt: entry.expiresAt.toISOString() },
    ]);
    sessionStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // sessionStorage may be unavailable in some contexts
  }
}

function loadOtpStore() {
  try {
    const raw = sessionStorage.getItem(OTP_STORAGE_KEY);
    if (!raw) return;
    const entries: [string, { code: string; expiresAt: string }][] = JSON.parse(raw);
    for (const [phone, entry] of entries) {
      const expiresAt = new Date(entry.expiresAt);
      if (expiresAt > new Date()) {
        otpStore.set(phone, { code: entry.code, expiresAt });
      }
    }
  } catch {
    // ignore corrupt storage
  }
}

loadOtpStore();

function setStoredOtp(phone: string, code: string, expiresAt: Date) {
  otpStore.set(phone, { code, expiresAt });
  persistOtpStore();
}

function deleteStoredOtp(phone: string) {
  otpStore.delete(phone);
  persistOtpStore();
}

/**
 * Generate a 6-digit OTP code
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Format phone number to international format (+233 / +234).
 * Accepts local (0244...), national without 0 (244...), or already-prefixed numbers.
 */
export function formatPhoneNumber(phone: string, country: 'GH' | 'NG'): string {
  let cleaned = phone.replace(/\D/g, '');

  // Remove leading zero if present
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  const cc = country === 'GH' ? '233' : '234';

  // Strip country code if already present (with or without +)
  if (cleaned.startsWith(cc)) {
    cleaned = cleaned.substring(cc.length);
  }

  // Ghana mobiles are typically 9 digits after country code (e.g. 244123456)
  // Nigeria same for common mobile lengths — don't over-validate here

  return `+${cc}${cleaned}`;
}

async function sendViaTwilio(to: string, message: string): Promise<void> {
  const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
  const body = new URLSearchParams();
  body.append('To', to);
  body.append('From', TWILIO_PHONE!);
  body.append('Body', message);

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    logger.error('Twilio API error', { error: errorData });
    throw new Error(
      (errorData as { message?: string }).message || 'Failed to send SMS via Twilio'
    );
  }
}

async function sendViaAfricaTalking(to: string, message: string): Promise<void> {
  const body = new URLSearchParams();
  body.append('username', AT_USERNAME!);
  body.append('to', to);
  body.append('message', message);

  const response = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      apiKey: AT_API_KEY!,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    logger.error("Africa's Talking API error", { status: response.status, text });
    throw new Error(`Failed to send SMS via Africa's Talking (${response.status})`);
  }

  // AT returns 201 with SMSMessageData; treat HTTP success as delivered attempt
  const data = await response.json().catch(() => null);
  const recipients = data?.SMSMessageData?.Recipients;
  if (Array.isArray(recipients) && recipients.length > 0) {
    const status = String(recipients[0].status || '').toLowerCase();
    if (status && status !== 'success' && !status.includes('sent')) {
      throw new Error(recipients[0].status || "Africa's Talking rejected the message");
    }
  }
}

function fallbackResult(
  otp: string,
  expiresAt: Date,
  warning: string
): SendOTPResult {
  return {
    success: true,
    expiresAt,
    displayCode: otp,
    devCode: otp,
    smsDelivered: false,
    warning,
  };
}

/**
 * Send OTP to phone number.
 * On missing provider or send failure: still stores OTP and returns displayCode (beta unblock).
 */
export async function sendOTP(phone: string, country: 'GH' | 'NG'): Promise<SendOTPResult> {
  try {
    const formattedPhone = formatPhoneNumber(phone, country);
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const message = `Your FORGE verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`;

    setStoredOtp(formattedPhone, otp, expiresAt);

    if (import.meta.env.DEV) {
      console.log(`[DEV] OTP for ${formattedPhone}: ${otp}`);
    }

    if (!isSmsProviderConfigured()) {
      logger.warn(
        'SMS provider not configured. Returning on-screen OTP for beta.',
        { phone: formattedPhone }
      );
      return fallbackResult(
        otp,
        expiresAt,
        'SMS not configured — use this code to continue. Add Twilio or Africa\'s Talking env vars on Render for real SMS.'
      );
    }

    try {
      if (isTwilioConfigured()) {
        await sendViaTwilio(formattedPhone, message);
        logger.info('OTP sent via Twilio', { phone: formattedPhone });
      } else {
        await sendViaAfricaTalking(formattedPhone, message);
        logger.info("OTP sent via Africa's Talking", { phone: formattedPhone });
      }

      return {
        success: true,
        expiresAt,
        smsDelivered: true,
      };
    } catch (err: any) {
      const reason = err?.message || 'SMS send failed';
      logger.warn('SMS send failed; showing on-screen OTP for beta', {
        phone: formattedPhone,
        error: reason,
      });
      return fallbackResult(
        otp,
        expiresAt,
        `SMS could not be sent (${reason}). Use this code to continue.`
      );
    }
  } catch (error: any) {
    logger.error('Failed to send OTP', { error: error.message });
    return {
      success: false,
      error: error.message || 'Failed to send verification code',
      smsDelivered: false,
    };
  }
}

/**
 * Verify OTP code
 */
export async function verifyOTP(
  phone: string,
  country: 'GH' | 'NG',
  code: string
): Promise<VerifyOTPResult> {
  try {
    // Reload in case another tab/chunk refreshed storage
    loadOtpStore();
    const formattedPhone = formatPhoneNumber(phone, country);
    const stored = otpStore.get(formattedPhone);

    if (!stored) {
      return {
        success: false,
        error: 'No verification code found. Please request a new one.',
      };
    }

    if (new Date() > stored.expiresAt) {
      deleteStoredOtp(formattedPhone);
      return {
        success: false,
        error: 'Verification code has expired. Please request a new one.',
      };
    }

    if (stored.code !== code.trim()) {
      return {
        success: false,
        error: 'Invalid verification code. Please try again.',
      };
    }

    deleteStoredOtp(formattedPhone);

    return {
      success: true,
    };
  } catch (error: any) {
    logger.error('Failed to verify OTP', { error: error.message });
    return {
      success: false,
      error: error.message || 'Verification failed',
    };
  }
}

/**
 * Resend OTP — generates a new code and retries SMS delivery
 */
export async function resendOTP(phone: string, country: 'GH' | 'NG'): Promise<SendOTPResult> {
  return sendOTP(phone, country);
}
