import React from 'react';
import { MapPin } from 'lucide-react';

export default function HeaderBanner({ title, subtitle, location }) {
  return (
    <div className="rounded-2xl p-6 text-white shadow-sm" style={{ background: 'linear-gradient(90deg, var(--teal-700), var(--teal-500))' }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white/90">{subtitle}</p>
          <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm">
          <MapPin size={14} className="text-white/90" /> <span className="font-medium text-white/95">{location || '—'}</span>
        </div>
      </div>
    </div>
  );
}
