import type { Country, Currency } from '../types/database';

export interface CountryDetails {
  code: Country;
  name: string;
  flag: string;
  currency: Currency;
  currencyName: string;
  currencySymbol: string;
  phoneCode: string;
  phonePlaceholder: string;
  locale: string;
}

export const COUNTRY_DETAILS: Record<Country, CountryDetails> = {
  GH: {
    code: 'GH',
    name: 'Ghana',
    flag: '🇬🇭',
    currency: 'GHS',
    currencyName: 'Ghanaian Cedi',
    currencySymbol: '₵',
    phoneCode: '233',
    phonePlaceholder: '050 123 4567',
    locale: 'en-GH',
  },
  NG: {
    code: 'NG',
    name: 'Nigeria',
    flag: '🇳🇬',
    currency: 'NGN',
    currencyName: 'Nigerian Naira',
    currencySymbol: '₦',
    phoneCode: '234',
    phonePlaceholder: '0801 234 5678',
    locale: 'en-NG',
  },
  TG: {
    code: 'TG',
    name: 'Togo',
    flag: '🇹🇬',
    currency: 'XOF',
    currencyName: 'West African CFA Franc',
    currencySymbol: 'CFA',
    phoneCode: '228',
    phonePlaceholder: '90 12 34 56',
    locale: 'fr-TG',
  },
};

export const SUPPORTED_COUNTRIES = Object.keys(COUNTRY_DETAILS) as Country[];

export function isCountry(value: unknown): value is Country {
  return typeof value === 'string' && value in COUNTRY_DETAILS;
}

export function getCountryDetails(country: Country | string | null | undefined): CountryDetails {
  return isCountry(country) ? COUNTRY_DETAILS[country] : COUNTRY_DETAILS.GH;
}

export function currencyForCountry(country: Country | string | null | undefined): Currency {
  return getCountryDetails(country).currency;
}

export function currencySymbol(currency: Currency | string | null | undefined): string {
  switch (currency) {
    case 'NGN': return '₦';
    case 'XOF': return 'CFA';
    case 'GHS':
    default: return '₵';
  }
}

export function formatMoney(
  amount: number,
  currency: Currency,
  options: Intl.NumberFormatOptions = {}
): string {
  const details = Object.values(COUNTRY_DETAILS).find((item) => item.currency === currency)
    ?? COUNTRY_DETAILS.GH;
  const maximumFractionDigits = currency === 'XOF' ? 0 : 2;
  const formatted = new Intl.NumberFormat(details.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
    ...options,
  }).format(amount);
  return `${details.currencySymbol}${details.currencySymbol === 'CFA' ? ' ' : ''}${formatted}`;
}
