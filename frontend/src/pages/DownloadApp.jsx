import React from 'react';
import { Download, CheckCircle2, ShieldAlert, Smartphone } from 'lucide-react';
import { API_ORIGIN } from '../api/config';
import logo from '../assets/logo.png';

const DownloadApp = () => {
  const handleDownload = () => {
    // Direct link to the backend download route
    window.location.href = `${API_ORIGIN}/api/download-apk`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col md:flex-row overflow-x-hidden">
      
      {/* LEFT COLUMN: Hero Section */}
      <div className="flex-1 bg-gradient-to-br from-[#0c2a12] via-[#1b5e20] to-[#2e7d32] relative flex flex-col justify-center px-8 md:px-16 py-12 md:py-0">
        
        {/* Background grid pattern (subtle) */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        
        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-white p-1.5 rounded-xl shadow-lg">
              <img src={logo} alt="AppScale Logo" className="w-8 h-8 object-contain" />
            </div>
            <span className="text-xl font-bold tracking-widest uppercase">AppScale</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-black mb-6 leading-tight">
            Better Health, <br />
            <span className="text-green-300">In Your Hands.</span>
          </h1>
          
          <p className="text-green-50 text-base md:text-lg mb-10 leading-relaxed max-w-md">
            AppScale helps Barangay Nutrition Scholars (BNS) connect with communities, record vitals, and monitor child nutrition securely on the go.
          </p>

          <button 
            onClick={handleDownload}
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-white text-green-900 font-bold text-lg rounded-full shadow-2xl hover:bg-green-50 hover:scale-105 transition-all duration-300 w-full sm:w-auto"
          >
            <Download size={24} className="group-hover:-translate-y-1 transition-transform" />
            Download APK
          </button>
          
          <p className="mt-4 text-xs text-green-200/80 font-medium">
            Android App • Free Download • v1.0.0
          </p>
        </div>

        {/* Decorative phone mockup outline (Optional/Abstract) */}
        <div className="absolute right-0 bottom-0 opacity-20 pointer-events-none hidden lg:block transform translate-x-1/4 translate-y-1/4">
          <Smartphone size={400} strokeWidth={1} />
        </div>
      </div>

      {/* RIGHT COLUMN: Instructions / Steps */}
      <div className="flex-1 bg-gray-900 flex flex-col justify-center px-8 md:px-16 py-16">
        <div className="max-w-md w-full mx-auto">
          
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-full text-gray-300 text-sm font-medium mb-12 border border-gray-700">
            <ShieldAlert size={16} className="text-amber-400" />
            How to download AppScale?
          </div>

          <div className="space-y-12">
            
            {/* Step 1 */}
            <div className="relative">
              <div className="absolute left-[-2rem] top-1 text-gray-700 font-black text-6xl opacity-30 select-none">01</div>
              <div className="relative z-10 pl-6">
                <h3 className="text-2xl font-bold text-white mb-2">Download the APK</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  From this page, tap the <strong className="text-white">"Download APK"</strong> button. This will download the AppScale mobile application installation file directly to your device.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="absolute left-[-2rem] top-1 text-gray-700 font-black text-6xl opacity-30 select-none">02</div>
              <div className="relative z-10 pl-6">
                <h3 className="text-2xl font-bold text-white mb-2">Confirm Security Prompt</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Since the app is downloaded outside the Play Store, a security warning ("File might be harmful") may appear. Tap <strong className="text-white">"Download anyway"</strong> to proceed safely.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="absolute left-[-2rem] top-1 text-gray-700 font-black text-6xl opacity-30 select-none">03</div>
              <div className="relative z-10 pl-6">
                <h3 className="text-2xl font-bold text-white mb-2">Install App</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Open the downloaded file. If prompted, go to your settings and <strong className="text-white">"Allow from this source"</strong> to complete the installation.
                </p>
              </div>
            </div>

          </div>
          
          <div className="mt-16 pt-8 border-t border-gray-800 flex items-start gap-4">
             <CheckCircle2 size={24} className="text-green-500 shrink-0 mt-1" />
             <p className="text-xs text-gray-500 leading-relaxed">
               This APK is maintained securely by the AppScale development team. The download link automatically fetches the latest stable version of the app.
             </p>
          </div>

        </div>
      </div>

    </div>
  );
};

export default DownloadApp;
