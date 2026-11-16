// Public academy details used on the landing page, footer and sign-in screens.
export const SITE = {
  name: 'Global Sports Academy',
  phone: '9042999507',
  phoneIntl: '919042999507',
  addressLines: ['Nochipattiyar Thottam, Mudhalaipatti', 'Namakkal'],
  pincode: '', // TODO: add the PIN code, e.g. '637001'
  domain: 'globalsportsacademy.in',
}
export const fullAddress = () => [...SITE.addressLines, SITE.pincode].filter(Boolean).join(', ')
export const mapsUrl = () => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress() + ', Tamil Nadu')}`
