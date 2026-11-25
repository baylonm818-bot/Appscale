import { useState, useEffect, useRef } from 'react';
import axiosClient from '../api/axiosClient';
import { API_ORIGIN, getProfileImageUrl, getUserInitials } from '../api/config';
import { useAuth } from '../components/AuthContext';
import { Camera, Lock, User, ChevronRight, Info, MapPin, Mail, ShieldCheck, X } from 'lucide-react';
import logo from '../assets/logo.png';
import FormLabel, { FormRequiredNote, sanitizeContact, validateContact } from '../components/ui/FormLabel';

/* ── Inline-edit field row ── */
function ProfileInfoRow({ label, value, name, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    setTempValue(value || '');
    setErrorText('');
  }, [value, isEditing]);

  const handleSave = async () => {
    if (name === 'contact_number' && tempValue.trim()) {
      const err = validateContact(tempValue, false);
      if (err) {
        setErrorText(err);
        return;
      }
    }
    setErrorText('');
    setSaving(true);
    const success = await onSave(name, tempValue.trim());
    setSaving(false);
    if (success !== false) {
      setIsEditing(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (name === 'contact_number') {
      setTempValue(sanitizeContact(val));
    } else {
      setTempValue(val);
    }
    if (errorText) setErrorText('');
  };

  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        {isEditing ? (
          <div>
            <input
              autoFocus
              disabled={saving}
              type={name === 'contact_number' ? 'tel' : 'text'}
              inputMode={name === 'contact_number' ? 'numeric' : undefined}
              maxLength={name === 'contact_number' ? 11 : undefined}
              placeholder={name === 'contact_number' ? '09xxxxxxxxx' : undefined}
              value={tempValue}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') { setIsEditing(false); setTempValue(value || ''); setErrorText(''); }
              }}
              className={`border rounded-xl px-3 py-1.5 text-sm w-full focus:outline-none transition disabled:bg-gray-50 ${
                errorText ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : 'border-[#2e7d32] focus:ring-2 focus:ring-green-100'
              }`}
            />
            {errorText && <p className="text-xs text-[#D32F2F] mt-1">{errorText}</p>}
          </div>
        ) : (
          <p className="text-sm font-semibold text-gray-800 truncate">{value || <span className="text-gray-400 font-normal">—</span>}</p>
        )}
      </div>
      <div className="ml-4 shrink-0">
        {isEditing ? (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs font-bold text-white bg-[#2e7d32] hover:bg-[#256427] px-3 py-1.5 rounded-lg transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setIsEditing(false); setTempValue(value || ''); setErrorText(''); }}
              disabled={saving}
              className="text-xs font-semibold text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setIsEditing(true)}
            className="text-xs font-semibold text-[#2e7d32] hover:text-[#1b5e20] flex items-center gap-1 transition">
            Edit <ChevronRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-green-100 transition";

/* ── Client-side image compressor for avatar uploads ── */
const resizeImageFile = (file, maxDimension = 512, quality = 0.82) => {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!file.type || !file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for processing.'));
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(event.target.result);
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch {
          resolve(event.target.result);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
};

/* ══════════════════════════════════════════════════════════ */
function Profile() {
  const storedUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
  const { user, updateUser, updateAvatar } = useAuth();

  const [profile, setProfile]   = useState(() => user || (storedUser && Object.keys(storedUser).length ? storedUser : {}));
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [passwordMsg, setPasswordMsg]   = useState('');
  const [passwordErr, setPasswordErr]   = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const fileInputRef = useRef(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [picError, setPicError]         = useState('');
  const [profileImageSrc, setProfileImageSrc] = useState(null);

  // Keep local profile state synced with AuthContext
  useEffect(() => {
    if (user && typeof user === 'object') {
      setProfile((prev) => ({ ...(prev || {}), ...user }));
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const res = await axiosClient.get('/profile/me');
      if (res.data) {
        setProfile((prev) => ({ ...(prev || {}), ...res.data }));
        if (updateUser) updateUser(res.data);
      }
      setError('');
    } catch (err) {
      console.warn('[Profile] Non-critical profile sync warning:', err?.message);
      // If we don't have basic details yet, show non-blocking retry banner
      if (!profile?.first_name && !user?.first_name && !storedUser?.first_name) {
        setError('Unable to load profile data from server.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  useEffect(() => {
    let cancelled = false;
    const pic = profile?.profile_picture;
    if (!pic || typeof pic !== 'string' || !pic.trim()) {
      setProfileImageSrc(null);
      return;
    }
    if (/^(data:|https?:|blob:)?\/\//i.test(pic.trim()) || pic.trim().startsWith('data:') || pic.trim().startsWith('blob:')) {
      setProfileImageSrc(pic.trim());
      return;
    }
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const targetId = profile?.user_id || 'me';
    (async () => {
      try {
        const res = await fetch(`${API_ORIGIN}/api/profile/${targetId}/picture/data`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          if (!cancelled) setProfileImageSrc(getProfileImageUrl(pic));
          return;
        }
        const j = await res.json();
        if (!cancelled && j?.profile_picture) {
          setProfileImageSrc(j.profile_picture);
        } else if (!cancelled) {
          setProfileImageSrc(getProfileImageUrl(pic));
        }
      } catch {
        if (!cancelled) setProfileImageSrc(getProfileImageUrl(pic));
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.profile_picture, profile?.user_id]);

  const handleFieldSave = async (fieldName, value) => {
    const updated = { ...profile, [fieldName]: value };
    setProfileMsg('');
    setProfileErr('');
    try {
      const targetId = profile?.user_id || 'me';
      const res = await axiosClient.put(`/profile/${targetId}`, {
        first_name: updated.first_name,
        middle_initial: updated.middle_initial,
        last_name: updated.last_name,
        email: updated.email,
        contact_number: updated.contact_number,
        purok: updated.purok,
        language: updated.language || 'en',
        age_format_days: updated.age_format_days ? 1 : 0,
      });
      const returnedUser = res.data?.user || updated;
      setProfile(returnedUser);
      if (updateUser) updateUser(returnedUser);
      if (fieldName === 'language') {
        localStorage.setItem('lang', value);
      }
      if (fieldName === 'age_format_days') {
        localStorage.setItem('age_format_days', value ? '1' : '0');
      }
      setProfileMsg('Settings updated successfully.');
      setTimeout(() => setProfileMsg(''), 4000);
      return true;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update profile. Please try again.';
      setProfileErr(msg);
      setTimeout(() => setProfileErr(''), 5000);
      return false;
    }
  };

  const handlePictureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset file input so selecting the same file again triggers onChange
    e.target.value = '';

    setPicError('');
    setProfileMsg('');
    setUploadingPic(true);

    try {
      // Compress image client-side to keep size small (~40KB), avoiding any payload limits
      const base64Data = await resizeImageFile(file, 512, 0.82);
      if (!base64Data) {
        throw new Error('Could not process selected image.');
      }
      setProfileImageSrc(base64Data);

      const targetId = profile?.user_id || 'me';
      const res = await axiosClient.post(`/profile/${targetId}/picture`, {
        profile_picture: base64Data,
      });

      const savedPic = res.data?.profile_picture || base64Data;
      const updatedUser = res.data?.user || { ...profile, profile_picture: savedPic };
      setProfile(updatedUser);
      setProfileImageSrc(savedPic);
      if (typeof updateAvatar === 'function') {
        updateAvatar(savedPic);
      }
      if (typeof updateUser === 'function') {
        updateUser(updatedUser);
      }
      setProfileMsg('Profile picture updated successfully.');
      setTimeout(() => setProfileMsg(''), 4000);
    } catch (err) {
      console.error('Upload profile picture error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to upload profile picture. Please try again.';
      setPicError(msg);
      setTimeout(() => setPicError(''), 5000);
    } finally {
      setUploadingPic(false);
    }
  };

  const [passwordErrors, setPasswordErrors] = useState({});
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Lock body scroll while password modal is open so background page stays fixed / hindi gumagalaw
  useEffect(() => {
    if (showPasswordModal) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [showPasswordModal]);

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    setPasswordErrors({});
    setPasswordErr('');
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm({ ...passwordForm, [name]: value });
    if (passwordErrors[name]) {
      setPasswordErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordErr('');

    const errs = {};
    if (!passwordForm.current_password) errs.current_password = 'This field is required';
    if (!passwordForm.new_password) errs.new_password = 'This field is required';
    if (!passwordForm.confirm_password) errs.confirm_password = 'This field is required';

    if (Object.keys(errs).length > 0) {
      setPasswordErrors(errs);
      return;
    }

    if (passwordForm.new_password.length < 8) {
      setPasswordErr('New password must be at least 8 characters long.');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordErr('New passwords do not match.');
      return;
    }

    setPasswordErrors({});
    setSavingPassword(true);
    try {
      const targetId = profile?.user_id || 'me';
      const res = await axiosClient.patch(`/profile/${targetId}/password`, {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordMsg(res.data?.message || 'Password changed successfully.');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => {
        setShowPasswordModal(false);
      }, 1200);
      setTimeout(() => setPasswordMsg(''), 4000);
    } catch (err) {
      setPasswordErr(err.response?.data?.message || 'Current password is incorrect or change failed.');
      setTimeout(() => setPasswordErr(''), 5000);
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 animate-pulse">
          <div className="h-28 bg-gray-200" />
          <div className="px-6 pb-6 space-y-4">
            <div className="w-24 h-24 rounded-full bg-gray-300 -mt-12 border-4 border-white" />
            <div className="h-5 bg-gray-200 rounded w-1/4" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 rounded-2xl bg-white p-6 shadow-sm border border-gray-100 animate-pulse" />
          <div className="h-96 rounded-2xl bg-white p-6 shadow-sm border border-gray-100 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-3 rounded-xl">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => { setError(''); setLoading(true); fetchProfile(); }}
            className="font-bold underline ml-3 hover:text-amber-900 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Profile Hero Card ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Cover banner with Green Gradient (No change photo button) */}
        <div className="h-28 sm:h-32 bg-linear-to-r from-[#14471e] via-[#1b5e20] to-[#2e7d32]" />

        <div className="px-6 sm:px-8 pb-6">
          {/* Avatar row overlapping the banner bottom */}
          <div className="flex items-end justify-between -mt-12 sm:-mt-14 mb-4">
            {/* Avatar Frame + Camera Button */}
            <div className="relative">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white shadow-md overflow-hidden bg-emerald-50 ring-1 ring-black/5">
                {profileImageSrc || profile?.profile_picture ? (
                  <img
                    src={profileImageSrc || getProfileImageUrl(profile?.profile_picture)}
                    alt="Profile"
                    className="w-full h-full object-cover rounded-full"
                    onError={(ev) => {
                      ev.currentTarget.style.display = 'none';
                      const fb = document.createElement('div');
                      fb.className = 'w-full h-full flex items-center justify-center bg-linear-to-br from-[#1b5e20] to-[#2e7d32] text-white text-2xl font-black rounded-full';
                      fb.textContent = getUserInitials(profile);
                      ev.currentTarget.parentElement?.appendChild(fb);
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-[#1b5e20] to-[#2e7d32] text-white text-2xl font-black rounded-full">
                    {getUserInitials(profile)}
                  </div>
                )}
                {uploadingPic && (
                  <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center text-white text-xs font-semibold z-10 backdrop-blur-xs">
                    Uploading…
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPic}
                title="Upload profile picture"
                className="absolute bottom-0 right-0 bg-[#1b5e20] hover:bg-[#14471e] text-white p-2 rounded-full shadow-md border-2 border-white transition-transform hover:scale-110 z-20 cursor-pointer"
              >
                <Camera size={13} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePictureChange} className="hidden" />
            </div>

            {/* Role badge with icon */}
            <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-xs font-bold px-3.5 py-1.5 rounded-full uppercase tracking-wide shadow-xs">
              <ShieldCheck size={14} className="text-green-700" />
              {profile?.role || user?.role || 'Admin'}
            </span>
          </div>

          {/* User Name, Title & Location Row */}
          <div>
            <h2 className="text-xl font-black text-gray-900">
              {(profile?.first_name || profile?.last_name)
                ? `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
                : (user?.full_name || user?.name || user?.username || 'Camille Cadag')}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
              <div className="flex items-center gap-1.5">
                <Mail size={14} className="text-gray-400 shrink-0" />
                <span>{profile?.email || user?.email || 'coders319@gmail.com'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <MapPin size={14} className="text-gray-400 shrink-0" />
                <span>
                  {profile?.barangay || user?.barangay || 'Dawis'}{profile?.municipality || user?.municipality ? `, ${profile?.municipality || user?.municipality}` : ', Gasan'}
                </span>
              </div>
            </div>
          </div>

          {picError && <p className="text-xs text-red-600 mt-3">{picError}</p>}
        </div>
      </div>

      {/* ── 1. Personal Information Card ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
            <User size={16} className="text-green-700" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-800">Personal Information</h3>
            <p className="text-xs text-gray-400">Click Edit on any field to update it</p>
          </div>
        </div>
        {profileMsg && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-2.5 font-medium">{profileMsg}</div>}
        {profileErr && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5">{profileErr}</div>}
        <ProfileInfoRow label="First Name"      name="first_name"      value={profile?.first_name || ''}      onSave={handleFieldSave} />
        <ProfileInfoRow label="Middle Initial"  name="middle_initial"  value={profile?.middle_initial || ''}  onSave={handleFieldSave} />
        <ProfileInfoRow label="Last Name"       name="last_name"       value={profile?.last_name || ''}       onSave={handleFieldSave} />
        <ProfileInfoRow label="Email"           name="email"           value={profile?.email || ''}           onSave={handleFieldSave} />
        <ProfileInfoRow label="Contact Number"  name="contact_number"  value={profile?.contact_number || ''}  onSave={handleFieldSave} />
        <ProfileInfoRow label="Purok"           name="purok"           value={profile?.purok || ''}           onSave={handleFieldSave} />
      </div>

      {/* ── 2. Change Password Card ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
            <Lock size={16} className="text-green-700" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-800">Change Password</h3>
            <p className="text-xs text-gray-400">Use a strong password you don't use elsewhere</p>
          </div>
        </div>

        {passwordMsg && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-2.5 font-medium">
            {passwordMsg}
          </div>
        )}

        <div className="flex items-center justify-between py-4 border-t border-gray-50">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Password</p>
            <p className="text-base font-bold text-gray-800 tracking-widest font-mono select-none">
              ••••••••••••
            </p>
          </div>
          <div className="ml-4 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowPasswordModal(true);
                setPasswordErr('');
                setPasswordMsg('');
                setPasswordErrors({});
              }}
              className="text-xs font-semibold text-[#2e7d32] hover:text-[#1b5e20] flex items-center gap-1 transition cursor-pointer px-3 py-1.5 rounded-lg hover:bg-green-50"
            >
              Edit <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. About AppScale Card ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
            <Info size={16} className="text-[#2e7d32]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-800">About AppScale</h3>
            <p className="text-xs text-gray-400">System information and program details</p>
          </div>
        </div>

        <div className="bg-linear-to-br from-green-50 to-emerald-50/40 border border-green-100 rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-3.5 mb-3">
            <div className="w-12 h-12 rounded-xl bg-white shadow-xs border border-green-100 flex items-center justify-center p-2">
              <img src={logo} alt="AppScale" className="w-full h-full object-contain" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-gray-900">AppScale</h4>
              <p className="text-xs font-semibold text-[#2e7d32]">Child Nutrition Monitoring & Early Warning System</p>
            </div>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            AppScale is the digital health and nutrition monitoring platform of the Municipality of Gasan, Marinduque. Designed for Rural Health Units (RHU), Barangay Nutrition Scholars (BNS), and Barangay Health Workers (BHW) to track child growth and maternal health indicators.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="rounded-2xl p-4 bg-gray-50 border border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-gray-400">Application Version</p>
            <p className="text-sm font-bold text-gray-800">v3.3.15</p>
          </div>
          <div className="rounded-2xl p-4 bg-gray-50 border border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-gray-400">Municipality</p>
            <p className="text-sm font-bold text-gray-800">Gasan, Marinduque</p>
          </div>
          <div className="rounded-2xl p-4 bg-gray-50 border border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-gray-400">Target Beneficiaries</p>
            <p className="text-sm font-bold text-gray-800">Children 0–59 months & Mothers</p>
          </div>
          <div className="rounded-2xl p-4 bg-gray-50 border border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-gray-400">Platform Deployment</p>
            <p className="text-sm font-bold text-gray-800">Web Admin Portal & Flutter Mobile</p>
          </div>
        </div>

        <div className="text-center pt-3 text-xs text-gray-400 border-t border-gray-100">
          © {new Date().getFullYear()} Municipal Nutrition Committee • Rural Health Unit of Gasan
        </div>
      </div>

      {/* ── Change Password Modal Popup ── */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-9999 p-4 overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingPassword) {
              closePasswordModal();
            }
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header matching Schedule/UserManagement */}
            <div className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-5 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-bold text-white">Change Password</h2>
                <p className="text-white/70 text-xs mt-0.5">Fill in your password details below</p>
              </div>
              <button
                type="button"
                onClick={closePasswordModal}
                disabled={savingPassword}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <form onSubmit={submitPassword} noValidate className="space-y-4">
                <FormRequiredNote />

                {passwordMsg && (
                  <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl px-3.5 py-2.5 font-medium">
                    {passwordMsg}
                  </div>
                )}
                {passwordErr && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3.5 py-2.5">
                    {passwordErr}
                  </div>
                )}

                {[
                  { name: 'current_password', label: 'Current Password', placeholder: 'Enter your current password' },
                  { name: 'new_password',     label: 'New Password',     placeholder: 'Minimum 8 characters' },
                  { name: 'confirm_password', label: 'Confirm New Password', placeholder: 'Re-enter new password' },
                ].map(({ name, label, placeholder }) => (
                  <div key={name}>
                    <FormLabel label={label} required />
                    <input
                      name={name}
                      type="password"
                      placeholder={placeholder}
                      value={passwordForm[name]}
                      onChange={handlePasswordChange}
                      className={`${inputCls} ${passwordErrors[name] ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : ''}`}
                    />
                    {passwordErrors[name] && <p className="text-xs text-[#D32F2F] mt-1">{passwordErrors[name]}</p>}
                  </div>
                ))}

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 mt-5">
                  <button
                    type="button"
                    onClick={closePasswordModal}
                    disabled={savingPassword}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-linear-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] transition disabled:opacity-60 shadow-sm cursor-pointer"
                  >
                    {savingPassword ? 'Saving…' : 'Change Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;