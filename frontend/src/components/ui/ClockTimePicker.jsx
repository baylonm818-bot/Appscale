import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Clock, X, Check } from 'lucide-react';

/**
 * Material-style interactive Analog Clock Time Picker.
 * - Circular clock face with hour (1-12) and minute (00-55) dial
 * - AM / PM toggle
 * - Fast preset pills (8:00 AM, 9:00 AM, 1:00 PM, etc.)
 * - Outputs 24-hr format string (HH:mm) for compatibility
 */
export default function ClockTimePicker({
  value = '',
  onChange,
  name = 'schedule_time',
  placeholder = 'Select Time',
  disabled = false,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('hour'); // 'hour' | 'minute'
  const [hour, setHour] = useState(9); // 1 - 12
  const [minute, setMinute] = useState(0); // 0 - 59
  const [period, setPeriod] = useState('AM'); // 'AM' | 'PM'

  // Parse existing HH:mm value
  useEffect(() => {
    if (value && typeof value === 'string' && value.includes(':')) {
      const parts = value.split(':');
      let h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m)) {
        if (h === 0) {
          setHour(12);
          setPeriod('AM');
        } else if (h === 12) {
          setHour(12);
          setPeriod('PM');
        } else if (h > 12) {
          setHour(h - 12);
          setPeriod('PM');
        } else {
          setHour(h);
          setPeriod('AM');
        }
        setMinute(m);
      }
    }
  }, [value, isOpen]);

  const formatDisplay = () => {
    if (!value) return '';
    const parts = value.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    if (isNaN(h)) return value;
    const p = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${p}`;
  };

  const handleApply = () => {
    let h24 = hour;
    if (period === 'AM') {
      if (h24 === 12) h24 = 0;
    } else {
      if (h24 < 12) h24 += 12;
    }
    const formatted = `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    if (onChange) {
      onChange({ target: { name, value: formatted } });
    }
    setIsOpen(false);
  };

  const selectPreset = (h, m, p) => {
    setHour(h);
    setMinute(m);
    setPeriod(p);
    let h24 = h;
    if (p === 'AM') {
      if (h24 === 12) h24 = 0;
    } else {
      if (h24 < 12) h24 += 12;
    }
    const formatted = `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (onChange) {
      onChange({ target: { name, value: formatted } });
    }
    setIsOpen(false);
  };

  // Clock Dial Geometry
  const dialRadius = 88;
  const dialCenter = 110;

  const hoursList = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutesList = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  // Calculate hand angle
  const activeAngleDeg = mode === 'hour'
    ? ((hour % 12) * 30) - 90
    : ((minute % 60) * 6) - 90;

  const handRad = (activeAngleDeg * Math.PI) / 180;
  const handEndX = dialCenter + dialRadius * Math.cos(handRad);
  const handEndY = dialCenter + dialRadius * Math.sin(handRad);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setMode('hour');
            setIsOpen(true);
          }
        }}
        className={`w-full flex items-center justify-between border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm transition bg-white hover:border-green-500 focus:outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-green-100 cursor-pointer disabled:bg-gray-50 disabled:cursor-not-allowed text-left ${className}`}
      >
        <span className={value ? 'text-gray-900 font-medium' : 'text-gray-400'}>
          {formatDisplay() || placeholder}
        </span>
        <Clock size={16} className="text-[#2e7d32] shrink-0" />
      </button>

      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-in fade-in duration-150"
            style={{ zIndex: 9999 }}
            onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
          >
            <div
              className="bg-white rounded-3xl shadow-2xl w-full max-w-xs overflow-hidden border border-gray-100 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header: Digital Display & AM/PM */}
              <div className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-green-200 flex items-center gap-1.5">
                    <Clock size={13} />
                    <span>Set Time (Clock Dial)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-6 h-6 rounded-full hover:bg-white/20 flex items-center justify-center text-white/80 transition"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex items-baseline justify-center gap-3 py-1">
                  {/* Hour Box */}
                  <button
                    type="button"
                    onClick={() => setMode('hour')}
                    className={`px-3 py-1 rounded-xl text-3xl font-extrabold transition cursor-pointer ${
                      mode === 'hour'
                        ? 'bg-white text-[#1b5e20] shadow-md'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {String(hour).padStart(2, '0')}
                  </button>

                  <span className="text-3xl font-bold text-white/60 -mt-1">:</span>

                  {/* Minute Box */}
                  <button
                    type="button"
                    onClick={() => setMode('minute')}
                    className={`px-3 py-1 rounded-xl text-3xl font-extrabold transition cursor-pointer ${
                      mode === 'minute'
                        ? 'bg-white text-[#1b5e20] shadow-md'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {String(minute).padStart(2, '0')}
                  </button>

                  {/* AM / PM Selector */}
                  <div className="flex flex-col gap-1 ml-2">
                    <button
                      type="button"
                      onClick={() => setPeriod('AM')}
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        period === 'AM'
                          ? 'bg-white text-[#1b5e20] shadow-sm'
                          : 'bg-white/15 text-white hover:bg-white/25'
                      }`}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriod('PM')}
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        period === 'PM'
                          ? 'bg-white text-[#1b5e20] shadow-sm'
                          : 'bg-white/15 text-white hover:bg-white/25'
                      }`}
                    >
                      PM
                    </button>
                  </div>
                </div>

                <p className="text-center text-[10px] text-green-100/90 font-medium mt-1">
                  {mode === 'hour' ? 'Piliin ang Oras (Hour)' : 'Piliin ang Minuto (Minute)'}
                </p>
              </div>

              {/* Analog Clock Face */}
              <div className="p-4 flex flex-col items-center justify-center bg-gray-50/50">
                <div
                  className="relative w-[220px] h-[220px] rounded-full bg-white border border-gray-200 shadow-inner select-none flex items-center justify-center cursor-pointer"
                  style={{ touchAction: 'none' }}
                >
                  {/* SVG Clock Hand & Center Pin */}
                  <svg
                    className="absolute inset-0 pointer-events-none"
                    width="220"
                    height="220"
                    viewBox="0 0 220 220"
                  >
                    {/* Hand Line */}
                    <line
                      x1={dialCenter}
                      y1={dialCenter}
                      x2={handEndX}
                      y2={handEndY}
                      stroke="#2e7d32"
                      strokeWidth="2.5"
                    />
                    {/* End Selection Bubble */}
                    <circle
                      cx={handEndX}
                      cy={handEndY}
                      r="16"
                      fill="#2e7d32"
                    />
                    {/* Center Pin */}
                    <circle cx={dialCenter} cy={dialCenter} r="4" fill="#1b5e20" />
                  </svg>

                  {/* Render Hour or Minute Dial Numbers */}
                  {mode === 'hour'
                    ? hoursList.map((h) => {
                        const deg = (h * 30) - 90;
                        const rad = (deg * Math.PI) / 180;
                        const x = dialCenter + dialRadius * Math.cos(rad);
                        const y = dialCenter + dialRadius * Math.sin(rad);
                        const isSelected = hour === h;

                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() => {
                              setHour(h);
                              // Auto transition to minute selection
                              setTimeout(() => setMode('minute'), 180);
                            }}
                            style={{
                              position: 'absolute',
                              left: `${x}px`,
                              top: `${y}px`,
                              transform: 'translate(-50%, -50%)',
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition z-10 cursor-pointer ${
                              isSelected
                                ? 'text-white'
                                : 'text-gray-700 hover:bg-green-50'
                            }`}
                          >
                            {h}
                          </button>
                        );
                      })
                    : minutesList.map((m) => {
                        const deg = (m * 6) - 90;
                        const rad = (deg * Math.PI) / 180;
                        const x = dialCenter + dialRadius * Math.cos(rad);
                        const y = dialCenter + dialRadius * Math.sin(rad);
                        const isSelected = minute === m;

                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMinute(m)}
                            style={{
                              position: 'absolute',
                              left: `${x}px`,
                              top: `${y}px`,
                              transform: 'translate(-50%, -50%)',
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition z-10 cursor-pointer ${
                              isSelected
                                ? 'text-white'
                                : 'text-gray-700 hover:bg-green-50'
                            }`}
                          >
                            {String(m).padStart(2, '0')}
                          </button>
                        );
                      })}
                </div>

                {/* Preset Chips */}
                <div className="w-full mt-3 pt-2.5 border-t border-gray-200/80">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 text-center">
                    Quick Times
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {[
                      { h: 8, m: 0, p: 'AM', label: '8:00 AM' },
                      { h: 9, m: 0, p: 'AM', label: '9:00 AM' },
                      { h: 10, m: 0, p: 'AM', label: '10:00 AM' },
                      { h: 1, m: 0, p: 'PM', label: '1:00 PM' },
                      { h: 2, m: 0, p: 'PM', label: '2:00 PM' },
                      { h: 3, m: 0, p: 'PM', label: '3:00 PM' },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => selectPreset(preset.h, preset.m, preset.p)}
                        className="px-2 py-1 bg-white hover:bg-green-50 text-gray-700 hover:text-[#1b5e20] border border-gray-200 hover:border-green-300 rounded-lg text-[10px] font-semibold transition cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-3 bg-white border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-5 py-2 bg-linear-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1 cursor-pointer"
                >
                  <Check size={14} />
                  <span>Set Time</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
