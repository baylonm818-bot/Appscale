/**
 * Contact Number Validation Helper
 * Rule: Philippine mobile number starting with '09' and exactly 11 digits.
 */
const validateContactNumber = (contact, isRequired = false) => {
  if (contact === undefined || contact === null || String(contact).trim() === '') {
    if (isRequired) {
      return { valid: false, message: 'This field is required' };
    }
    return { valid: true, value: null };
  }

  const str = String(contact).trim();
  if (!/^09\d{9}$/.test(str)) {
    return { valid: false, message: 'Contact number must be 11 digits (e.g. 09123456789)' };
  }

  return { valid: true, value: str };
};

module.exports = {
  validateContactNumber,
};
