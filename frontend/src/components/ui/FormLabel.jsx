import React from 'react';

/**
 * Reusable Form Label with red asterisk (#D32F2F) for required fields.
 */
export function FormLabel({ label, required, htmlFor, className = '' }) {
  return (
    <label htmlFor={htmlFor} className={`text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block ${className}`}>
      {label}
      {required && <span className="text-[#D32F2F] font-bold ml-0.5">*</span>}
    </label>
  );
}

/**
 * Top note indicating required fields with red asterisk.
 */
export function FormRequiredNote({ className = '' }) {
  return (
    <p className={`text-xs text-gray-500 mb-3 flex items-center gap-1 ${className}`}>
      <span className="text-[#D32F2F] font-bold">*</span>
      <span>Required field</span>
    </p>
  );
}

/**
 * Contact Number utilities for Philippine mobile numbers (09xxxxxxxxx, 11 digits).
 */
export const sanitizeContact = (val) => {
  return String(val ?? '').replace(/\D/g, '').slice(0, 11);
};

export const validateContact = (val, isRequired = false) => {
  const clean = String(val ?? '').trim();
  if (!clean) {
    if (isRequired) return 'This field is required';
    return '';
  }
  if (!/^09\d{9}$/.test(clean)) {
    return 'Contact number must be 11 digits (e.g. 09123456789)';
  }
  return '';
};

export default FormLabel;
