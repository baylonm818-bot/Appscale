import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  const role = sessionStorage.getItem('role') || localStorage.getItem('role');
  const homePath = token && role === 'admin' ? '/admin/dashboard' : token ? '/bhw/dashboard' : '/login';

  return (
    <div className="min-h-screen bg-[#f6faf9] flex items-center justify-center p-6 text-center">
      <div className="bg-white rounded-3xl p-8 sm:p-12 max-w-md w-full shadow-xl border border-gray-100 flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-5 ring-8 ring-emerald-50/50">
          <FileQuestion size={32} />
        </div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">404</h1>
        <h2 className="text-lg font-bold text-gray-800 mt-1">Page Not Found</h2>
        <p className="text-xs text-gray-500 mt-2 max-w-xs leading-relaxed">
          The page you are looking for does not exist or may have been moved.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 mt-8 w-full">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 transition cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Go Back</span>
          </button>
          <Link
            to={homePath}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-linear-to-r from-[#1b5e20] to-[#2e7d32] text-white font-bold text-xs shadow-sm hover:from-[#154a1a] hover:to-[#256427] transition"
          >
            <Home size={14} />
            <span>Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
