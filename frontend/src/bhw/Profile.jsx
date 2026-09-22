import { useState, useEffect, useRef } from 'react';
import axiosClient from '../api/axiosClient';
import { API_ORIGIN, getProfileImageUrl, getUserInitials } from '../api/config';
import { useAuth } from '../components/AuthContext';
import { Camera, Lock, User, ShieldCheck, ChevronRight } from 'lucide-react';

function ProfileInfoRow({ label, value, name, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value || '');

  useEffect(() => { setTempValue(value || ''); }, [value]);

  const handleSave = () => { onSave(name, tempValue); setIsEditing(false); };

  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        {isEditing ? (
          <input
            autoFocus
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            className="border border-[#2e7d32] rounded-xl px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-100 transition"
          />
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
            <button onClick={() => { setIsEditing(false); setTempValue(value || ''); }}
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

const TABS = [
  { key: 'profile',  label: 'Profile Info',     icon: User        },
  { key: 'password', label: 'Change Password',  icon: Lock        },
  { key: 'security', label: 'Account Security', icon: ShieldCheck },
];

const inputCls = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-green-100 transition";

function Profile() {
  const storedUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
  const { updateUser } = useAuth();

  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
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

  const fetchProfile = async () => {
    try {
      const res = await axiosClient.get(`/profile/${storedUser.user_id}`);
      setProfile(res.data); updateUser(res.data);
    } catch { setError('Failed to load profile.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProfile(); }, []);

  useEffect(() => {
    let cancelled = false;
    setProfileImageSrc(null);
    const pic = profile?.profile_picture;
    if (!pic || typeof pic !== 'string' || !pic.trim()) return;
    if (/^(data:|https?:)?\/\//i.test(pic.trim())) return;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token || !profile?.user_id) return;
    (async () => {
      try {
        const res = await fetch(`${API_ORIGIN}/api/profile/${profile.user_id}/picture/data`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const j = await res.json();
        if (!cancelled && j?.profile_picture) setProfileImageSrc(j.profile_picture);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [profile?.profile_picture, profile?.user_id]);

  const handleFieldSave = async (fieldName, value) => {
    const updated = { ...profile, [fieldName]: value };
    setProfileMsg(''); setProfileErr('');
    try {
      await axiosClient.put(`/profile/${storedUser.user_id}`, {
        first_name: updated.first_name, middle_initial: updated.middle_initial,
        last_name: updated.last_name, email: updated.email,
        contact_number: updated.contact_number, purok: updated.purok,
      });
      setProfile(updated); updateUser(updated);
      setProfileMsg('Updated successfully.');
      setTimeout(() => setProfileMsg(''), 2500);
    } catch (err) { setProfileErr(err.response?.data?.message || 'Update failed.'); }
  };

  const handlePictureChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPicError(''); setUploadingPic(true);
    const fd = new FormData(); fd.append('profile_picture', file);
    try {
      const res = await axiosClient.post(`/profile/${storedUser.user_id}/picture`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfile({ ...profile, profile_picture: res.data.profile_picture });
      updateUser({ profile_picture: res.data.profile_picture });
      const updated = { ...storedUser, profile_picture: res.data.profile_picture };
      if (localStorage.getItem('user'))   localStorage.setItem('user', JSON.stringify(updated));
      if (sessionStorage.getItem('user')) sessionStorage.setItem('user', JSON.stringify(updated));
    } catch { setPicError('Failed to upload profile picture.'); }
    finally { setUploadingPic(false); }
  };

  const handlePasswordChange = (e) => setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });

  const submitPassword = async (e) => {
    e.preventDefault(); setPasswordMsg(''); setPasswordErr('');
    if (passwordForm.new_password !== passwordForm.confirm_password) { setPasswordErr('New passwords do not match.'); return; }
    setSavingPassword(true);
    try {
      await axiosClient.patch(`/profile/${storedUser.user_id}/password`, {
        current_password: passwordForm.current_password, new_password: passwordForm.new_password,
      });
      setPasswordMsg('Password changed successfully.');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) { setPasswordErr(err.response?.data?.message || 'Failed to update password.'); }
    finally { setSavingPassword(false); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-green-200 border-t-green-600 animate-spin" />
        <p className="text-sm font-medium text-gray-400">Loading profile…</p>
      </div>
    );
  }

  if (error) return <p className="text-red-600 p-6">{error}</p>;

  return (
    <div className="space-y-6">

      {/* ── Hero Profile Card ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
        <div className="h-28 bg-gradient-to-r from-[#1b5e20] via-[#2e7d32] to-emerald-500" />

        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-12 mb-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-green-100">
                {profile.profile_picture ? (
                  <img
                    src={profileImageSrc || getProfileImageUrl(profile.profile_picture)}
                    alt="Profile" className="w-full h-full object-cover"
                    onError={(ev) => {
                      const cont = ev.currentTarget.parentElement; if (!cont) return;
                      ev.currentTarget.style.display = 'none';
                      const fb = document.createElement('div');
                      fb.className = 'w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1b5e20] to-[#2e7d32] text-white text-2xl font-black';
                      fb.textContent = getUserInitials(profile);
                      cont.replaceChildren(fb);
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1b5e20] to-[#2e7d32] text-white text-2xl font-black">
                    {getUserInitials(profile)}
                  </div>
                )}
                {uploadingPic && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-semibold">
                    Uploading…
                  </div>
                )}
              </div>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingPic}
                className="absolute bottom-0.5 right-0.5 bg-[#2e7d32] hover:bg-[#256427] p-2 rounded-full shadow-md text-white transition">
                <Camera size={13} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePictureChange} className="hidden" />
            </div>

            <span className="bg-green-100 text-green-800 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide">
              {profile.role}
            </span>
          </div>

          <h2 className="text-xl font-black text-gray-900">{profile.first_name} {profile.last_name}</h2>
          <p className="text-sm text-gray-400 mt-0.5">{profile.email}</p>
          <p className="text-xs text-gray-400 mt-0.5">{profile.barangay}{profile.municipality ? `, ${profile.municipality}` : ''}</p>
          {picError && <p className="text-xs text-red-600 mt-2">{picError}</p>}
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="bg-white rounded-2xl shadow-sm p-1.5 flex gap-1 border border-gray-100 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-1 justify-center
              ${activeTab === key
                ? 'bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] text-white shadow-xs'
                : 'text-gray-500 hover:bg-gray-50'
              }`}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">

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
                <Lock size={16} className="text-[#2e7d32]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">Change Password</h3>
                <p className="text-xs text-gray-400">Ensure your new password is secure</p>
              </div>
            </div>
            {passwordMsg && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-2.5 font-medium">{passwordMsg}</div>}
            {passwordErr && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5">{passwordErr}</div>}
            <form onSubmit={submitPassword} className="space-y-4 max-w-lg">
              {[
                { name: 'current_password', label: 'Current Password' },
                { name: 'new_password',     label: 'New Password'     },
                { name: 'confirm_password', label: 'Confirm New Password' },
              ].map(({ name, label }) => (
                <div key={name}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">{label}</label>
                  <input name={name} type="password" value={passwordForm[name]} onChange={handlePasswordChange} required className={inputCls} />
                </div>
              ))}
              <button type="submit" disabled={savingPassword}
                className="w-full sm:w-auto px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] transition disabled:opacity-60 shadow-sm">
                {savingPassword ? 'Saving…' : 'Change Password'}
              </button>
            </form>
          </>
        )}

        {/* SECURITY */}
        {activeTab === 'security' && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <ShieldCheck size={16} className="text-[#2e7d32]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">Account Security</h3>
                <p className="text-xs text-gray-400">Review your current account credentials and assignment</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Username',          value: profile.username || '—' },
                { label: 'Email',             value: profile.email    || '—' },
                { label: 'Role',              value: (profile.role || '—').toUpperCase() },
                { label: 'Assigned Barangay', value: profile.barangay || '—' },
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