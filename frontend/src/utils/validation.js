/**
 * Validation Utilities
 * Comprehensive field validators and form validation helpers
 */

/**
 * Email validation regex pattern
 * RFC 5322 compliant email validation
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Phone validation regex pattern
 * Supports Indian phone numbers (10 digits)
 */
const PHONE_REGEX = /^[6-9]\d{9}$/;

/**
 * Alphanumeric regex pattern
 */
const ALPHANUMERIC_REGEX = /^[a-zA-Z0-9]+$/;

/**
 * Numeric regex pattern
 */
const NUMERIC_REGEX = /^\d+$/;

/**
 * Password validation regex
 * At least 8 characters, one uppercase, one lowercase, one number
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/**
 * Enrollment number regex (alphanumeric, 6-20 characters)
 */
const ENROLLMENT_REGEX = /^[A-Z0-9]{6,20}$/i;

/**
 * Indian pincode regex (6 digits)
 */
const PINCODE_REGEX = /^\d{6}$/;

// ============================================================================
// Field Validators
// ============================================================================

/**
 * Validates if the value is a valid email address
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email
 */
export const isEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
};

/**
 * Validates if the value is a valid phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone number
 */
export const isPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return PHONE_REGEX.test(cleaned);
};

/**
 * Validates if the value is not empty
 * @param {*} value - Value to validate
 * @returns {boolean} True if value is not empty
 */
export const isRequired = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

/**
 * Creates a validator that checks minimum length
 * @param {number} min - Minimum length required
 * @returns {Function} Validator function
 */
export const minLength = (min) => (value) => {
  if (!value) return false;
  if (typeof value === 'string') return value.trim().length >= min;
  if (Array.isArray(value)) return value.length >= min;
  return false;
};

/**
 * Creates a validator that checks maximum length
 * @param {number} max - Maximum length allowed
 * @returns {Function} Validator function
 */
export const maxLength = (max) => (value) => {
  if (!value) return true; // Empty values are valid for max length
  if (typeof value === 'string') return value.trim().length <= max;
  if (Array.isArray(value)) return value.length <= max;
  return false;
};

/**
 * Validates if the value is numeric
 * @param {*} value - Value to validate
 * @returns {boolean} True if value is numeric
 */
export const isNumeric = (value) => {
  if (!value && value !== 0) return false;
  if (typeof value === 'number') return !isNaN(value);
  if (typeof value === 'string') return NUMERIC_REGEX.test(value.trim());
  return false;
};

/**
 * Validates if the value is alphanumeric
 * @param {string} value - Value to validate
 * @returns {boolean} True if value is alphanumeric
 */
export const isAlphanumeric = (value) => {
  if (!value || typeof value !== 'string') return false;
  return ALPHANUMERIC_REGEX.test(value.trim());
};

/**
 * Creates a validator that checks if value matches a regex pattern
 * @param {RegExp|string} pattern - Pattern to match against
 * @returns {Function} Validator function
 */
export const matchesPattern = (pattern) => (value) => {
  if (!value) return false;
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  return regex.test(String(value));
};

// ============================================================================
// Composed Validators
// ============================================================================

/**
 * Validates if the password meets security requirements
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * @param {string} password - Password to validate
 * @returns {boolean} True if valid password
 */
export const isValidPassword = (password) => {
  if (!password || typeof password !== 'string') return false;
  return PASSWORD_REGEX.test(password);
};

/**
 * Validates if the enrollment number is valid
 * - Alphanumeric
 * - 6-20 characters
 * @param {string} value - Enrollment number to validate
 * @returns {boolean} True if valid enrollment number
 */
export const isValidEnrollmentNumber = (value) => {
  if (!value || typeof value !== 'string') return false;
  return ENROLLMENT_REGEX.test(value.trim());
};

/**
 * Validates if the pincode is valid (Indian pincode)
 * - Exactly 6 digits
 * @param {string} value - Pincode to validate
 * @returns {boolean} True if valid pincode
 */
export const isValidPincode = (value) => {
  if (!value || typeof value !== 'string') return false;
  return PINCODE_REGEX.test(value.trim());
};

// ============================================================================
// Form Validation Helper
// ============================================================================

/**
 * Validates form values against validation rules
 * @param {Object} values - Form values to validate
 * @param {Object} rules - Validation rules for each field
 * @returns {Object} Validation result with isValid flag and errors object
 *
 * @example
 * const values = { email: 'test@example.com', password: 'Test123' };
 * const rules = {
 *   email: [isRequired, isEmail],
 *   password: [isRequired, isValidPassword]
 * };
 * const result = validateForm(values, rules);
 * // { isValid: true, errors: {} }
 */
export const validateForm = (values, rules) => {
  const errors = {};
  let isValid = true;

  Object.keys(rules).forEach((fieldName) => {
    const fieldRules = rules[fieldName];
    const fieldValue = values[fieldName];

    // If rules is an array of validators
    if (Array.isArray(fieldRules)) {
      for (const rule of fieldRules) {
        if (typeof rule === 'function') {
          const result = rule(fieldValue);
          if (!result) {
            errors[fieldName] = getDefaultErrorMessage(fieldName, rule);
            isValid = false;
            break; // Stop at first validation error for this field
          }
        } else if (typeof rule === 'object' && rule.validator) {
          // Support for custom validators with custom messages
          const result = rule.validator(fieldValue);
          if (!result) {
            errors[fieldName] = rule.message || getDefaultErrorMessage(fieldName, rule.validator);
            isValid = false;
            break;
          }
        }
      }
    }
    // If rules is a single validator function
    else if (typeof fieldRules === 'function') {
      const result = fieldRules(fieldValue);
      if (!result) {
        errors[fieldName] = getDefaultErrorMessage(fieldName, fieldRules);
        isValid = false;
      }
    }
  });

  return { isValid, errors };
};

/**
 * Gets a default error message for a validator
 * @param {string} fieldName - Name of the field
 * @param {Function} validator - Validator function
 * @returns {string} Error message
 */
const getDefaultErrorMessage = (fieldName, validator) => {
  const name = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);

  if (validator === isRequired) return `${name} is required`;
  if (validator === isEmail) return `${name} must be a valid email`;
  if (validator === isPhone) return `${name} must be a valid phone number`;
  if (validator === isValidPassword) return `${name} must be at least 8 characters with uppercase, lowercase, and number`;
  if (validator === isValidEnrollmentNumber) return `${name} must be 6-20 alphanumeric characters`;
  if (validator === isValidPincode) return `${name} must be a valid 6-digit pincode`;
  if (validator === isNumeric) return `${name} must be numeric`;
  if (validator === isAlphanumeric) return `${name} must be alphanumeric`;

  return `${name} is invalid`;
};

// ============================================================================
// Ant Design Form Rule Generators
// ============================================================================

/**
 * Generates required field rule for Ant Design forms
 * @param {string} message - Custom error message (optional)
 * @returns {Object} Ant Design form rule
 */
export const requiredRule = (message) => ({
  required: true,
  message: message || 'This field is required',
});

/**
 * Generates email validation rule for Ant Design forms
 * @param {string} message - Custom error message (optional)
 * @returns {Object} Ant Design form rule
 */
export const emailRule = (message) => ({
  validator: (_, value) => {
    if (!value || isEmail(value)) {
      return Promise.resolve();
    }
    return Promise.reject(new Error(message || 'Please enter a valid email address'));
  },
});

/**
 * Generates phone validation rule for Ant Design forms
 * @param {string} message - Custom error message (optional)
 * @returns {Object} Ant Design form rule
 */
export const phoneRule = (message) => ({
  validator: (_, value) => {
    if (!value || isPhone(value)) {
      return Promise.resolve();
    }
    return Promise.reject(new Error(message || 'Please enter a valid 10-digit phone number'));
  },
});

/**
 * Generates password validation rules for Ant Design forms
 * @returns {Array} Array of Ant Design form rules
 */
export const passwordRules = () => [
  requiredRule('Password is required'),
  {
    validator: (_, value) => {
      if (!value || isValidPassword(value)) {
        return Promise.resolve();
      }
      return Promise.reject(
        new Error('Password must be at least 8 characters with uppercase, lowercase, and number')
      );
    },
  },
];

/**
 * Generates enrollment number validation rule for Ant Design forms
 * @param {string} message - Custom error message (optional)
 * @returns {Object} Ant Design form rule
 */
export const enrollmentRule = (message) => ({
  validator: (_, value) => {
    if (!value || isValidEnrollmentNumber(value)) {
      return Promise.resolve();
    }
    return Promise.reject(new Error(message || 'Enrollment number must be 6-20 alphanumeric characters'));
  },
});

/**
 * Generates pincode validation rule for Ant Design forms
 * @param {string} message - Custom error message (optional)
 * @returns {Object} Ant Design form rule
 */
export const pincodeRule = (message) => ({
  validator: (_, value) => {
    if (!value || isValidPincode(value)) {
      return Promise.resolve();
    }
    return Promise.reject(new Error(message || 'Please enter a valid 6-digit pincode'));
  },
});

/**
 * Generates min length validation rule for Ant Design forms
 * @param {number} min - Minimum length required
 * @param {string} message - Custom error message (optional)
 * @returns {Object} Ant Design form rule
 */
export const minLengthRule = (min, message) => ({
  min,
  message: message || `Must be at least ${min} characters`,
});

/**
 * Generates max length validation rule for Ant Design forms
 * @param {number} max - Maximum length allowed
 * @param {string} message - Custom error message (optional)
 * @returns {Object} Ant Design form rule
 */
export const maxLengthRule = (max, message) => ({
  max,
  message: message || `Must not exceed ${max} characters`,
});

/**
 * Generates pattern validation rule for Ant Design forms
 * @param {RegExp} pattern - Regex pattern to match
 * @param {string} message - Error message
 * @returns {Object} Ant Design form rule
 */
export const patternRule = (pattern, message) => ({
  pattern,
  message: message || 'Invalid format',
});

export default {
  // Field validators
  isEmail,
  isPhone,
  isRequired,
  minLength,
  maxLength,
  isNumeric,
  isAlphanumeric,
  matchesPattern,

  // Composed validators
  isValidPassword,
  isValidEnrollmentNumber,
  isValidPincode,

  // Form validation
  validateForm,

  // Ant Design rules
  requiredRule,
  emailRule,
  phoneRule,
  passwordRules,
  enrollmentRule,
  pincodeRule,
  minLengthRule,
  maxLengthRule,
  patternRule,
};
