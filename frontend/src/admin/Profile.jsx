import { useState, useEffect, useRef } from 'react';
import axiosClient from '../api/axiosClient';
import { API_ORIGIN, getProfileImageUrl, getUserInitials } from '../api/config';
import { useAuth } from '../components/AuthContext';
import { Camera, Lock, Bell, ShieldCheck, User, ChevronRight } from 'lucide-react';
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

/* ── Toggle switch ── */
function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
        ${checked ? 'bg-[#2e7d32]' : 'bg-gray-200'}`}>
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform
        ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

/* ── Tab definition ── */
const TABS = [
  { key: 'profile',       label: 'Profile',      icon: User       },
  { key: 'password',      label: 'Password',     icon: Lock       },
  { key: 'notifications', label: 'Notifications',icon: Bell       },
  { key: 'security',      label: 'Security',     icon: ShieldCheck},
];

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

  const [profile, setProfile]   = useState(() => user || (storedUser?.user_id ? storedUser : null));
  const [loading, setLoading]   = useState(() => !(user || storedUser?.user_id));
  const [error, setError]       = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const [notificationPreferences, setNotificationPreferences] = useState(() => {
    const saved = localStorage.getItem('notificationPreferences');
    return saved ? JSON.parse(saved) : { schedules: true, accounts: true, system: true };
  });

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
    if (user && user.user_id) {
      setProfile((prev) => ({ ...(prev || {}), ...user }));
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const res = await axiosClient.get('/profile/me');
      setProfile(res.data);
      if (updateUser) updateUser(res.data);
    } catch (err) {
      console.warn('[Profile] Non-critical profile sync warning:', err?.message);
      // Only set blocking error if no profile data exists at all
      if (!profile && !user && !storedUser?.user_id) {
        setError('Failed to load profile.');
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
      });
      const returnedUser = res.data?.user || updated;
      setProfile(returnedUser);
      if (updateUser) updateUser(returnedUser);
      setProfileMsg('Profile updated successfully.');
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
      setTimeout(() => setPasswordMsg(''), 4000);
    } catch (err) {
      setPasswordErr(err.response?.data?.message || 'Current password is incorrect or change failed.');
      setTimeout(() => setPasswordErr(''), 5000);
    } finally {
      setSavingPassword(false);
    }
  };

  const updateNotificationPreference = (name) => {
    setNotificationPreferences((cur) => {
      const updated = { ...cur, [name]: !cur[name] };
      localStorage.setItem('notificationPreferences', JSON.stringify(updated));
      return updated;
    });
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
  if (error) return <p className="text-red-600 text-sm p-6">{error}</p>;

  return (
    <div className="space-y-6">

      {/* ── Profile Hero Card ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* Cover banner */}
        <div className="h-28 bg-linear-to-r from-[#1b5e20] via-[#2e7d32] to-emerald-500" />

        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-12 mb-4">
            {/* Avatar + camera button */}
            <div className="relative">
              <div className="relative w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-green-100">
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
                className="absolute bottom-0.5 right-0.5 bg-[#2e7d32] hover:bg-[#256427] p-2 rounded-full shadow-md text-white transition z-20 cursor-pointer"
              >
                <Camera size={13} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePictureChange} className="hidden" />
            </div>

            {/* Role badge */}
            <span className="bg-green-100 text-green-800 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide shadow-sm">
              {profile.role}
            </span>
          </div>

          <h2 className="text-xl font-black text-gray-900">{profile.first_name} {profile.last_name}</h2>
          <p className="text-sm text-gray-400 mt-0.5">{profile.email}</p>
          <p className="text-xs text-gray-400 mt-0.5">{profile.barangay}{profile.municipality ? `, ${profile.municipality}` : ''}</p>
          {picError && <p className="text-xs text-red-600 mt-2">{picError}</p>}
        </div>
      </div>

      {/* ── Tab nav ── */}
      <div className="bg-white rounded-2xl shadow-sm p-1.5 flex gap-1 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-1 justify-center
              ${activeTab === key
                ? 'bg-linear-to-r from-[#1b5e20] to-[#2e7d32] text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-50'
              }`}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6">

        {/* PROFILE INFO */}
        {activeTab === 'profile' && (
          <>
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
            <ProfileInfoRow label="First Name"      name="first_name"      value={profile.first_name}      onSave={handleFieldSave} />
            <ProfileInfoRow label="Middle Initial"  name="middle_initial"  value={profile.middle_initial}  onSave={handleFieldSave} />
            <ProfileInfoRow label="Last Name"       name="last_name"       value={profile.last_name}       onSave={handleFieldSave} />
            <ProfileInfoRow label="Email"           name="email"           value={profile.email}           onSave={handleFieldSave} />
            <ProfileInfoRow label="Contact Number"  name="contact_number"  value={profile.contact_number}  onSave={handleFieldSave} />
            <ProfileInfoRow label="Purok"           name="purok"           value={profile.purok}           onSave={handleFieldSave} />
          </>
        )}

        {/* CHANGE PASSWORD */}
        {activeTab === 'password' && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <Lock size={16} className="text-green-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">Change Password</h3>
                <p className="text-xs text-gray-400">Use a strong password you don't use elsewhere</p>
              </div>
            </div>
            {passwordMsg && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-2.5 font-medium">{passwordMsg}</div>}
            {passwordErr && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5">{passwordErr}</div>}
            <form onSubmit={submitPassword} noValidate className="space-y-4">
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

        {/* NOTIFICATION PREFERENCES */}
        {activeTab === 'notifications' && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <Bell size={16} className="text-green-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">Notification Preferences</h3>
                <p className="text-xs text-gray-400">Choose which alerts appear in your feed</p>
              </div>
            </div>
            <div className="space-y-0 divide-y divide-gray-50">
              {[
                ['schedules', 'Schedule Reminders',   'Upcoming, completed, and missed community health schedules'],
                ['accounts',  'Account & User Alerts', 'User account creations, lockouts, and restorations'],
                ['system',    'System Alerts',        'Administrative and municipal maintenance notifications'],
              ].map(([name, label, desc]) => (
                <div key={name} className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                  </div>
                  <Toggle checked={notificationPreferences[name]} onChange={() => updateNotificationPreference(name)} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* SECURITY */}
        {activeTab === 'security' && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <ShieldCheck size={16} className="text-green-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">Account Security</h3>
                <p className="text-xs text-gray-400">Review your current account session details</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Email',             value: profile.email    || '—' },
                { label: 'Role',              value: (profile.role || '—').toUpperCase() },
                { label: 'Assigned Barangay', value: profile.barangay || 'Municipal account' },
                { label: 'Session Status',    value: 'Active', green: true },
              ].map(({ label, value, green }) => (
                <div key={label} className={`rounded-2xl p-4 ${green ? 'bg-green-50 border border-green-100' : 'bg-gray-50'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${green ? 'text-green-600' : 'text-gray-400'}`}>{label}</p>
                  <p className={`text-sm font-bold ${green ? 'text-green-800' : 'text-gray-800'}`}>{value}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Profile;