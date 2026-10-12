export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
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
  const first = (source.first_name || '').trim();
  const last = (source.last_name || '').trim();
  if (first && last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  }
  const full = (source.full_name || source.name || first || source.username || '').trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return parts[0].charAt(0).toUpperCase();
  }
  return 'A';
};