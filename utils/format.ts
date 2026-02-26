/** Capitalize first letter of each word */
export function capitalizeWords(str: string): string {
  if (!str || typeof str !== 'string') return str;
  return str.trim().replace(/\b\w/g, c => c.toUpperCase());
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isValidName(name: string): boolean {
  if (!name || name.trim().length < 4) return false;
  return /^[A-Za-z\s]+$/.test(name.trim());
}

export function isValidMobile(mobile: string): boolean {
  if (!mobile) return false;
  return /^[6-9]\d{9}$/.test(mobile.trim());
}

/** Format a Date or ISO string as DD-MM-YYYY */
export function formatDateDDMMYYYY(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}-${month}-${date.getFullYear()}`;
}

/** Parse DD-MM-YYYY string to a Date (returns null if invalid) */
export function parseDDMMYYYY(str: string): Date | null {
  if (!str) return null;
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year) return null;
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return null;
  return d;
}

/** Check if two dates are the same calendar day */
export function isSameDay(a: Date | string, b: Date | string): boolean {
  const da = typeof a === 'string' ? new Date(a) : a;
  const db = typeof b === 'string' ? new Date(b) : b;
  return (
    da.getDate() === db.getDate() &&
    da.getMonth() === db.getMonth() &&
    da.getFullYear() === db.getFullYear()
  );
}

export function isToday(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function isYesterday(dateString: string): boolean {
  const date = new Date(dateString);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
}

export function isLastWeek(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const sevenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
  return date >= sevenDaysAgo && date < startOfToday;
}

export function isThisMonth(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  return (
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}
