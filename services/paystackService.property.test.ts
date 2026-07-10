/**
 * Property-based tests for Paystack Service
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateReference,
  toSmallestUnit,
  fromSmallestUnit,
  formatCurrency,
  calculateBookingTotal,
  createBookingPayment,
} from './paystackService';

describe('paystackService', () => {
  describe('generateReference', () => {
    it('should always generate unique references', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (count) => {
          const refs = new Set<string>();
          for (let i = 0; i < count; i++) {
            refs.add(generateReference());
          }
          return refs.size === count;
        })
      );
    });

    it('should include prefix in reference', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 10 }), (prefix) => {
          const ref = generateReference(prefix);
          return ref.startsWith(prefix.toUpperCase());
        })
      );
    });

    it('should generate non-empty references', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const ref = generateReference();
          return ref.length > 0;
        })
      );
    });
  });

  describe('toSmallestUnit / fromSmallestUnit', () => {
    it('should be inverse operations', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 1000000, noNaN: true }), (amount) => {
          const smallest = toSmallestUnit(amount);
          const back = fromSmallestUnit(smallest);
          // Allow for floating point rounding (to 2 decimal places)
          return Math.abs(back - Math.round(amount * 100) / 100) < 0.01;
        })
      );
    });

    it('should convert to integer (kobo/pesewas)', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 1000000, noNaN: true }), (amount) => {
          const smallest = toSmallestUnit(amount);
          return Number.isInteger(smallest);
        })
      );
    });

    it('should multiply by 100', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10000 }), (amount) => {
          return toSmallestUnit(amount) === amount * 100;
        })
      );
    });
  });

  describe('formatCurrency', () => {
    it('should include GHS symbol for Ghana cedis', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 1000000, noNaN: true }), (amount) => {
          const formatted = formatCurrency(amount, 'GHS');
          return formatted.includes('GH₵');
        })
      );
    });

    it('should include NGN symbol for Nigerian naira', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 1000000, noNaN: true }), (amount) => {
          const formatted = formatCurrency(amount, 'NGN');
          return formatted.includes('₦');
        })
      );
    });

    it('should format with 2 decimal places', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10000 }), (amount) => {
          const formatted = formatCurrency(amount, 'GHS');
          return formatted.includes('.00');
        })
      );
    });
  });

  describe('calculateBookingTotal', () => {
    it('should multiply hours by hourly rate', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 24 }),
          fc.float({ min: 1, max: 10000, noNaN: true }),
          (hours, rate) => {
            const total = calculateBookingTotal(hours, rate);
            return Math.abs(total - hours * rate) < 0.01;
          }
        )
      );
    });

    it('should return 0 for 0 hours', () => {
      fc.assert(
        fc.property(fc.float({ min: 1, max: 10000, noNaN: true }), (rate) => {
          return calculateBookingTotal(0, rate) === 0;
        })
      );
    });

    it('should be positive for positive inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 24 }),
          fc.integer({ min: 1, max: 10000 }),
          (hours, rate) => {
            return calculateBookingTotal(hours, rate) > 0;
          }
        )
      );
    });
  });

  describe('createBookingPayment', () => {
    // Generate a valid date string in YYYY-MM-DD format
    const dateArb = fc.tuple(
      fc.integer({ min: 2020, max: 2030 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 })
    ).map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

    const bookingArb = fc.record({
      workerId: fc.uuid(),
      workerName: fc.string({ minLength: 1, maxLength: 50 }),
      customerEmail: fc.emailAddress(),
      customerName: fc.string({ minLength: 1, maxLength: 50 }),
      customerId: fc.uuid(),
      hours: fc.integer({ min: 1, max: 12 }),
      hourlyRate: fc.integer({ min: 10, max: 1000 }),
      currency: fc.constantFrom('GHS' as const, 'NGN' as const),
      scheduledDate: dateArb,
      description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
    });

    it('should create payment with correct email', () => {
      fc.assert(
        fc.property(bookingArb, (booking) => {
          const payment = createBookingPayment(booking);
          return payment.email === booking.customerEmail;
        })
      );
    });

    it('should convert amount to smallest unit', () => {
      fc.assert(
        fc.property(bookingArb, (booking) => {
          const payment = createBookingPayment(booking);
          const expectedAmount = Math.round(booking.hours * booking.hourlyRate * 100);
          return payment.amount === expectedAmount;
        })
      );
    });

    it('should use correct currency', () => {
      fc.assert(
        fc.property(bookingArb, (booking) => {
          const payment = createBookingPayment(booking);
          return payment.currency === booking.currency;
        })
      );
    });

    it('should include worker info in metadata', () => {
      fc.assert(
        fc.property(bookingArb, (booking) => {
          const payment = createBookingPayment(booking);
          return (
            payment.metadata?.workerId === booking.workerId &&
            payment.metadata?.workerName === booking.workerName
          );
        })
      );
    });

    it('should include webhook reconciliation fields in metadata', () => {
      fc.assert(
        fc.property(bookingArb, (booking) => {
          const payment = createBookingPayment(booking);
          return (
            payment.metadata?.type === 'booking' &&
            payment.metadata?.user_id === booking.customerId
          );
        })
      );
    });

    it('should generate reference starting with BKG', () => {
      fc.assert(
        fc.property(bookingArb, (booking) => {
          const payment = createBookingPayment(booking);
          return payment.reference?.startsWith('BKG');
        })
      );
    });
  });
});
