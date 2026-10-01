import React from 'react';
import { X, Printer, Download, FileText } from 'lucide-react';
import logo from '../../assets/logo.png';

export default function ReportPreviewModal({ isOpen, onClose, reportData, title, barangay }) {
  if (!isOpen || !reportData) return null;

  const handlePrint = () => {
    window.print();
  };

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:rounded-none print:w-full print:p-0">
        
        {/* Modal Toolbar (Hidden during print) */}
        <div className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-4 flex items-center justify-between text-white shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <FileText size={20} />
            <div>
              <h2 className="text-base font-bold">Report Preview</h2>
              <p className="text-xs text-white/80">View official report layout before saving/printing</p>
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
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Report Canvas */}
        <div className="overflow-y-auto flex-1 p-8 sm:p-10 bg-white print:p-0 print:overflow-visible">
          
          {/* Header Block with Properly Formatted & Adjusted Logo (Item 30 & 34) */}
          <div className="flex items-center justify-between border-b-2 border-green-800 pb-5 mb-6 gap-4">
            <div className="flex items-center gap-4">
              <img
                src={logo}
                alt="AppScale Logo"
                className="h-16 w-16 object-contain shrink-0 print:h-14"
              />
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Republic of the Philippines · Province of Marinduque</p>
                <h1 className="text-lg font-black text-gray-900 leading-tight">BARANGAY NUTRITION & HEALTH SERVICES</h1>
                <p className="text-xs font-bold text-green-800">Barangay {barangay || 'Community'} · Municipality of Gasan</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-block px-3 py-1 rounded-lg bg-green-100 text-green-800 text-xs font-bold uppercase tracking-wider mb-1">
                Official Report
              </span>
              <p className="text-xs text-gray-500 font-medium">Date Generated: {today}</p>
            </div>
          </div>

          {/* Report Title */}
          <div className="mb-6 text-center">
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">{title || 'BNS Beneficiary & Nutrition Summary Report'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Comprehensive Health & Anthropometric Assessment Masterlist</p>
          </div>

          {/* Summary Cards Table */}
          {reportData.summary && (
            <div className="grid grid-cols-4 gap-3 mb-6 print:grid-cols-4">
              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 text-center">
                <p className="text-[10px] font-bold text-gray-500 uppercase">Total Children</p>
                <p className="text-xl font-black text-gray-900">{reportData.summary.totalChildren || reportData.items?.length || 0}</p>
              </div>
              <div className="border border-green-200 rounded-xl p-3 bg-green-50 text-center">
                <p className="text-[10px] font-bold text-green-800 uppercase">Normal Status</p>
                <p className="text-xl font-black text-green-900">{reportData.summary.normal || 0}</p>
              </div>
              <div className="border border-amber-200 rounded-xl p-3 bg-amber-50 text-center">
                <p className="text-[10px] font-bold text-amber-800 uppercase">MAM / Underweight</p>
                <p className="text-xl font-black text-amber-900">{reportData.summary.mam || 0}</p>
              </div>
              <div className="border border-red-200 rounded-xl p-3 bg-red-50 text-center">
                <p className="text-[10px] font-bold text-red-800 uppercase">SAM / At Risk</p>
                <p className="text-xl font-black text-red-900">{reportData.summary.sam || 0}</p>
              </div>
            </div>
          )}

          {/* Data Table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-8">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-green-800 text-white font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3 border-b border-green-700">#</th>
                  <th className="p-3 border-b border-green-700">Child / Beneficiary Name</th>
                  <th className="p-3 border-b border-green-700">Age (Mos)</th>
                  <th className="p-3 border-b border-green-700">Sex</th>
                  <th className="p-3 border-b border-green-700">Guardian Name</th>
                  <th className="p-3 border-b border-green-700">Weight (kg)</th>
                  <th className="p-3 border-b border-green-700">Height (cm)</th>
                  <th className="p-3 border-b border-green-700">Nutritional Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reportData.items && reportData.items.length > 0 ? (
                  reportData.items.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="p-3 font-semibold text-gray-500">{idx + 1}</td>
                      <td className="p-3 font-bold text-gray-900">{item.first_name} {item.last_name}</td>
                      <td className="p-3 font-medium text-gray-700">{item.age_in_months ?? '—'}</td>
                      <td className="p-3 font-medium text-gray-700 capitalize">{item.sex || '—'}</td>
                      <td className="p-3 font-medium text-gray-700">{item.guardian_name || '—'}</td>
                      <td className="p-3 font-semibold text-gray-800">{item.weight_kg ? `${item.weight_kg} kg` : '—'}</td>
                      <td className="p-3 font-semibold text-gray-800">{item.height_cm ? `${item.height_cm} cm` : '—'}</td>
                      <td className="p-3 font-bold">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                          item.overall_status === 'normal' ? 'bg-green-100 text-green-800' :
                          item.overall_status === 'MAM' ? 'bg-amber-100 text-amber-800' :
                          item.overall_status === 'SAM' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {item.overall_status || 'No Record'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-gray-400 font-medium">
                      No beneficiary records found for this report layout.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Signatures Footer */}
          <div className="grid grid-cols-2 gap-12 pt-6 border-t border-gray-200 print:pt-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Prepared by:</p>
              <div className="mt-8 border-b border-gray-400 w-48" />
              <p className="text-xs font-bold text-gray-800 mt-1">Barangay Nutrition Scholar (BNS)</p>
              <p className="text-[10px] text-gray-400">Signature over printed name</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Noted & Approved by:</p>
              <div className="mt-8 border-b border-gray-400 w-48" />
              <p className="text-xs font-bold text-gray-800 mt-1">Barangay Health Worker (BHW) Lead</p>
              <p className="text-[10px] text-gray-400">Signature over printed name</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
