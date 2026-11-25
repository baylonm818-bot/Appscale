import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Download, FileSpreadsheet } from 'lucide-react';
import { getBarangaySealPath } from '../../utils/barangayLogos';

export default function ReportPreviewModal({ isOpen, onClose, reportData, title, barangay, onExportExcel }) {
  if (!isOpen || !reportData) return null;

  const storedUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
  const userFullName = (storedUser.full_name || `${storedUser.first_name || ''} ${storedUser.last_name || ''}`.trim() || storedUser.username || '').toUpperCase();
  const userRole = String(storedUser.role || '').toLowerCase();

  const isBns = userRole === 'bns';
  const defaultPrepPos = isBns
    ? 'Barangay Nutrition Scholar (BNS)'
    : userRole === 'admin'
    ? 'Municipal Nutrition Action Officer'
    : 'Barangay Health Worker (BHW)';

  const [preparedByName, setPreparedByName] = useState(userFullName || 'JANA A. ROLLE');
  const [preparedByPosition, setPreparedByPosition] = useState(defaultPrepPos);
  const [notedByName, setNotedByName] = useState('HON. PUNONG BARANGAY');
  const [notedByPosition, setNotedByPosition] = useState('Punong Barangay / Municipal Health Officer');

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const titleLower = String(title || '').toLowerCase();
  const isMothers = titleLower.includes('mother') || reportData.isMothers === true;

  // Resolve barangay for logo and heading
  const resolvedBarangay =
    barangay && barangay !== 'All Barangays' && barangay !== 'Community' && barangay !== 'all'
      ? barangay
      : (reportData.items?.[0]?.barangay || 'All Barangays');

  const barangaySealSrc = getBarangaySealPath(resolvedBarangay);

  const handlePrint = () => {
    const originalTitle = document.title;
    const cleanBarangay = resolvedBarangay.replace(/\s+/g, '_');
    document.title = `${isMothers ? 'Maternal_Health_Masterlist' : 'Child_Beneficiary_Masterlist'}_${cleanBarangay}_${new Date().getFullYear()}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1200);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-md p-4 overflow-y-auto"
      style={{ zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:rounded-none print:w-full print:p-0">
        
        {/* Modal Toolbar (Hidden during print) */}
        <div className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-4 flex items-center justify-between text-white shrink-0 print:hidden">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <Printer size={18} className="text-green-300" />
              <span>{title || 'Masterlist Official Report Preview'}</span>
            </h2>
            <p className="text-white/80 text-xs mt-0.5">
              Official DOH/NNC format with municipal seals · Ready for PDF Print &amp; Excel Export
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onExportExcel && (
              <button
                type="button"
                onClick={onExportExcel}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <FileSpreadsheet size={15} />
                <span>Export Excel</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-white text-[#1b5e20] hover:bg-green-50 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Printer size={15} />
              <span>Print / Save as PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition cursor-pointer ml-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="overflow-y-auto flex-1 p-6 md:p-10 bg-white print:p-0 print:overflow-visible">
          
          {/* 5-Logo Official Header */}
          <div className="border-b-2 border-[#1b5e20] pb-4 mb-6">
            <div className="flex items-center justify-between gap-2 max-w-4xl mx-auto">
              <img
                src="/assets/logos/bagong_pilipinas.png"
                alt="Republic of the Philippines"
                className="w-12 h-12 md:w-16 md:h-16 object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <img
                src="/assets/logos/gasan_seal.png"
                alt="Municipality of Gasan"
                className="w-12 h-12 md:w-16 md:h-16 object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />

              <div className="text-center flex-1 px-2">
                <p className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-gray-600">Republic of the Philippines</p>
                <p className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-gray-600">Province of Marinduque</p>
                <h1 className="text-sm md:text-lg font-black uppercase tracking-tight text-[#1b5e20]">Municipality of Gasan</h1>
                <p className="text-xs md:text-sm font-bold text-gray-800 mt-0.5">
                  BARANGAY {resolvedBarangay.toUpperCase()}
                </p>
                <h2 className="text-xs md:text-sm font-extrabold uppercase tracking-wide text-[#2e7d32] mt-1">
                  {isMothers ? 'MATERNAL HEALTH & PREGNANT/LACTATING MASTERLIST' : 'CHILD BENEFICIARY & NUTRITIONAL STATUS MASTERLIST'}
                </h2>
                <p className="text-[10px] text-gray-500 mt-0.5">As of {today}</p>
              </div>

              <img
                src={barangaySealSrc}
                alt="Barangay Seal"
                className="w-12 h-12 md:w-16 md:h-16 object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <img
                src="/assets/logos/nnc.png"
                alt="National Nutrition Council"
                className="w-12 h-12 md:w-16 md:h-16 object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <img
                src="/assets/logos/nutrition_logo.png"
                alt="DOH Nutrition Program"
                className="w-12 h-12 md:w-16 md:h-16 object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            {!isMothers ? (
              /* Children Table Layout */
              <table className="w-full border-collapse border border-gray-300 text-xs">
                <thead>
                  <tr className="bg-[#1b5e20] text-white font-bold text-center">
                    <th className="p-2 border border-green-800 w-10">#</th>
                    <th className="p-2 border border-green-800 text-left min-w-[140px]">Child Legal Name</th>
                    <th className="p-2 border border-green-800 w-16">Sex</th>
                    <th className="p-2 border border-green-800 w-16">Age (Mos)</th>
                    <th className="p-2 border border-green-800 w-24">Birth Date</th>
                    <th className="p-2 border border-green-800 text-left min-w-[130px]">Mother / Guardian</th>
                    <th className="p-2 border border-green-800 w-28">Contact No.</th>
                    <th className="p-2 border border-green-800 w-24">Barangay</th>
                    <th className="p-2 border border-green-800 w-20">Purok</th>
                    <th className="p-2 border border-green-800 w-20">Disability</th>
                    <th className="p-2 border border-green-800 min-w-[110px]">Nutritional Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.items && reportData.items.length > 0 ? (
                    reportData.items.map((c, idx) => {
                      const status = c.overall_status || c.nutrition_status || c.status || 'No Record';
                      const sLower = String(status).toLowerCase();
                      const isNormal = sLower === 'normal';
                      const isDanger = sLower.includes('severe') || sLower === 'sam';
                      const isWarning = sLower.includes('underweight') || sLower.includes('stunted') || sLower === 'mam';

                      return (
                        <tr key={c.child_id || idx} className={idx % 2 === 1 ? 'bg-gray-50/70' : 'bg-white'}>
                          <td className="p-2 border border-gray-300 text-center font-semibold text-gray-500">{idx + 1}</td>
                          <td className="p-2 border border-gray-300 font-bold text-gray-900">
                            {c.first_name} {c.last_name}
                          </td>
                          <td className="p-2 border border-gray-300 text-center capitalize">{c.sex || c.gender || '—'}</td>
                          <td className="p-2 border border-gray-300 text-center font-semibold">{c.age_in_months ?? c.age ?? '—'}</td>
                          <td className="p-2 border border-gray-300 text-center text-gray-600">
                            {c.birth_date ? String(c.birth_date).slice(0, 10) : '—'}
                          </td>
                          <td className="p-2 border border-gray-300 text-gray-800 font-medium">{c.guardian_name || '—'}</td>
                          <td className="p-2 border border-gray-300 text-center text-gray-700">{c.guardian_contact || '—'}</td>
                          <td className="p-2 border border-gray-300 text-center text-gray-700">{c.barangay || '—'}</td>
                          <td className="p-2 border border-gray-300 text-center text-gray-600">{c.purok || '—'}</td>
                          <td className="p-2 border border-gray-300 text-center text-gray-600">{c.disability || 'None'}</td>
                          <td className="p-2 border border-gray-300 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold uppercase tracking-tight ${
                              isNormal ? 'bg-emerald-100 text-emerald-800' :
                              isDanger ? 'bg-rose-100 text-rose-800 font-black' :
                              isWarning ? 'bg-amber-100 text-amber-800 font-bold' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {status.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={11} className="p-6 text-center text-gray-400 font-medium">
                        No beneficiary records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              /* Mothers Table Layout */
              <table className="w-full border-collapse border border-gray-300 text-xs">
                <thead>
                  <tr className="bg-[#1b5e20] text-white font-bold text-center">
                    <th className="p-2 border border-green-800 w-10">#</th>
                    <th className="p-2 border border-green-800 text-left min-w-[150px]">Mother Full Name</th>
                    <th className="p-2 border border-green-800 w-16">Age</th>
                    <th className="p-2 border border-green-800 w-28">Barangay</th>
                    <th className="p-2 border border-green-800 w-24">Purok</th>
                    <th className="p-2 border border-green-800 w-28">Contact No.</th>
                    <th className="p-2 border border-green-800 w-20">Children</th>
                    <th className="p-2 border border-green-800 w-24">Status</th>
                    <th className="p-2 border border-green-800 min-w-[140px]">Breastfeeding Practice</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.items && reportData.items.length > 0 ? (
                    reportData.items.map((m, idx) => (
                      <tr key={m.mother_id || idx} className={idx % 2 === 1 ? 'bg-gray-50/70' : 'bg-white'}>
                        <td className="p-2 border border-gray-300 text-center font-semibold text-gray-500">{idx + 1}</td>
                        <td className="p-2 border border-gray-300 font-bold text-gray-900">
                          {m.first_name} {m.last_name}
                        </td>
                        <td className="p-2 border border-gray-300 text-center font-semibold">{m.age ?? '—'}</td>
                        <td className="p-2 border border-gray-300 text-center text-gray-700">{m.barangay || '—'}</td>
                        <td className="p-2 border border-gray-300 text-center text-gray-600">{m.purok || '—'}</td>
                        <td className="p-2 border border-gray-300 text-center text-gray-700">{m.contact_number || m.contact || '—'}</td>
                        <td className="p-2 border border-gray-300 text-center font-bold text-emerald-800">{m.children_count ?? 0}</td>
                        <td className="p-2 border border-gray-300 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold uppercase tracking-tight ${
                            m.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {m.status || 'Active'}
                          </span>
                        </td>
                        <td className="p-2 border border-gray-300 text-center text-gray-800">
                          {m.breastfeeding_practice || m.feeding_practice || 'Exclusive'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-gray-400 font-medium">
                        No maternal health records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Official Signatories Block */}
          <div className="grid grid-cols-2 gap-16 md:gap-24 pt-8 mt-8 border-t border-gray-300 print:break-inside-avoid break-inside-avoid">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-8">Prepared by:</p>
              <div className="border-b-2 border-gray-900 w-64 max-w-full pb-1 mb-1 min-h-[1.75rem] flex items-end">
                <input
                  type="text"
                  value={preparedByName}
                  onChange={(e) => setPreparedByName(e.target.value)}
                  className="text-xs font-bold text-gray-900 uppercase tracking-wide w-full bg-transparent border-none outline-none print:border-none"
                />
              </div>
              <input
                type="text"
                value={preparedByPosition}
                onChange={(e) => setPreparedByPosition(e.target.value)}
                className="text-[11px] font-medium text-gray-600 w-full bg-transparent border-none outline-none mt-0.5"
              />
              <p className="text-[10px] text-gray-500 mt-1">Date: {today}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-8">Noted by:</p>
              <div className="border-b-2 border-gray-900 w-64 max-w-full pb-1 mb-1 min-h-[1.75rem] flex items-end">
                <input
                  type="text"
                  value={notedByName}
                  onChange={(e) => setNotedByName(e.target.value)}
                  className="text-xs font-bold text-gray-900 uppercase tracking-wide w-full bg-transparent border-none outline-none print:border-none"
                />
              </div>
              <input
                type="text"
                value={notedByPosition}
                onChange={(e) => setNotedByPosition(e.target.value)}
                className="text-[11px] font-medium text-gray-600 w-full bg-transparent border-none outline-none mt-0.5"
              />
              <p className="text-[10px] text-gray-500 mt-1">Date: ____________________</p>
            </div>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}
