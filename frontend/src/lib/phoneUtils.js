/**
 * Sanitizes and extracts the 10-digit Indian mobile number from any user input,
 * clipboard paste, or mobile browser/keyboard autofill (which often prepends +91, 0091, 0, or spaces).
 *
 * @param {string} raw - Raw input string (e.g. "+91 62682 04871", "+916268204871", "06268204871", "916268204871", "6268204871")
 * @returns {string} - Clean 10-digit mobile number string (or up to 10 digits as typed)
 */
export function sanitizeIndianPhoneNumber(raw = '') {
  if (!raw) return ''
  let text = String(raw).trim()

  // 1. Strip explicit country code prefixes: +91, + 91, 0091, +091, +0091
  text = text.replace(/^(\+0091|\+091|\+91|\+\s*91|0091)\s*/, '')

  // 2. Strip all non-digits (spaces, dashes, parentheses, etc.)
  let digits = text.replace(/\D/g, '')

  // 3. Handle cases where autofill or paste provided 12 digits starting with '91' without plus (e.g. 916268204871)
  if (digits.length > 10 && digits.startsWith('91')) {
    digits = digits.slice(2)
  } else if (digits.length > 10 && digits.startsWith('0')) {
    // 4. Handle cases where autofill or paste provided 11 digits starting with '0' (e.g. 06268204871)
    digits = digits.replace(/^0+/, '')
  }

  // 5. Cap at exactly 10 digits
  return digits.slice(0, 10)
}
