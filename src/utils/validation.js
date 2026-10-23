/**
 * Client side validation helpers.
 *
 * Only three pieces of information are ever collected in this demo:
 * full name, email address and mobile number. No PIN, OTP, password or card
 * number is requested, stored or transmitted.
 */

export const CUSTOMER_FIELDS = ['fullName', 'email', 'phone']

export const EMPTY_CUSTOMER = {
  fullName: '',
  email: '',
  phone: '',
}

/** Trim and collapse whitespace in a string. */
export function clean(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

/** Strip spaces, dashes and parentheses from a phone number. */
export function normalisePhone(value) {
  return clean(value).replace(/[\s\-()]/g, '')
}

/**
 * A name must have at least two words of at least two characters each.
 */
export function validateFullName(value) {
  const name = clean(value)
  if (!name) return 'Full name is required.'
  if (name.length < 3) return 'Full name must be at least 3 characters.'
  if (!name.includes(' ')) return 'Enter first and last name (e.g. Ayesha Khan).'
  if (!/^[\p{L}][\p{L}\s.'-]*$/u.test(name)) {
    return 'Full name can only contain letters, spaces, apostrophes and hyphens.'
  }
  return ''
}

/**
 * Basic, practical email check.
 */
export function validateEmail(value) {
  const email = clean(value).toLowerCase()
  if (!email) return 'Email address is required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return 'Enter a valid email address (e.g. name@example.com).'
  }
  return ''
}

/**
 * Pakistani mobile number check.
 *
 * Accepts 03XXXXXXXXX, 0300-1234567, 923001234567 and +923001234567.
 */
export function validatePhone(value) {
  const phone = normalisePhone(value)
  if (!phone) return 'Mobile number is required.'
  if (!/^(?:\+?92|0)?3\d{9}$/.test(phone)) {
    return 'Enter a valid Pakistani mobile number (e.g. 03001234567).'
  }
  return ''
}

/**
 * Validate the whole customer form.
 *
 * @param {{fullName:string,email:string,phone:string}} values
 * @returns {Record<string,string>} field -> error message (empty object when valid)
 */
export function validateCustomerForm(values = {}) {
  const errors = {}

  const nameError = validateFullName(values.fullName)
  if (nameError) errors.fullName = nameError

  const emailError = validateEmail(values.email)
  if (emailError) errors.email = emailError

  const phoneError = validatePhone(values.phone)
  if (phoneError) errors.phone = phoneError

  return errors
}

/**
 * True when every field of the customer form passes validation.
 */
export function isCustomerFormValid(values = {}) {
  return Object.keys(validateCustomerForm(values)).length === 0
}
