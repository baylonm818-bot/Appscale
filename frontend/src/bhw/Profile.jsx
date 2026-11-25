import { useState, useEffect, useRef } from 'react';
import axiosClient from '../api/axiosClient';
import { API_ORIGIN, getProfileImageUrl, getUserInitials } from '../api/config';
import { useAuth } from '../components/AuthContext';
import { Camera, Lock, User, ChevronRight, Check, Info, Pencil, Briefcase, Sparkles, MapPin, Mail, ArrowRight } from 'lucide-react';
import logo from '../assets/logo.png';
import { motion, AnimatePresence } from 'framer-motion';
import { ShimmerSkeleton } from '../components/ui/motion';
import FormLabel, { FormRequiredNote, sanitizeContact, validateContact } from '../components/ui/FormLabel';

function ProfileInfoRow({ label, value, name, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value || '');
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    setTempValue(value || '');
    setErrorText('');
  }, [value, isEditing]);

  const handleSave = () => {
    if (name === 'contact_number' && tempValue.trim()) {
      const err = validateContact(tempValue, false);
      if (err) {
        setErrorText(err);
        return;
      }
    }
    setErrorText('');
    onSave(name, tempValue.trim());
    setIsEditing(false);
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
              className={`border rounded-xl px-3 py-1.5 text-sm w-full focus:outline-none transition ${
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
            <button onClick={handleSave}
              className="text-xs font-bold text-white bg-[#2e7d32] hover:bg-[#256427] px-3 py-1.5 rounded-lg transition">
              Save
            </button>
            <button onClick={() => { setIsEditing(false); setTempValue(value || ''); setErrorText(''); }}
              className="text-xs font-semibold text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg transition">
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

/* ── Toggle switch ── */
function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer
        ${checked ? 'bg-[#2e7d32]' : 'bg-gray-200'}`}>
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform
        ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

const TABS = [
  { key: 'profile',     label: 'Profile Info',        icon: User },
  { key: 'password',    label: 'Security & Password', icon: Lock },
  { key: 'about',       label: 'About System',        icon: Info },
];

const inputCls = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-green-100 transition";

function Profile() {
  const storedUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
  const { user, updateUser, updateAvatar } = useAuth();

  const [profile, setProfile]   = useState(() => user || (storedUser && Object.keys(storedUser).length ? storedUser : {}));
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [activeTab, setActiveTab] = useState('profile');

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
      const targetId = profile?.user_id || storedUser?.user_id || 'me';
      const res = await axiosClient.get(`/profile/${targetId}`);
      if (res.data) {
        setProfile((prev) => ({ ...(prev || {}), ...res.data }));
        if (updateUser) updateUser(res.data);
      }
      setError('');
    } catch (err) {
      console.warn('[Profile] Non-critical profile sync warning:', err?.message);
      if (!profile?.first_name && !user?.first_name && !storedUser?.first_name) {
        setError('Unable to load profile data from server.');
      }
    }
    finally { setLoading(false); }
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
    if (!token || !profile?.user_id) {
      setProfileImageSrc(getProfileImageUrl(pic));
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_ORIGIN}/api/profile/${profile.user_id}/picture/data`, { headers: { Authorization: `Bearer ${token}` } });
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

const resizeImageFile = (file, maxDimension = 512, quality = 0.82) => {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!file.type || !file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image.'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image data.'));
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
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
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context unavailable.'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
};

  const handleFieldSave = async (fieldName, value) => {
    const updated = { ...profile, [fieldName]: value };
    setProfileMsg(''); setProfileErr('');
    try {
      const res = await axiosClient.put(`/profile/${storedUser.user_id}`, {
        first_name: updated.first_name, middle_initial: updated.middle_initial,
        last_name: updated.last_name, email: updated.email,
        contact_number: updated.contact_number, purok: updated.purok,
        language: updated.language || 'en',
        age_format_days: updated.age_format_days ? 1 : 0,
      });
      const returnedUser = res.data?.user || updated;
      setProfile(returnedUser);
      if (typeof updateUser === 'function') updateUser(returnedUser);
      if (fieldName === 'language') {
        localStorage.setItem('lang', value);
      }
      if (fieldName === 'age_format_days') {
        localStorage.setItem('age_format_days', value ? '1' : '0');
      }
      setProfileMsg('Updated successfully.');
      setTimeout(() => setProfileMsg(''), 2500);
    } catch (err) { setProfileErr(err.response?.data?.message || 'Update failed.'); }
  };

  const handlePictureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setPicError('');
    setUploadingPic(true);

    try {
      const base64Data = await resizeImageFile(file, 512, 0.82);
      if (!base64Data) throw new Error('Could not process image.');
      setProfileImageSrc(base64Data);

      const res = await axiosClient.post(`/profile/${storedUser.user_id}/picture`, {
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
    } catch {
      setPicError('Failed to upload profile picture.');
    } finally {
      setUploadingPic(false);
    }
  };

  const [passwordErrors, setPasswordFieldErrors] = useState({});

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm({ ...passwordForm, [name]: value });
    if (passwordErrors[name]) {
      setPasswordFieldErrors((prev) => ({ ...prev, [name]: '' }));
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
      setPasswordFieldErrors(errs);
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordErr('New passwords do not match.');
      return;
    }
    setPasswordFieldErrors({});
    setSavingPassword(true);
    try {
      await axiosClient.patch(`/profile/${storedUser.user_id}/password`, {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordMsg('Password changed successfully.');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setPasswordErr(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 p-6 space-y-4">
          <ShimmerSkeleton className="h-28 rounded-xl w-full" />
          <div className="space-y-2">
            <ShimmerSkeleton className="h-6 rounded-lg w-1/4" />
            <ShimmerSkeleton className="h-4 rounded-lg w-1/3" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ShimmerSkeleton className="lg:col-span-2 h-96 rounded-2xl" />
          <ShimmerSkeleton className="h-96 rounded-2xl" />
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

      {/* ── Hero Profile Card ── */}
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

            {/* Current Role badge on the right */}
            <div className="text-right">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Current role</span>
              <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-3.5 py-1.5 rounded-full uppercase tracking-wider border border-emerald-200 shadow-xs">
                {profile?.role || user?.role || 'Health Worker'}
              </span>
            </div>
          </div>

          {/* User Name, Title & Location Row */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                {(profile?.first_name || profile?.last_name)
                  ? `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
                  : (user?.full_name || user?.name || user?.username || 'Health Worker')}
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-[#1b5e20] mt-0.5">
                {profile?.role === 'BNS' ? 'Barangay Nutrition Scholar' : profile?.role === 'BHW' ? 'Barangay Health Worker' : (profile?.role || user?.role || 'Community Health Worker')}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-500">
                <span className="flex items-center gap-1 font-medium text-gray-700">
                  <MapPin size={12} className="text-emerald-700" />
                  Barangay {profile?.barangay || user?.barangay || 'Antipolo'}, {profile?.municipality || user?.municipality || 'Gasan'}, Marinduque
                </span>
                <span className="text-gray-300">•</span>
                <span className="flex items-center gap-1">
                  <Mail size={12} className="text-gray-400" />
                  {profile?.email || user?.email || ''}
                </span>
              </div>
            </div>

            {/* Scope Badges on right */}
            <div className="flex flex-wrap items-center sm:justify-end gap-1.5">
              <span className="bg-gray-100 text-gray-700 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-gray-200">
                {profile?.barangay || user?.barangay || 'Antipolo'}
              </span>
              <span className="bg-emerald-50 text-emerald-800 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
                Gasan Health Unit
              </span>
              <span className="bg-teal-50 text-teal-800 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-teal-200">
                Nutrition Monitoring
              </span>
            </div>
          </div>

          {picError && <p className="text-xs text-red-600 mt-3">{picError}</p>}
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="bg-white rounded-2xl shadow-sm p-1.5 flex gap-1 border border-gray-100 overflow-x-auto relative">
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors flex-1 justify-center z-10 cursor-pointer ${
                isActive ? 'text-white' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="bhwProfileTabIndicator"
                  className="absolute inset-0 bg-linear-to-r from-[#1b5e20] to-[#2e7d32] rounded-xl shadow-xs -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
              <Icon size={15} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >

        {/* PROFILE INFO */}
        {activeTab === 'profile' && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <User size={16} className="text-[#2e7d32]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">Personal Information</h3>
                <p className="text-xs text-gray-400">Click Edit to update your contact information</p>
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
          </>
        )}


        {/* CHANGE PASSWORD */}
        {activeTab === 'password' && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <Lock size={16} className="text-[#2e7d32]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">Change Password</h3>
                <p className="text-xs text-gray-400">Ensure your new password is secure</p>
              </div>
            </div>
            {passwordMsg && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-2.5 font-medium">{passwordMsg}</div>}
            {passwordErr && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5">{passwordErr}</div>}
            <form onSubmit={submitPassword} noValidate className="space-y-4 max-w-lg">
              <FormRequiredNote />
              {[
                { name: 'current_password', label: 'Current Password' },
                { name: 'new_password',     label: 'New Password'     },
                { name: 'confirm_password', label: 'Confirm New Password' },
              ].map(({ name, label }) => (
                <div key={name}>
                  <FormLabel label={label} required />
                  <input
                    name={name}
                    type="password"
                    value={passwordForm[name]}
                    onChange={handlePasswordChange}
                    className={`${inputCls} ${passwordErrors[name] ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : ''}`}
                  />
                  {passwordErrors[name] && <p className="text-xs text-[#D32F2F] mt-1">{passwordErrors[name]}</p>}
                </div>
              ))}
              <button type="submit" disabled={savingPassword}
                className="w-full sm:w-auto px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-linear-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] transition disabled:opacity-60 shadow-sm">
                {savingPassword ? 'Saving…' : 'Change Password'}
              </button>
            </form>
          </>
        )}

        {/* ABOUT */}
        {activeTab === 'about' && (
          <>
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
                <p className="text-sm font-bold text-gray-800">v3.2.0</p>
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
                <p className="text-sm font-bold text-gray-800">Web Portal & Flutter Mobile</p>
              </div>
            </div>

            <div className="text-center pt-3 text-xs text-gray-400 border-t border-gray-100">
              © {new Date().getFullYear()} Municipal Nutrition Committee • Rural Health Unit of Gasan
            </div>
          </>
        )}

          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}

export default Profile;