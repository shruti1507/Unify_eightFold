/**
 * Utility functions for dynamic data normalization
 */
export const NormalizerRegistry = {
  e164: (phone) => {
    if (!phone) return null;
    if (Array.isArray(phone)) phone = phone[0];
    if (typeof phone !== 'string') return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length > 10) return `+${digits}`;
    return phone;
  },

  lowercase_dedupe: (val) => {
    if (!val) return null;
    let arr = Array.isArray(val) ? val : [val];
    const set = new Set(arr.map(s => {
      if (typeof s !== 'string') return s;
      return s.trim().toLowerCase().replace(/\s+/g, '');
    }));
    return Array.from(set);
  },

  strip_special_chars: (str) => {
    if (!str) return null;
    if (Array.isArray(str)) str = str[0];
    if (typeof str !== 'string') return str;
    return str.replace(/[^\w\s-]/gi, '').trim();
  }
};

export const Normalizer = {
  // Legacy internal normalizers for adapters if needed
  date: (dateStr) => {
    if (!dateStr || dateStr.toLowerCase() === 'present') return dateStr || null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString();
  },

  phone: (phoneStr) => {
    return NormalizerRegistry.e164(phoneStr);
  },

  skill: (skill) => {
    if (!skill) return '';
    return skill.trim().toLowerCase().replace(/\s+/g, '');
  },

  // Dynamic execution
  apply: (value, normalizerName) => {
    if (!normalizerName || !NormalizerRegistry[normalizerName]) return value;
    return NormalizerRegistry[normalizerName](value);
  }
};
