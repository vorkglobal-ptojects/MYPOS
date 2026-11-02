/**
 * Date and Time Utilities for Sri Lanka Standard Time (Asia/Colombo, UTC+5:30)
 */

export function getSriLankaDate(input?: Date | string | number | null): string {
  try {
    const d = input ? (input instanceof Date ? input : new Date(input)) : new Date();
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

export function getSriLankaTimestamp(input?: Date | string | number | null): string {
  try {
    const d = input ? (input instanceof Date ? input : new Date(input)) : new Date();
    if (isNaN(d.getTime())) return new Date().toISOString();
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d).replace(',', '');
  } catch {
    return new Date().toISOString();
  }
}

