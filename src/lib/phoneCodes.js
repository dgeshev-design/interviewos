import { getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberWithError } from 'libphonenumber-js'

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const toFlag = (iso) => iso.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)))

export const PHONE_CODES = getCountries()
  .map(iso => {
    try {
      return {
        iso,
        dialCode: `+${getCountryCallingCode(iso)}`,
        name: regionNames.of(iso) || iso,
        flag: toFlag(iso),
      }
    } catch {
      return null
    }
  })
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name))

export const PHONE_BY_ISO = Object.fromEntries(PHONE_CODES.map(c => [c.iso, c]))

/** Backward compat: find first ISO for a given dial code (e.g. '+44' → 'GB') */
export function dialCodeToISO(dialCode) {
  return PHONE_CODES.find(c => c.dialCode === dialCode)?.iso || 'GB'
}

/**
 * Validate a stored phone value.
 * Storage format: "ISO|localNumber"  e.g. "GB|07911123456"
 * Legacy format:  "+44|07911123456" — handled via dialCodeToISO
 */
export function isPhoneValid(stored) {
  if (!stored) return false
  const [left, num] = stored.split('|')
  if (!num) return false
  const iso = left.startsWith('+') ? dialCodeToISO(left) : left
  try {
    return isValidPhoneNumber(num, iso)
  } catch {
    return false
  }
}

/**
 * Normalize stored phone to E.164 (e.g. "+447911123456").
 * Strips leading trunk digit (0) automatically via libphonenumber-js.
 * Returns null if unparseable.
 */
export function normalizeToE164(stored) {
  if (!stored) return null
  const [left, num] = stored.split('|')
  if (!num) return null
  const iso = left.startsWith('+') ? dialCodeToISO(left) : left
  try {
    const phone = parsePhoneNumberWithError(num, iso)
    return phone.format('E.164')
  } catch {
    return null
  }
}
