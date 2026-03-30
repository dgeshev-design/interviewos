import { getCountries, getCountryCallingCode } from 'libphonenumber-js'

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const flag = (iso) => iso.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)))

export const PHONE_CODES = getCountries()
  .map(iso => {
    try {
      return {
        code: `+${getCountryCallingCode(iso)}`,
        iso,
        label: `${flag(iso)} ${regionNames.of(iso)} (+${getCountryCallingCode(iso)})`,
      }
    } catch {
      return null
    }
  })
  .filter(Boolean)
  .sort((a, b) => a.label.localeCompare(b.label))
