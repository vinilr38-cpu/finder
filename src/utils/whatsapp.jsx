import React from 'react';

/**
 * Format phone number for WhatsApp's wa.me link:
 * Strip all non-numeric characters (spaces, dashes, +).
 * If the result is a 10-digit number, automatically prepend 91 (e.g. 9876543210 -> 919876543210).
 */
export function formatWhatsAppPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

/**
 * Build WhatsApp click-to-chat URL
 */
export function getWhatsAppUrl(phone, prefilledText = '') {
  const formattedPhone = formatWhatsAppPhone(phone);
  if (!formattedPhone) return null;
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(prefilledText)}`;
}

/**
 * Crisp WhatsApp SVG Icon
 */
export function WhatsAppIcon({ className = "h-3.5 w-3.5" }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.825z" />
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.662 1.435 5.178L2 22l4.981-1.397C8.423 21.499 10.154 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm.031 16.657c-1.378 0-2.684-.378-3.816-1.037l-.273-.158-2.836.744.757-2.763-.174-.277c-.72-1.146-1.101-2.483-1.1-3.852 0-4.113 3.347-7.46 7.463-7.46 4.112 0 7.458 3.347 7.458 7.46 0 4.114-3.347 7.461-7.458 7.461z" />
    </svg>
  );
}
