import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, FileText, CheckSquare, Square, Trash2 } from 'lucide-react';
import { getBarangaySealPath } from '../../utils/barangayLogos';

export default function ReportPreviewModal({ isOpen, onClose, reportData, title, barangay }) {
  if (!isOpen || !reportData) return null;

  const handlePrint = () => {
    window.print();
  };

  const storedUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
  const isBns = String(storedUser.role || '').toLowerCase() === 'bns';
  const bnsAutoName = (storedUser.full_name || `${storedUser.first_name || ''} ${storedUser.last_name || ''}`.trim() || storedUser.username || '').toUpperCase();

  const storageKey = `report_signatories_${storedUser.user_id || 'default'}`;
  const savedData = (() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  })();

  const [remember, setRemember] = useState(Boolean(savedData));
  const [preparedByName, setPreparedByName] = useState(() => {
    if (isBns) return bnsAutoName;
    return savedData?.preparedByName || '';
  });
  const [preparedByPosition, setPreparedByPosition] = useState(() => {
    if (isBns) return 'Barangay Nutrition Scholar (BNS)';
    return savedData?.preparedByPosition || (String(storedUser.role || '').toLowerCase() === 'admin' ? 'Nutrition Action Officer' : 'Barangay Health Worker (BHW)');
  });
  const [notedByName, setNotedByName] = useState(() => savedData?.notedByName || '');
  const [notedByPosition, setNotedByPosition] = useState(() => savedData?.notedByPosition || 'Punong Barangay');

  const handleSaveRemember = (willRemember, prepName, prepPos, notName, notPos) => {
    setRemember(willRemember);
    if (willRemember) {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          preparedByName: isBns ? '' : prepName,
          preparedByPosition: prepPos,
          notedByName: notName,
          notedByPosition: notPos,
        })
      );
    } else {
      localStorage.removeItem(storageKey);
    }
  };

  const handleClearRemembered = () => {
    localStorage.removeItem(storageKey);
    setRemember(false);
    if (!isBns) setPreparedByName('');
    setNotedByName('');
  };

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const currentYear = new Date().getFullYear();

  // Infer if the report is for Lactating Mothers
  const titleLower = String(title || '').toLowerCase();
  const firstItem = reportData.items?.[0] || {};
  const isMothers =
    titleLower.includes('mother') ||
    titleLower.includes('lactating') ||
    firstItem.breastfeedingPractice !== undefined ||
    firstItem.children_count !== undefined ||
    firstItem.is_completed !== undefined ||
    reportData.isMothers === true;

  // Resolve barangay for logo display
  const resolvedBarangay =
    barangay && barangay !== 'All Barangays' && barangay !== 'Community'
      ? barangay
      : (firstItem.barangay || barangay || 'Tiguion');

  const barangaySealSrc = getBarangaySealPath(resolvedBarangay);

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:rounded-none print:w-full print:p-0">
        
        {/* Modal Toolbar (Hidden during print) */}
        <div className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-4 flex items-center justify-between text-white shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <FileText size={20} />
            <div>
              <h2 className="text-base font-bold">Report Preview</h2>
              <p className="text-xs text-white/80">Official Form Layout · Masterlist Assessment</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-green-900 font-bold text-xs hover:bg-green-50 transition shadow-sm cursor-pointer"
            >
              <Printer size={15} />
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Signatory Configuration (Toolbar / Form - Hidden during print) */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 print:hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Report Signatories</h3>
            {localStorage.getItem(storageKey) && (
              <button
                type="button"
                onClick={handleClearRemembered}
                className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={13} /> Clear remembered names
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-3 rounded-xl border border-gray-200 space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block">
                Prepared by {isBns && <span className="text-green-700 font-semibold">(Your BNS Name)</span>}
              </label>
              <input
                type="text"
                disabled={isBns}
                value={isBns ? bnsAutoName : preparedByName}
                onChange={(e) => {
                  setPreparedByName(e.target.value);
                  if (remember) handleSaveRemember(true, e.target.value, preparedByPosition, notedByName, notedByPosition);
                }}
                placeholder="Enter name (or leave blank for physical signature)"
                className="w-full text-xs font-semibold px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-600 disabled:bg-gray-100 disabled:text-gray-600"
              />
              <input
                type="text"
                value={preparedByPosition}
                onChange={(e) => {
                  setPreparedByPosition(e.target.value);
                  if (remember) handleSaveRemember(true, preparedByName, e.target.value, notedByName, notedByPosition);
                }}
                placeholder="Position (e.g. Barangay Nutrition Scholar)"
                className="w-full text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 focus:outline-none focus:ring-1 focus:ring-green-600"
              />
            </div>

            <div className="bg-white p-3 rounded-xl border border-gray-200 space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block">
                Noted by / Verified by
              </label>
              <input
                type="text"
                value={notedByName}
                onChange={(e) => {
                  setNotedByName(e.target.value);
                  if (remember) handleSaveRemember(true, preparedByName, preparedByPosition, e.target.value, notedByPosition);
                }}
                placeholder="Enter name (or leave blank for physical signature)"
                className="w-full text-xs font-semibold px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-600"
              />
              <input
                type="text"
                value={notedByPosition}
                onChange={(e) => {
                  setNotedByPosition(e.target.value);
                  if (remember) handleSaveRemember(true, preparedByName, preparedByPosition, notedByName, e.target.value);
                }}
                placeholder="Position (e.g. Punong Barangay)"
                className="w-full text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 focus:outline-none focus:ring-1 focus:ring-green-600"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              id="remember_signatories"
              checked={remember}
              onChange={(e) => handleSaveRemember(e.target.checked, preparedByName, preparedByPosition, notedByName, notedByPosition)}
              className="rounded text-green-700 focus:ring-green-600 h-3.5 w-3.5 cursor-pointer"
            />
            <label htmlFor="remember_signatories" className="text-xs text-gray-600 cursor-pointer">
              Remember for next time (saves typed names for your account only)
            </label>
          </div>
        </div>

        {/* Printable Report Canvas */}
        <div className="overflow-y-auto flex-1 p-8 sm:p-10 bg-white print:p-0 print:overflow-visible">
          
          {/* Top Border Line (matching official Word document template) */}
          <div className="border-t-2 border-black w-full mb-3" />

          {/* 5-Logo Official Header Row:
              1. Bagong Pilipinas
              2. NNC (National Nutrition Council)
              3. Bayan ng Gasan Seal
              4. Dynamic Barangay Seal (matched to respective barangay)
              5. Nutrition Family Emblem */}
          <div className="flex items-center justify-center gap-3 sm:gap-6 py-2">
            <img
              src="/assets/logos/bagong_pilipinas.png"
              alt="Bagong Pilipinas"
              className="h-12 sm:h-14 w-auto object-contain shrink-0"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <img
              src="/assets/logos/nnc.png"
              alt="National Nutrition Council"
              className="h-12 sm:h-14 w-auto object-contain shrink-0"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <img
              src="/assets/logos/gasan_seal.png"
              alt="Bayan ng Gasan"
              className="h-12 sm:h-14 w-auto object-contain shrink-0"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <img
              src={barangaySealSrc}
              alt={`Barangay ${resolvedBarangay} Seal`}
              className="h-12 sm:h-14 w-auto object-contain shrink-0"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <img
              src="/assets/logos/nutrition_logo.png"
              alt="Nutrition Logo"
              className="h-12 sm:h-14 w-auto object-contain shrink-0"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>

          {/* Report Title */}
          <div className="text-center my-4">
            <h1 className="text-base sm:text-lg font-black text-gray-900 uppercase tracking-tight">
              {title || (isMothers ? `MASTERLIST OF LACTATING MOTHER ${currentYear}` : `CHILDREN MASTERLIST ${currentYear}`)}
            </h1>
            <p className="text-xs font-semibold text-gray-600 mt-0.5">
              Barangay {resolvedBarangay || 'Community'} · Municipality of Gasan, Marinduque
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">Date Generated: {today}</p>
          </div>

          {/* Summary Cards Table (for children reports) */}
          {!isMothers && reportData.summary && (
            <div className="grid grid-cols-4 gap-3 mb-6 print:grid-cols-4 print:break-inside-avoid">
              <div className="border border-gray-200 rounded-xl p-2.5 bg-gray-50 text-center">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Total Children</p>
                <p className="text-lg font-black text-gray-900">{reportData.summary.totalChildren || reportData.items?.length || 0}</p>
              </div>
              <div className="border border-emerald-200 rounded-xl p-2.5 bg-emerald-50 text-center">
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Normal</p>
                <p className="text-lg font-black text-emerald-900">{reportData.summary.normal || 0}</p>
              </div>
              <div className="border border-amber-200 rounded-xl p-2.5 bg-amber-50 text-center">
                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">MAM / Underweight</p>
                <p className="text-lg font-black text-amber-900">{reportData.summary.mam || 0}</p>
              </div>
              <div className="border border-rose-200 rounded-xl p-2.5 bg-rose-50 text-center">
                <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wide">SAM / At Risk</p>
                <p className="text-lg font-black text-rose-900">{reportData.summary.sam || 0}</p>
              </div>
            </div>
          )}

          {/* Data Table: Lactating Mothers vs Children */}
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-8 print:border-gray-300">
            {isMothers ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1b5e20] text-white font-bold uppercase tracking-wider text-[11px] print:bg-gray-800">
                    <th className="p-3 border-b border-green-700 w-12 text-center">#</th>
                    <th className="p-3 border-b border-green-700">Name of Lactating Mother</th>
                    <th className="p-3 border-b border-green-700 text-center">Age</th>
                    <th className="p-3 border-b border-green-700">Purok / Address</th>
                    <th className="p-3 border-b border-green-700 text-center">Contact Number</th>
                    <th className="p-3 border-b border-green-700 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportData.items && reportData.items.length > 0 ? (
                    reportData.items.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                        <td className="p-3 font-semibold text-gray-500 text-center">{idx + 1}</td>
                        <td className="p-3 font-bold text-gray-900">
                          {item.first_name || item.fullName ? `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.fullName : '—'}
                        </td>
                        <td className="p-3 font-medium text-gray-700 text-center">
                          {item.age_years ?? item.age ?? '—'}
                        </td>
                        <td className="p-3 font-medium text-gray-700">
                          {item.purok || item.address || '—'}
                        </td>
                        <td className="p-3 font-medium text-gray-700 text-center">
                          {item.contact_number || item.contactNo || '—'}
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-800">
                            {item.breastfeedingPractice || (item.is_completed ? 'Completed' : 'Lactating')}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-gray-400 font-medium">
                        No registered lactating mothers found for this report.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1b5e20] text-white font-bold uppercase tracking-wider text-[11px] print:bg-gray-800">
                    <th className="p-3 border-b border-green-700 w-10 text-center">#</th>
                    <th className="p-3 border-b border-green-700">Child / Beneficiary Name</th>
                    <th className="p-3 border-b border-green-700 text-center">Age (Mos)</th>
                    <th className="p-3 border-b border-green-700 text-center">Sex</th>
                    <th className="p-3 border-b border-green-700">Guardian Name</th>
                    <th className="p-3 border-b border-green-700 text-right">Weight (kg)</th>
                    <th className="p-3 border-b border-green-700 text-right">Height (cm)</th>
                    <th className="p-3 border-b border-green-700 text-center">Nutritional Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportData.items && reportData.items.length > 0 ? (
                    reportData.items.map((item, idx) => {
                      const statusLower = String(item.overall_status || item.nutrition_status || item.status || '').toLowerCase();
                      const isNormal = statusLower === 'normal';
                      const isMam = statusLower === 'mam' || statusLower.includes('underweight');
                      const isSam = statusLower === 'sam' || statusLower.includes('severely') || statusLower.includes('risk');

                      return (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                          <td className="p-3 font-semibold text-gray-500 text-center">{idx + 1}</td>
                          <td className="p-3 font-bold text-gray-900">{item.first_name || item.fullName || ''} {item.last_name || ''}</td>
                          <td className="p-3 font-medium text-gray-700 text-center">{item.age_in_months ?? item.ageInMonths ?? '—'}</td>
                          <td className="p-3 font-medium text-gray-700 text-center capitalize">{item.sex || item.gender || '—'}</td>
                          <td className="p-3 font-medium text-gray-700">{item.guardian_name || item.guardian?.fullName || '—'}</td>
                          <td className="p-3 font-semibold text-gray-800 text-right">{item.weight_kg ? `${item.weight_kg} kg` : '—'}</td>
                          <td className="p-3 font-semibold text-gray-800 text-right">{item.height_cm ? `${item.height_cm} cm` : '—'}</td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                              isNormal ? 'bg-emerald-100 text-emerald-800' :
                              isMam ? 'bg-amber-100 text-amber-800' :
                              isSam ? 'bg-rose-100 text-rose-800' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {item.overall_status || item.nutrition_status || item.status || 'No Record'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-gray-400 font-medium">
                        No beneficiary records found for this report layout.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Signatures Footer (matching official document) */}
          <div className="grid grid-cols-2 gap-12 pt-6 border-t border-gray-200 print:pt-6 print:break-inside-avoid break-inside-avoid">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-6">Prepared by:</p>
              <div className="border-b border-gray-800 w-56 max-w-full mb-1.5" />
              <p className="text-xs font-bold text-gray-900 uppercase tracking-wide break-words min-h-[1rem]">
                {activePreparedName || ''}
              </p>
              <p className="text-[11px] font-medium text-gray-600">{preparedByPosition}</p>
              <p className="text-[10px] text-gray-500 mt-2">Date: ____________________</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-6">Noted by:</p>
              <div className="border-b border-gray-800 w-56 max-w-full mb-1.5" />
              <p className="text-xs font-bold text-gray-900 uppercase tracking-wide break-words min-h-[1rem]">
                {notedByName || ''}
              </p>
              <p className="text-[11px] font-medium text-gray-600">{notedByPosition}</p>
              <p className="text-[10px] text-gray-500 mt-2">Date: ____________________</p>
            </div>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}
