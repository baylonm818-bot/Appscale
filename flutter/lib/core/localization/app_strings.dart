import '../../data/local/hive_boxes.dart';

class AppStrings {
  static final Map<String, String> _en = {
    // Navigation / Titles
    'worker_profile': 'Worker Profile',
    'settings': 'Settings',
    'dashboard': 'Dashboard',
    'children': 'Children',
    'mothers': 'Mothers',
    'records': 'Records',
    'referrals': 'Referrals',
    'reports': 'Reports',

    // Profile Page
    'active_children': 'Active Children',
    'active_mothers': 'Active Mothers',
    'edit_profile': 'Edit Profile',
    'assignment_and_station': 'Assignment & Station',
    'assigned_barangay': 'Assigned Barangay',
    'health_station': 'Health Station',
    'contact_number': 'Cell No.',
    'accreditation': 'Akreditasyon',
    'accreditation_val': 'DOH / NNC Certified BNS',
    'bns_title': 'Barangay Nutrition Scholar (BNS)',
    'unassigned': 'Unassigned',
    'not_set': 'Not set',
    'profile_saved_locally': 'Profile saved to device. Will sync to server when connected.',
    'changes_saved_offline': 'Profile changes saved locally. Will sync when online.',
    'photo_preview': 'Profile Photo Preview',
    'crop_preview': 'Crop Preview (Circular):',
    'upload_photo': 'Upload Photo',
    'photo_saved_locally': 'Photo saved to device. Will sync to server when connected.',
    'photo_uploaded_server': 'Profile photo uploaded and saved to server.',
    'photo_upload_failed': 'Upload failed. Photo is saved on device and will sync later.',

    // Settings Screen
    'settings_title': 'Settings',
    'account_and_profile': 'Account & Profile',
    'preferences': 'Preferences',
    'language': 'Language / Wika',
    'language_en': 'English',
    'language_tl': 'Tagalog (Filipino)',
    'age_format_days': 'Age Format with Days',
    'age_format_days_sub': 'Show exact days in age',
    'enabled': 'Enabled',
    'disabled': 'Disabled',
    'change_password': 'Change Password',
    'change_password_sub': 'Update your account login password',
    'app_update': 'App Update',
    'installed_version': 'Installed',
    'check_update': 'Check',
    'up_to_date': "You're up to date",
    'cannot_connect_update': 'Cannot connect to update server.',
    'system_information': 'System Information',
    'storage_mode': 'Storage Mode',
    'storage_mode_val': 'Offline-First (Encrypted device storage)',
    'sync_protocol': 'Sync Protocol',
    'sync_protocol_val': 'Web Portal / RHU Connected',
    'logout': 'Logout',
    'logout_sub': 'Sign out of your session on this device',
    'logout_confirm_title': 'Log Out',
    'logout_confirm_msg': 'Are you sure you want to log out?',
    'logout_warning_unsynced': 'You have unsynced records on this device. Logging out may cause unsynced offline records to be inaccessible until you log back in.',
    'logout_confirm_btn': 'Log Out',

    // Edit Profile Dialog
    'edit_profile_title': 'Edit Profile',
    'first_name': 'First Name',
    'last_name': 'Last Name',
    'email': 'Email Address',
    'purok': 'Purok / Address',
    'field_required': 'This field is required',
    'invalid_contact': 'Contact number must be 11 digits (e.g. 09123456789)',
    'invalid_email': 'Please enter a valid email address',
    'profile_updated_synced': 'Profile updated and synced successfully.',
    'server_sync_failed': 'Server sync failed. Saved locally and will sync later.',

    // Change Password Dialog
    'current_password': 'Current Password',
    'new_password': 'New Password',
    'confirm_password': 'Confirm New Password',
    'password_min_length': 'Password must be at least 8 characters',
    'passwords_dont_match': 'Passwords do not match',
    'password_changed_success': 'Password changed successfully.',
    'password_update_queued': 'Password update queued. Will sync when connected.',
    'update_password_btn': 'Update Password',

    // Common Buttons & Labels
    'save': 'Save',
    'cancel': 'Cancel',
    'confirm': 'Confirm',
    'close': 'Close',
    'back': 'Back',
    'loading': 'Loading...',
    'online': 'Online',
    'offline': 'Offline',
  };

  static final Map<String, String> _tl = {
    // Navigation / Titles
    'worker_profile': 'Worker Profile',
    'settings': 'Settings',
    'dashboard': 'Dashboard',
    'children': 'Mga Bata',
    'mothers': 'Mga Ina',
    'records': 'Mga Tala',
    'referrals': 'Referrals',
    'reports': 'Ulat',

    // Profile Page
    'active_children': 'Mga Bata',
    'active_mothers': 'Mga Ina',
    'edit_profile': 'I-edit ang Profile',
    'assignment_and_station': 'Tungkulin at Sentro',
    'assigned_barangay': 'Barangay',
    'health_station': 'Health Station',
    'contact_number': 'Cell No.',
    'accreditation': 'Akreditasyon',
    'accreditation_val': 'DOH / NNC BNS',
    'bns_title': 'Barangay Nutrition Scholar',
    'unassigned': 'Walang Nakatalaga',
    'not_set': 'Wala pa',
    'profile_saved_locally': 'Nai-save sa cellphone. Mag-si-sync kapag online.',
    'changes_saved_offline': 'Nai-save sa cellphone. Mag-si-sync kapag online.',
    'photo_preview': 'Preview ng Litrato',
    'crop_preview': 'Gupit na Litrato:',
    'upload_photo': 'I-upload',
    'photo_saved_locally': 'Nai-save sa cellphone. Mag-si-sync kapag online.',
    'photo_uploaded_server': 'Nai-upload ang litrato sa server.',
    'photo_upload_failed': 'Pumalya ang upload. Nai-save muna sa cellphone.',

    // Settings Screen
    'settings_title': 'Settings',
    'account_and_profile': 'Account at Profile',
    'preferences': 'Kagustuhan',
    'language': 'Wika',
    'language_en': 'English',
    'language_tl': 'Tagalog',
    'age_format_days': 'May Bilang ng Araw',
    'age_format_days_sub': 'Isama ang araw sa edad',
    'enabled': 'Naka-on',
    'disabled': 'Naka-off',
    'change_password': 'Palitan ang Password',
    'change_password_sub': 'Baguhin ang password sa pag-login',
    'app_update': 'App Update',
    'installed_version': 'Naka-install',
    'check_update': 'Tingnan',
    'up_to_date': 'Pinakabagong bersyon',
    'cannot_connect_update': 'Hindi makakonekta sa update server.',
    'system_information': 'Impormasyon ng Sistema',
    'storage_mode': 'Modo ng Pag-save',
    'storage_mode_val': 'Offline-First (Naka-encrypt sa cellphone)',
    'sync_protocol': 'Sync Protocol',
    'sync_protocol_val': 'RHU Web Portal Konektado',
    'logout': 'Mag-logout',
    'logout_sub': 'Lumabas sa account sa cellphone',
    'logout_confirm_title': 'Mag-logout',
    'logout_confirm_msg': 'Sigurado ka bang nais mong mag-logout?',
    'logout_warning_unsynced': 'May mga tala kang hindi pa nai-sync. Baka hindi ito mabasa hanggang sa mag-login muli.',
    'logout_confirm_btn': 'Mag-logout',

    // Edit Profile Dialog
    'edit_profile_title': 'I-edit ang Profile',
    'first_name': 'Pangalan',
    'last_name': 'Apelyido',
    'email': 'Email',
    'purok': 'Purok',
    'field_required': 'Kailangan ito',
    'invalid_contact': 'Dapat 11 digits (hal. 09123456789)',
    'invalid_email': 'Maling format ng email',
    'profile_updated_synced': 'Na-update at na-sync ang profile.',
    'server_sync_failed': 'Pumalya ang sync. Nai-save muna sa cellphone.',

    // Change Password Dialog
    'current_password': 'Kasalukuyang Password',
    'new_password': 'Bagong Password',
    'confirm_password': 'Ulitin ang Bagong Password',
    'password_min_length': 'Di-bababa sa 8 karakter',
    'passwords_dont_match': 'Hindi tugma ang mga password',
    'password_changed_success': 'Napalitan na ang password.',
    'password_update_queued': 'Naka-pila. Mag-si-sync kapag online.',
    'update_password_btn': 'I-save ang Password',

    // Common Buttons & Labels
    'save': 'I-save',
    'cancel': 'Kanselahin',
    'confirm': 'Kumpirmahin',
    'close': 'Isara',
    'back': 'Bumalik',
    'loading': 'Naglo-load...',
    'online': 'Online',
    'offline': 'Offline',
  };

  /// Returns translated string for [key] based on currently active language.
  static String t(String key) {
    final lang = SettingsRepository().language;
    if (lang == 'tl') {
      return _tl[key] ?? _en[key] ?? key;
    }
    return _en[key] ?? key;
  }

  /// Check if active language is Tagalog
  static bool get isTagalog => SettingsRepository().language == 'tl';
}
