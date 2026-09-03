import { describe, expect, it } from 'vitest';
import {
  COUNTRY_DETAILS,
  SUPPORTED_COUNTRIES,
  currencyForCountry,
  currencySymbol,
  formatMoney,
} from './locale';

describe('country and currency localization', () => {
  it.each([
    ['GH', 'GHS', '₵'],
    ['NG', 'NGN', '₦'],
    ['TG', 'XOF', 'CFA'],
  ] as const)('%s maps to %s and %s', (country, currency, symbol) => {
    expect(currencyForCountry(country)).toBe(currency);
    expect(currencySymbol(currency)).toBe(symbol);
    expect(COUNTRY_DETAILS[country].currency).toBe(currency);
    expect(formatMoney(1250, currency)).toContain(symbol);
  });

  it('offers all three signup countries', () => {
    expect(SUPPORTED_COUNTRIES).toEqual(['GH', 'NG', 'TG']);
  });

  it('keeps the safe legacy fallback for old profiles without a country', () => {
    expect(currencyForCountry(null)).toBe('GHS');
  });
});
