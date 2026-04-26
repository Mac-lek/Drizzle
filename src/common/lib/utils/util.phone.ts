import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const normalizeNigerianPhone = (phone: string): string => {
  if (phone.startsWith('0')) return `+234${phone.slice(1)}`;
  if (phone.startsWith('234')) return `+${phone}`;
  return phone;
};

export const isValidPhone = (phone: string): boolean => {
  try {
    return isValidPhoneNumber(phone, 'NG');
  } catch {
    return false;
  }
};

export const formatPhone = (phone: string): string => {
  try {
    return parsePhoneNumber(phone, 'NG').formatInternational();
  } catch {
    return phone;
  }
};
