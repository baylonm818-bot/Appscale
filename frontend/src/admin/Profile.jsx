import { useState, useEffect, useRef } from 'react';
import axiosClient from '../api/axiosClient';
import { API_ORIGIN, getProfileImageUrl, getUserInitials } from '../api/config';
import { useAuth } from '../components/AuthContext';
import { Camera, Lock, Bell, ShieldCheck } from 'lucide-react';

function ProfileInfoRow({ label, value, name, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value || '');

  useEffect(() => {
    setTempValue(value || '');
  }, [value]);

  const handleSave = () => {
    onSave(name, tempValue);
    setIsEditing(false);
  };

  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
      <div className="flex-1">
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        {isEditing ? (
          <input
            autoFocus
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            className="border border-green-500 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none"
          />
        ) : (
          <p className="text-sm font-medium text-gray-800">{value || '—'}</p>
        )}
      </div>

      {isEditing ? (
        <div className="flex gap-2 ml-4">
          <button onClick={handleSave} className="text-green-600 text-sm font-semibold hover:underline">
            Save
          </button>
          <button
            onClick={() => { setIsEditing(false); setTempValue(value || ''); }}
            className="text-gray-400 text-sm hover:underline"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setIsEditing(true)} className="text-green-600 text-sm font-semibold ml-4 hover:underline">
          Edit
        </button>
      )}
    </div>
  );
}

function Profile() {
  const storedUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
  const { updateUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const [notificationPreferences, setNotificationPreferences] = useState(() => {
    const saved = localStorage.getItem('notificationPreferences');
    return saved ? JSON.parse(saved) : { referrals: true, schedules: true, malnutrition: true };
  });

  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const fileInputRef = useRef(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [picError, setPicError] = useState('');
  const [profileImageSrc, setProfileImageSrc] = useState(null);

  const fetchProfile = async () => {
    try {
      const response = await axiosClient.get(`/profile/${storedUser.user_id}`);
      setProfile(response.data);
      updateUser(response.data);
    } catch (err) {
      setError('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setProfileImageSrc(null);
    const pic = profile?.profile_picture;
    if (!pic || typeof pic !== 'string') return;
    const trimmed = pic.trim();
    if (!trimmed) return;
    if (/^(data:|https?:)?\/\//i.test(trimmed)) return;

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token || !profile?.user_id) return;

    const url = `${API_ORIGIN}/api/profile/${profile.user_id}/picture/data`;
    (async () => {
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const j = await res.json();
        if (!cancelled && j?.profile_picture) setProfileImageSrc(j.profile_picture);
      } catch (e) {
        // ignore
      }
    })();

    return () => { cancelled = true; };
  }, [profile?.profile_picture, profile?.user_id]);

  const handleFieldSave = async (fieldName, value) => {
    const updatedProfile = { ...profile, [fieldName]: value };
    setProfileMsg('');
    setProfileErr('');
    try {
      await axiosClient.put(`/profile/${storedUser.user_id}`, {
        first_name: updatedProfile.first_name,
        middle_initial: updatedProfile.middle_initial,
        last_name: updatedProfile.last_name,
        email: updatedProfile.email,
        contact_number: updatedProfile.contact_number,
        purok: updatedProfile.purok,
      });
      setProfile(updatedProfile);
      updateUser(updatedProfile);
      setProfileMsg(`${fieldName.replace('_', ' ')} updated.`);
      setTimeout(() => setProfileMsg(''), 2000);
    } catch (err) {
      setProfileErr(err.response?.data?.message || 'Update failed.');
    }
  };

  const handlePictureClick = () => fileInputRef.current?.click();

  const handlePictureChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPicError('');
    setUploadingPic(true);

    const formData = new FormData();
    formData.append('profile_picture', file);

    try {
      const response = await axiosClient.post(`/profile/${storedUser.user_id}/picture`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfile({ ...profile, profile_picture: response.data.profile_picture });
      updateUser({ profile_picture: response.data.profile_picture });

      const updatedUser = { ...storedUser, profile_picture: response.data.profile_picture };
      if (localStorage.getItem('user')) localStorage.setItem('user', JSON.stringify(updatedUser));
      if (sessionStorage.getItem('user')) sessionStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (err) {
      setPicError('Failed to upload picture.');
    } finally {
      setUploadingPic(false);
    }
  };

  const handlePasswordChange = (e) => setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });

  const submitPassword = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordErr('');

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordErr('New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await axiosClient.patch(`/profile/${storedUser.user_id}/password`, {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordMsg('Password changed successfully.');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setPasswordErr(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setSavingPassword(false);
    }
  };

  const updateNotificationPreference = (name) => {
    setNotificationPreferences((current) => {
      const updated = { ...current, [name]: !current[name] };
      localStorage.setItem('notificationPreferences', JSON.stringify(updated));
      return updated;
    });
  };

  if (loading) return <p className="text-gray-500">Loading profile...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="w-full flex justify-center ">
      <div className="w-full ">

        {/* Gradient Header Card */}
        <div className="relative rounded-2xl overflow-hidden shadow-lg bg-white mb-6">
          <div className="h-32 bg-linear-to-r from-green-500 via-emerald-400 to-lime-400" />

          <div className="px-6 pb-6">
            <div className="flex justify-between items-end -mt-12 mb-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-gray-200">
                  {profile.profile_picture ? (
                    <img
                      src={profileImageSrc || getProfileImageUrl(profile.profile_picture)}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      onError={(event) => {
                        const container = event.currentTarget.parentElement;
                        if (!container) return;
                        event.currentTarget.style.display = 'none';
                        const fallback = document.createElement('div');
                        fallback.className = 'w-full h-full flex items-center justify-center bg-green-600 text-white text-2xl font-bold';
                        fallback.textContent = getUserInitials(profile);
                        container.replaceChildren(fallback);
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-green-600 text-white text-2xl font-bold">
                      {getUserInitials(profile)}
                    </div>
                  )}
                  {uploadingPic && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs">
                      Uploading...
                    </div>
                  )}
                </div>
                <button
                  onClick={handlePictureClick}
                  disabled={uploadingPic}
                  className="absolute bottom-0 right-0 bg-green-600 hover:bg-green-700 p-1.5 rounded-full shadow-md text-white"
                >
                  <Camera size={14} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePictureChange}
                  className="hidden"
                />
              </div>

              <div className="text-right">
                <p className="text-xs text-gray-400 mb-1">Role
                  <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full uppercase">
                  {profile.role}
                </span>
                </p>
                
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-900">
              {profile.first_name} {profile.last_name}
            </h2>
            <p className="text-sm text-gray-500">{profile.username}</p>
            <p className="text-sm text-gray-500">{profile.barangay}, {profile.municipality}</p>

            {picError && <p className="text-xs text-red-600 mt-2">{picError}</p>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-5 py-2 rounded-lg font-semibold text-sm transition ${
              activeTab === 'profile' ? 'bg-green-600 text-white' : 'bg-white text-gray-500 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Profile Info
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm transition ${
              activeTab === 'password' ? 'bg-green-600 text-white' : 'bg-white text-gray-500 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Lock size={16} /> Change Password
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm transition ${
              activeTab === 'notifications' ? 'bg-green-600 text-white' : 'bg-white text-gray-500 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Bell size={16} /> Notifications
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm transition ${
              activeTab === 'security' ? 'bg-green-600 text-white' : 'bg-white text-gray-500 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <ShieldCheck size={16} /> Security
          </button>
        </div>

        {/* Content */}
        {activeTab === 'profile' ? (
          <div className="bg-white rounded-xl shadow-sm p-6">
            {profileMsg && <p className="text-green-600 text-sm mb-3">{profileMsg}</p>}
            {profileErr && <p className="text-red-600 text-sm mb-3">{profileErr}</p>}
            <ProfileInfoRow label="First Name" name="first_name" value={profile.first_name} onSave={handleFieldSave} />
            <ProfileInfoRow label="Middle Initial" name="middle_initial" value={profile.middle_initial} onSave={handleFieldSave} />
            <ProfileInfoRow label="Last Name" name="last_name" value={profile.last_name} onSave={handleFieldSave} />
            <ProfileInfoRow label="Email" name="email" value={profile.email} onSave={handleFieldSave} />
            <ProfileInfoRow label="Contact Number" name="contact_number" value={profile.contact_number} onSave={handleFieldSave} />
            <ProfileInfoRow label="Purok" name="purok" value={profile.purok} onSave={handleFieldSave} />
          </div>
        ) : activeTab === 'password' ? (
          <div className="bg-white rounded-xl shadow-sm p-6">
            {passwordMsg && <p className="text-green-600 text-sm mb-3">{passwordMsg}</p>}
            {passwordErr && <p className="text-red-600 text-sm mb-3">{passwordErr}</p>}
            <form onSubmit={submitPassword} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-gray-700">Current Password</label>
                <input
                  name="current_password"
                  type="password"
                  value={passwordForm.current_password}
                  onChange={handlePasswordChange}
                  required
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-600"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-gray-700">New Password</label>
                <input
                  name="new_password"
                  type="password"
                  value={passwordForm.new_password}
                  onChange={handlePasswordChange}
                  required
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-600"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-gray-700">Confirm New Password</label>
                <input
                  name="confirm_password"
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={handlePasswordChange}
                  required
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-600"
                />
              </div>
              <button
                type="submit"
                disabled={savingPassword}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold text-sm transition"
              >
                {savingPassword ? 'Saving...' : 'Change Password'}
              </button>
            </form>
          </div>
        ) : activeTab === 'notifications' ? (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800">Notification Preferences</h3>
            <p className="text-sm text-gray-400 mt-1 mb-5">Choose which alerts appear in your notification feed.</p>
            <div className="space-y-4">
              {[
                ['referrals', 'Referral alerts', 'New referrals submitted by BHWs'],
                ['schedules', 'Schedule reminders', 'Upcoming and missed activities'],
                ['malnutrition', 'Malnutrition alerts', 'Children needing nutrition follow-up'],
              ].map(([name, label, description]) => (
                <label key={name} className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4 last:border-0 last:pb-0 cursor-pointer">
                  <span>
                    <span className="block text-sm font-semibold text-gray-700">{label}</span>
                    <span className="block text-xs text-gray-400 mt-1">{description}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={notificationPreferences[name]}
                    onChange={() => updateNotificationPreference(name)}
                    className="h-4 w-4 accent-green-600"
                  />
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="rounded-full bg-green-100 p-2 text-green-700"><ShieldCheck size={18} /></div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Account Security</h3>
                <p className="text-sm text-gray-400">Review your current account session.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs text-gray-400">Signed in as</p>
                <p className="text-sm font-semibold text-gray-800 mt-1">{profile.username}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs text-gray-400">Role</p>
                <p className="text-sm font-semibold text-gray-800 mt-1 uppercase">{profile.role}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs text-gray-400">Assigned barangay</p>
                <p className="text-sm font-semibold text-gray-800 mt-1">{profile.barangay || 'Municipal account'}</p>
              </div>
              <div className="rounded-xl bg-green-50 p-4">
                <p className="text-xs text-green-700">Session status</p>
                <p className="text-sm font-semibold text-green-800 mt-1">Active</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;