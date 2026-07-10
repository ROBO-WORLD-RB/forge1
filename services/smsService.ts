/**
 * SMS/OTP Verification Service
 * Handles phone number verification via OTP codes
 * Integrated with Twilio for real SMS delivery
 */

import { logger } from '../utils/logger';

export interface SendOTPResult {
  success: boolean;
  error?: string;
  expiresAt?: Date;
  /** Present in dev mode so testers can complete signup without hunting console logs */
  devCode?: string;
}

export interface VerifyOTPResult {
  success: boolean;
  error?: string;
}

// OTP expiry time in minutes
const OTP_EXPIRY_MINUTES = 10;

// Twilio Configuration from environment
const TWILIO_SID = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
const TWILIO_PHONE = import.meta.env.VITE_TWILIO_PHONE_NUMBER;

const OTP_STORAGE_KEY = 'forge_otp_store';

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map<string, { code: string; expiresAt: Date }>();

function persistOtpStore() {
  if (!import.meta.env.DEV) return;
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
  if (!import.meta.env.DEV) return;
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
 * Format phone number to international format
 */
export function formatPhoneNumber(phone: string, country: 'GH' | 'NG'): string {
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove leading zero if present
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Remove country code if already present
  if (cleaned.startsWith('233') && country === 'GH') {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('234') && country === 'NG') {
    cleaned = cleaned.substring(3);
  }
  
  // Add country code
  const prefix = country === 'GH' ? '+233' : '+234';
  return `${prefix}${cleaned}`;
}

/**
 * Send OTP to phone number
 * Integrates with Twilio API
 */
export async function sendOTP(phone: string, country: 'GH' | 'NG'): Promise<SendOTPResult> {
  try {
    const formattedPhone = formatPhoneNumber(phone, country);
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    
    // Store OTP
    setStoredOtp(formattedPhone, otp, expiresAt);
    
    // In development, log the OTP
    if (import.meta.env.DEV) {
      console.log(`[DEV] OTP for ${formattedPhone}: ${otp}`);
    }

    // Call Twilio API if configured and looks like a valid account SID
    if (TWILIO_SID && TWILIO_SID.startsWith('AC') && TWILIO_TOKEN && TWILIO_PHONE) {
      const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
      const body = new URLSearchParams();
      body.append('To', formattedPhone);
      body.append('From', TWILIO_PHONE);
      body.append('Body', `Your FORGE verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`);

      try {
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          logger.error('Twilio API error', { error: errorData });
          throw new Error(errorData.message || 'Failed to send SMS via Twilio');
        }

        logger.info('OTP sent via Twilio', { phone: formattedPhone });
      } catch (err: any) {
        if (import.meta.env.DEV) {
          logger.warn('Twilio send failed, but continuing in DEV mode. Check console/logs for OTP.', { error: err.message });
        } else {
          throw err;
        }
      }
    } else {
      logger.warn('Twilio not configured or invalid Account SID (must start with AC). OTP only logged to console.', { phone: formattedPhone });
    }
    
    return {
      success: true,
      expiresAt,
      ...(import.meta.env.DEV ? { devCode: otp } : {}),
    };
  } catch (error: any) {
    logger.error('Failed to send OTP', { error: error.message });
    return {
      success: false,
      error: error.message || 'Failed to send verification code',
    };
  }
}

/**
 * Verify OTP code
 */
export async function verifyOTP(phone: string, country: 'GH' | 'NG', code: string): Promise<VerifyOTPResult> {
  try {
    const formattedPhone = formatPhoneNumber(phone, country);
    const stored = otpStore.get(formattedPhone);
    
    if (!stored) {
      return {
        success: false,
        error: 'No verification code found. Please request a new one.',
      };
    }
    
    // Check if expired
    if (new Date() > stored.expiresAt) {
      deleteStoredOtp(formattedPhone);
      return {
        success: false,
        error: 'Verification code has expired. Please request a new one.',
      };
    }
    
    // Check if code matches
    if (stored.code !== code) {
      return {
        success: false,
        error: 'Invalid verification code. Please try again.',
      };
    }
    
    // Success - remove OTP from store
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
 * Resend OTP (with rate limiting)
 */
export async function resendOTP(phone: string, country: 'GH' | 'NG'): Promise<SendOTPResult> {
  // In production, implement rate limiting here
  return sendOTP(phone, country);
}
