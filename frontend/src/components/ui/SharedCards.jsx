import React from 'react';

export function StatCard({ icon: Icon, label, value, sublabel, accent }) {
  return (
    <div
      className={`rounded-2xl shadow-sm p-4 border-t-4 ${accent || 'border-transparent'}`}
      style={{
        background: 'var(--surface)',
        borderColor: accent ? undefined : 'var(--line)',
        boxShadow: '0 10px 24px rgba(11,31,29,0.04)',
      }}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm text-neutral-700" style={{ color: 'var(--ink)' }}>{label}</p>
        <div className="rounded-full p-2" style={{ background: 'var(--panel-alt)' }}>
          {Icon ? <Icon size={16} className="text-neutral-800" style={{ color: 'var(--ink)' }} /> : null}
        </div>
      </div>
      <p className="text-2xl font-semibold mt-3" style={{ color: 'var(--ink)' }}>{value ?? '—'}</p>
      {sublabel && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{sublabel}</p>}
    </div>
  );
}

export function StatusItem({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-xl border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
        {Icon ? <Icon size={16} className="text-white" /> : null}
      </div>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="mt-1 text-xl font-semibold" style={{ color: 'var(--ink)' }}>{value ?? '—'}</p>
    </div>
  );
}

export function QuickLink({ to, icon: Icon, label, tone }) {
  return (
    <a href={to} className={`${tone} flex items-center justify-center gap-2 rounded-xl p-3 text-xs font-semibold text-white shadow-sm transition hover:brightness-95`}>
      {Icon ? <Icon size={17} className="text-white" /> : null} {label}
    </a>
  );
}
