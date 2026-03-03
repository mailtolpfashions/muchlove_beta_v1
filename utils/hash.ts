export function generateId(prefix?: string): string {
    const random = Math.random().toString(36).substring(2, 8);
    if (prefix) return `${prefix}-${random}`;
    return random;
  }
  