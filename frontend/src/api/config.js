export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

export const getProfileImageUrl = (value) => {
  if (!value || typeof value !== 'string') return '';

  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('/')) return `${API_ORIGIN}${trimmed}`;
  if (trimmed.startsWith('uploads/')) return `${API_ORIGIN}/${trimmed}`;
  if (trimmed.startsWith('profile-pictures/')) return `${API_ORIGIN}/uploads/${trimmed}`;
  return `${API_ORIGIN}/${trimmed.replace(/^\/+/, '')}`;
};

export const getUserInitials = (user) => {
  const source = user || {};
  const first = source.first_name || source.full_name || source.username || '';
  const last = source.last_name || '';
  const initials = `${first}`.trim() && `${last}`.trim() ? `${first.charAt(0)}${last.charAt(0)}` : `${(first || source.username || 'U').charAt(0)}`;
  return initials.toUpperCase();
};