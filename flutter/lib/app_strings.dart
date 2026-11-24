import 'package:flutter/foundation.dart';
import 'data/local/app_data_bus.dart';
import 'data/local/hive_boxes.dart';

/// Centralized localization manager for AppScale (English / Tagalog).
class L {
  L._();

  /// Observable language code: 'en' or 'tl'.
  static final ValueNotifier<String> lang = ValueNotifier<String>('en');

  /// Loads the persisted language selection from Hive before runApp.
  static Future<void> load() async {
    try {
      final code = SettingsRepository().language;
      lang.value = (code.toLowerCase() == 'tl') ? 'tl' : 'en';
    } catch (_) {
      lang.value = 'en';
    }
  }

  /// Sets the active language ('en' or 'tl'), persists to Hive, and notifies the entire app.
  static Future<void> set(String newLang) async {
    final code = (newLang.toLowerCase() == 'tl') ? 'tl' : 'en';
    if (lang.value == code) return;
    lang.value = code;
    try {
      await SettingsRepository().setLanguage(code);
    } catch (_) {}
    AppDataBus.notifyChanged();
  }

  /// Convenience getter to check if Tagalog is active.
  static bool get isTagalog => lang.value == 'tl';

  /// English strings map
  static final Map<String, String> en = {
    // ── App Update ──
    'update_title': 'App Update',
    'update_available_title': 'AppScale New Update!',
    'update_no_internet': 'No internet connection',
    'update_server_unreachable': 'Server unreachable. Please try again later.',
    'update_already_latest': "You're up to date",
    'update_available': 'Update available: v{version}',
    'update_download': 'Download Update',
    'update_checking': 'Checking for updates...',
    'update_downloading': 'Downloading update...',
    'update_preparing': 'Preparing download...',
    'update_failed': 'Download failed. Please try again later.',
    'update_install': 'Install Now',
    'update_later': 'Later',
    'update_whats_new': "What's new in this version:",
    'update_size': 'Size: {size}',
    'update_installed_version': 'Installed: v{version}',
    'update_check_btn': 'Check',

    // ── Navigation & Bottom Bar ──
    'nav_home': 'Home',
    'nav_children': 'Children',
    'nav_mothers': 'Mothers',
    'nav_program': 'Program',
    'nav_records': 'Records',
    'nav_referrals': 'Referrals',
    'nav_reports': 'Reports',
    'nav_analytics': 'Analytics',

    // ── Home / Dashboard Header ──
    'welcome': 'Welcome!',
    'bns_role_title': 'Barangay Nutrition Scholar (BNS)',
    'bns_title': 'Barangay Nutrition Scholar',
    'worker_profile': 'Worker Profile',
    'settings': 'Settings',
    'settings_title': 'Settings',

    // ── Quick Stats ──
    'stat_total_children': 'Total Children',
    'stat_active_children': 'Active Children',
    'active_children': 'Active Children',
    'stat_total_mothers': 'Total Mothers',
    'stat_active_mothers': 'Active Mothers',
    'active_mothers': 'Active Mothers',
    'rural_health_unit': 'Rural Health Unit',
    'stat_active_referrals': 'Active Referrals',
    'stat_at_risk': 'At-Risk',
    'stat_measured_this_month': 'Measured This Month',
    'quick_actions': 'Quick Actions',
    'add_child': 'Add Child',
    'add_mother': 'Add Mother',
    'record_measurement': 'Record Measurement',
    'new_referral': 'New Referral',
    'recent_activities': 'Recent Activities',
    'view_all': 'View All',
    'no_recent_activities': 'No recent activities.',

    // ── Settings Screen ──
    'account_and_profile': 'Account & Profile',
    'preferences': 'Preferences',
    'language': 'Language',
    'language_sub': 'Choose app display language',
    'language_en': 'English',
    'language_tl': 'Tagalog (Filipino)',
    'age_format_days': 'Age Format with Days',
    'age_format_days_sub': 'Show exact days in age display',
    'enabled': 'Enabled',
    'disabled': 'Disabled',
    'change_password': 'Change Password',
    'change_password_sub': 'Change your account password',
    'app': 'App',
    'app_section': 'App',
    'app_update': 'App Update',
    'installed_version': 'Installed',
    'check_update': 'Check',
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

    // ── Worker Profile Screen ──
    'assignment_and_station': 'Assignment & Station',
    'assigned_barangay': 'Assigned Barangay',
    'barangay': 'Barangay',
    'health_station': 'Health Station',
    'contact_number': 'Cell No.',
    'accreditation': 'Accreditation',
    'accreditation_val': 'DOH / NNC Certified BNS',
    'admin_only': 'Admin Only',
    'unassigned': 'Unassigned',
    'not_set': 'Not set',
    'edit_profile': 'Edit Profile',
    'edit_profile_sub': 'Update your name and contact',
    'edit_profile_title': 'Edit Profile',
    'profile_saved_locally': 'Profile saved to device. Will sync to server when connected.',
    'changes_saved_offline': 'Profile changes saved locally. Will sync when online.',
    'photo_preview': 'Profile Photo Preview',
    'crop_preview': 'Crop Preview (Circular):',
    'upload_photo': 'Upload Photo',
    'photo_saved_locally': 'Photo saved to device. Will sync to server when connected.',
    'photo_uploaded_server': 'Profile photo uploaded and saved to server.',
    'photo_upload_failed': 'Upload failed. Photo is saved on device and will sync later.',

    // ── Edit Profile Dialog ──
    'first_name': 'First Name',
    'last_name': 'Last Name',
    'email': 'Email Address',
    'purok': 'Purok / Address',
    'field_required': 'This field is required',
    'invalid_contact': 'Contact number must be 11 digits (e.g. 09123456789)',
    'invalid_email': 'Please enter a valid email address',
    'profile_updated_synced': 'Profile updated and synced successfully.',
    'server_sync_failed': 'Server sync failed. Saved locally and will sync later.',

    // ── Change Password Dialog ──
    'current_password': 'Current Password',
    'new_password': 'New Password',
    'confirm_password': 'Confirm New Password',
    'password_min_length': 'Password must be at least 8 characters',
    'passwords_dont_match': 'Passwords do not match',
    'password_changed_success': 'Password changed successfully.',
    'password_update_queued': 'Password update queued. Will sync when connected.',
    'update_password_btn': 'Update Password',

    // ── Auth & Forgot Password ──
    'login_title': 'Sign In',
    'login_sub': 'Barangay Nutrition Scholar Portal',
    'username': 'Username',
    'password': 'Password',
    'forgot_password': 'Forgot Password?',
    'login_btn': 'Sign In',
    'logging_in': 'Signing in...',
    'login_error_credentials': 'Invalid username or password.',
    'login_error_network': 'Network error. Please check your connection.',
    'forgot_pass_title': 'Forgot Password',
    'forgot_pass_desc': 'Enter your registered email to receive a 6-digit OTP code.',
    'send_code': 'Send Code',
    'otp_title': 'Enter OTP Code',
    'otp_desc': 'Enter the 6-digit verification code sent to {email}',
    'verify_code': 'Verify Code',
    'resend_code': 'Resend Code',
    'reset_pass_title': 'Set New Password',
    'save_password': 'Save Password',

    // ── Beneficiary & Records ──
    'search_child': 'Search child name or purok...',
    'search_mother': 'Search mother name or purok...',
    'filter_all': 'All',
    'filter_normal': 'Normal',
    'filter_underweight': 'Underweight',
    'filter_sam': 'Severely Wasted (SAM)',
    'filter_mam': 'Moderately Wasted (MAM)',
    'filter_stunted': 'Stunted',
    'filter_overweight': 'Overweight',
    'filter_obese': 'Obese',
    'no_children_found': 'No children records found.',
    'no_mothers_found': 'No mothers records found.',
    'child_info': 'Child Information',
    'mother_info': 'Mother Information',
    'growth_history': 'Growth History',
    'visits_history': 'Visit History',
    'add_measurement': 'Add Measurement',
    'add_visit': 'Log Visit',
    'guardian': 'Guardian / Parent',
    'birthdate': 'Date of Birth',
    'age': 'Age',
    'sex': 'Sex',
    'male': 'Male',
    'female': 'Female',
    'weight': 'Weight (kg)',
    'height': 'Height / Length (cm)',
    'muac': 'MUAC (cm)',
    'status': 'Nutritional Status',
    'deactivate_beneficiary': 'Deactivate Record',
    'confirm_deactivate': 'Are you sure you want to deactivate this record?',

    // ── Referrals & Urgent Referrals ──
    'referrals_title': 'Referrals',
    'referral_status_pending': 'Pending',
    'referral_status_ongoing': 'Ongoing',
    'referral_status_completed': 'Completed',
    'referral_reason': 'Reason for Referral',
    'target_facility': 'Target Facility',
    'create_referral': 'Create Referral',
    'urgent_referral_title': 'Urgent Referral Required',
    'urgent_referral_desc': 'This child shows severe acute malnutrition or high risk factors requiring immediate health station consultation.',

    // ── Supplementary Feeding ──
    'feeding_program': 'Supplementary Feeding',
    'attendance': 'Attendance',
    'present': 'Present',
    'absent': 'Absent',
    'beneficiaries': 'Beneficiaries',

    // ── Sync & Reports ──
    'sync_status': 'Sync Status',
    'sync_now': 'Sync Now',
    'all_synced': 'All records are synced',
    'records_pending': '{count} record(s) pending',
    'sync_in_progress': 'Syncing with server...',
    'last_sync': 'Last sync: {time}',

    // ── Common UI Buttons & Labels ──
    'save': 'Save',
    'cancel': 'Cancel',
    'confirm': 'Confirm',
    'close': 'Close',
    'back': 'Back',
    'delete': 'Delete',
    'loading': 'Loading...',
    'online': 'Online',
    'offline': 'Offline',
    'yes': 'Yes',
    'no': 'No',
    'success': 'Success',
    'error': 'Error',
    'warning': 'Warning',

    // ── Shell & Background Sync ──
    'only_bns_can_add': 'Only BNS can add beneficiaries.',
    'cloud_syncing_bg': 'Syncing data with cloud in background...',
    'cloud_sync_failed': 'Cloud sync failed. Data available offline.',
    'retry': 'Retry',
    'auto_sync_completed': 'Auto-Sync Completed',
    'synced_n_records': 'Synced {count} record(s) to server.',

    // ── Dashboard Stat Cards & Subtitles ──
    'stat_children_0_59': 'Children (0-59 mos)',
    'stat_lactating_mothers': 'Lactating Mothers',
    'stat_sam_cases': 'SAM Cases',
    'stat_feeding_program': 'Feeding Program',
    'due_for_weighing_count': '{count} due for weighing',
    'new_this_month_count': '{count} new this month',
    'all_up_to_date': 'All up to date',
    'no_new_this_month': 'No new this month',
    'sam_wasting_severe': '{sam} acute wasting · {severe} severe',
    'severe_no_acute': '{severe} severe (no acute SAM)',
    'no_active_cases': 'No active cases',
    'enrolled_count': '{count} enrolled',
    'none_enrolled': 'None enrolled',
    'nutritional_status_who': 'Nutritional Status (WHO Standards)',
    'no_measurements_recorded': 'No measurements recorded yet. This updates as children get weighed.',
    'upcoming_title': 'Upcoming',
    'no_upcoming_activities': 'No upcoming activities scheduled.',

    // ── Beneficiary Add Sheet ──
    'add_profile_prompt': 'What would you like to add?',
    'choose_profile_sub': 'Choose a profile to register',
    'register_child_sub': 'Register a new child profile',
    'register_mother_sub': 'Register a new mother profile',

    // ── Auth & Login ──
    'bns_health_monitoring': 'BNS Health Monitoring',
    'municipality_of_gasan': 'Municipality of Gasan',
    'welcome_bns': 'Welcome BNS!',
    'hint_enter_email': 'Enter email address',
    'hint_enter_password': 'Enter password',
    'remember_me': 'Remember Me',
    'login_error_empty': 'Please enter both email and password.',

    // ── Forgot Password Screen ──
    'reset_account_password': 'Reset your account password',
    'reset_password_instruction': 'Enter your registered email address to receive a 6-digit verification code.',
    'enter_email_first': 'Please enter your email and request an OTP first.',
    'verify_otp_first': 'Please verify the 6-digit OTP code first.',
    'enter_email': 'Please enter your email address.',
    'enter_full_otp': 'Please enter the full 6-digit OTP.',
    'otp_verified_prompt': 'OTP verified. Please enter your new password.',
    'complete_password_fields': 'Please complete all password fields.',
    'password_reset_success': 'Password reset successful. Please log in again.',
    'step_enter_email': 'Step 1 of 3: Enter Email',
    'step_verify_otp': 'Step 2 of 3: Verify OTP Code',
    'step_reset_password': 'Step 3 of 3: Reset Password',
    'otp_sent_to': 'We sent a 6-digit verification code to:',
    'otp_label': '6-digit OTP',
    'otp_hint': 'Enter the 6-digit code',
    'resend_code_cooldown': 'Resend Code ({seconds}s)',
    'create_new_password': 'Create New Password',
    'identity_verified': 'Your identity has been verified. Enter a new password for your account.',
    'hint_new_password': 'Enter a new password (min. 8 characters)',
    'hint_confirm_password': 'Re-enter your password',
    'incorrect_expired_code': 'Incorrect or expired code.',
    'check_your_email': 'Check your email',
    'check_your_phone': 'Check your phone',
    'send_code_via': 'Send code via',
    'no_registered_number': 'No registered number. Use email.',
    'password_changed_title': 'Successful',
    'password_changed_desc': 'Your password has been changed',
    'back_to_login': 'Back to Login',

    // ── Urgent Referral Dialog ──
    'urgent_attention_needed': 'Urgent attention may be needed',
    'create_referral_prompt': 'Create a referral for {name} now?',
    'this_suggests': 'This suggests:',
    'not_now': 'Not Now',

    // ── Deactivate / Transfer Sheet ──
    'deactivate_name': 'Deactivate {name}',
    'transfer_name': 'Transfer {name}',
    'transfer_record_desc': 'Transfer full record to another barangay.',
    'deactivate_record_desc': 'Reason and date are required for official records.',
    'select_target_barangay': 'Please select a new barangay.',
    'specify_reason': 'Please specify the reason.',
    'date_required': 'Date (Required)',
    'transfer_to_which_barangay': 'Transfer to which barangay? (Required)',
    'no_other_barangays': 'No other barangays available.',
    'also_transfer_mother': 'Also transfer the mother?',
    'also_transfer_children': 'Also transfer the children?',
    'transfer_linked_mother_sub': 'Includes linked mother record in transfer.',
    'transfer_linked_children_sub': 'Includes all linked children in transfer.',
    'specify_reason_required': 'Please specify reason (Required)',
    'specify_reason_hint': 'Enter reason',
    'transfer_btn': 'Transfer',

    // ── Masterlist ──
    'master_list_title': 'Master list',
    'children_tab': 'Children ({count})',
    'mothers_tab': 'Mothers ({count})',
    'active_count_tab': 'Active ({count})',
    'inactive_count_tab': 'Inactive ({count})',
    'search_children': 'Search children...',
    'search_mothers': 'Search mothers...',
    'children_completed_monitoring': 'Children who completed monitoring',
    'mothers_stopped_breastfeeding': 'Mothers who stopped breastfeeding',
    'sort_by': 'Sort by',
    'advanced_filters': 'Advanced Filters',
    'sort_severity': 'Severity',
    'sort_severity_sub': 'Severe, At risk, Overweight/Obese, Normal',
    'sort_name': 'Name (A to Z)',
    'sort_name_sub': 'Alphabetical order',
    'sort_age': 'Age',
    'sort_age_children_sub': 'Youngest first',
    'sort_age_mothers_sub': "Mother's age",
    'sort_purok': 'Purok / Address',
    'sort_purok_sub': 'By purok or address',

    // ── Shared Widgets ──
    'required_field': 'Required field',
  };

  /// Tagalog strings map (Compact, short wording so it never overflows)
  static final Map<String, String> tl = {
    // ── App Update ──
    'update_title': 'App Update',
    'update_available_title': 'AppScale Bagong Update!',
    'update_no_internet': 'Walang internet',
    'update_server_unreachable': 'Hindi makakonekta sa server para mag-check ng update.',
    'update_already_latest': 'Nasa pinakabagong bersyon ka na',
    'update_available': 'May update: v{version}',
    'update_download': 'I-download ang Update',
    'update_checking': 'Sinusuri ang update...',
    'update_downloading': 'Dina-download ang update...',
    'update_preparing': 'Inihahanda ang pag-download...',
    'update_failed': 'Pumalya ang download. Subukan muli.',
    'update_install': 'I-install Ngayon',
    'update_later': 'Mamaya',
    'update_whats_new': 'Mga bago sa bersyong ito:',
    'update_size': 'Laki: {size}',
    'update_installed_version': 'Naka-install: v{version}',
    'update_check_btn': 'Tingnan',

    // ── Navigation & Bottom Bar ──
    'nav_home': 'Home',
    'nav_children': 'Bata',
    'nav_mothers': 'Ina',
    'nav_program': 'Programa',
    'nav_records': 'Talaan',
    'nav_referrals': 'Referrals',
    'nav_reports': 'Ulat',
    'nav_analytics': 'Analytics',

    // ── Home / Dashboard Header ──
    'welcome': 'Welcome!',
    'bns_role_title': 'Iskolar sa Nutrisyon ng Barangay (BNS)',
    'bns_title': 'Iskolar sa Nutrisyon ng Barangay',
    'worker_profile': 'Profile ng BNS',
    'settings': 'Settings',
    'settings_title': 'Settings',

    // ── Quick Stats ──
    'stat_total_children': 'Kabuuang Bata',
    'stat_active_children': 'Mga Bata',
    'active_children': 'Mga Bata',
    'stat_total_mothers': 'Kabuuang Ina',
    'stat_active_mothers': 'Mga Ina',
    'active_mothers': 'Mga Ina',
    'rural_health_unit': 'Sentro ng Kalusugan (RHU)',
    'stat_active_referrals': 'Aktibong Referral',
    'stat_at_risk': 'Nanganganib',
    'stat_measured_this_month': 'Nasuri Ngayong Buwan',
    'quick_actions': 'Mabilisang Aksyon',
    'add_child': 'Magdagdag ng Bata',
    'add_mother': 'Magdagdag ng Ina',
    'record_measurement': 'Magtala ng Sukat',
    'new_referral': 'Bagong Referral',
    'recent_activities': 'Kamakailang Gawain',
    'view_all': 'Tingnan Lahat',
    'no_recent_activities': 'Walang kamakailang tala.',

    // ── Settings Screen ──
    'account_and_profile': 'Account at Profile',
    'preferences': 'Kagustuhan',
    'language': 'Wika',
    'language_sub': 'Pumili ng wika ng app',
    'language_en': 'English',
    'language_tl': 'Tagalog',
    'age_format_days': 'May Bilang ng Araw',
    'age_format_days_sub': 'Isama ang araw sa edad',
    'enabled': 'Naka-on',
    'disabled': 'Naka-off',
    'change_password': 'Palitan ang Password',
    'change_password_sub': 'Baguhin ang password sa pag-login',
    'app': 'App',
    'app_section': 'App',
    'app_update': 'Update ng App',
    'installed_version': 'Naka-install',
    'check_update': 'Tingnan',
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

    // ── Worker Profile Screen ──
    'assignment_and_station': 'Tungkulin at Sentro',
    'assigned_barangay': 'Barangay',
    'barangay': 'Barangay',
    'health_station': 'Sentro ng Kalusugan',
    'contact_number': 'Cell No.',
    'accreditation': 'Akreditasyon',
    'accreditation_val': 'DOH / NNC Sertipikadong BNS',
    'admin_only': 'Admin Lamang',
    'unassigned': 'Walang Nakatalaga',
    'not_set': 'Wala pa',
    'edit_profile': 'I-edit ang Profile',
    'edit_profile_sub': 'I-update ang pangalan at detalye',
    'edit_profile_title': 'I-edit ang Profile',
    'profile_saved_locally': 'Nai-save sa cellphone. Mag-si-sync kapag online.',
    'changes_saved_offline': 'Nai-save sa cellphone. Mag-si-sync kapag online.',
    'photo_preview': 'Preview ng Litrato',
    'crop_preview': 'Gupit na Litrato:',
    'upload_photo': 'I-upload',
    'photo_saved_locally': 'Nai-save sa cellphone. Mag-si-sync kapag online.',
    'photo_uploaded_server': 'Nai-upload ang litrato sa server.',
    'photo_upload_failed': 'Pumalya ang upload. Nai-save muna sa cellphone.',

    // ── Edit Profile Dialog ──
    'first_name': 'Pangalan',
    'last_name': 'Apelyido',
    'email': 'Email',
    'purok': 'Purok',
    'field_required': 'Kailangan ito',
    'invalid_contact': 'Dapat 11 digits (hal. 09123456789)',
    'invalid_email': 'Maling format ng email',
    'profile_updated_synced': 'Na-update at na-sync ang profile.',
    'server_sync_failed': 'Pumalya ang sync. Nai-save muna sa cellphone.',

    // ── Change Password Dialog ──
    'current_password': 'Kasalukuyang Password',
    'new_password': 'Bagong Password',
    'confirm_password': 'Ulitin ang Bagong Password',
    'password_min_length': 'Di-bababa sa 8 karakter',
    'passwords_dont_match': 'Hindi tugma ang mga password',
    'password_changed_success': 'Napalitan na ang password.',
    'password_update_queued': 'Naka-pila. Mag-si-sync kapag online.',
    'update_password_btn': 'I-save ang Password',

    // ── Auth & Forgot Password ──
    'login_title': 'Pumasok',
    'login_sub': 'Portal ng Iskolar sa Nutrisyon',
    'username': 'Username',
    'password': 'Password',
    'forgot_password': 'Nakalimutan ang Password?',
    'login_btn': 'Pumasok',
    'logging_in': 'Pumapasok...',
    'login_error_credentials': 'Maling username o password.',
    'login_error_network': 'May problema sa koneksyon.',
    'forgot_pass_title': 'Nakalimutang Password',
    'forgot_pass_desc': 'Ilagay ang iyong email para makatanggap ng 6-digit OTP code.',
    'send_code': 'Ipadala ang Code',
    'otp_title': 'Ilagay ang OTP Code',
    'otp_desc': 'Ilagay ang 6-digit code na ipinadala sa {email}',
    'verify_code': 'Kumpirmahin',
    'resend_code': 'Ipadala Muli',
    'reset_pass_title': 'Bagong Password',
    'save_password': 'I-save ang Password',

    // ── Beneficiary & Records ──
    'search_child': 'Maghanap ng bata o purok...',
    'search_mother': 'Maghanap ng ina o purok...',
    'filter_all': 'Lahat',
    'filter_normal': 'Normal',
    'filter_underweight': 'Underweight',
    'filter_sam': 'SAM (Malubha)',
    'filter_mam': 'MAM (Katamtaman)',
    'filter_stunted': 'Stunted (Mababa)',
    'filter_overweight': 'Overweight',
    'filter_obese': 'Obese',
    'no_children_found': 'Walang nahanap na bata.',
    'no_mothers_found': 'Walang nahanap na ina.',
    'child_info': 'Tala ng Bata',
    'mother_info': 'Tala ng Ina',
    'growth_history': 'Kasaysayan ng Sukat',
    'visits_history': 'Kasaysayan ng Bisita',
    'add_measurement': 'Magtala ng Sukat',
    'add_visit': 'Magtala ng Bisita',
    'guardian': 'Magulang o Tagapag-alaga',
    'birthdate': 'Kapanganakan',
    'age': 'Edad',
    'sex': 'Kasarian',
    'male': 'Lalaki',
    'female': 'Babae',
    'weight': 'Timbang (kg)',
    'height': 'Haba / Taas (cm)',
    'muac': 'MUAC (cm)',
    'status': 'Kalagayan sa Nutrisyon',
    'deactivate_beneficiary': 'I-deactivate ang Tala',
    'confirm_deactivate': 'Sigurado ka bang nais mong i-deactivate ito?',

    // ── Referrals & Urgent Referrals ──
    'referrals_title': 'Referrals',
    'referral_status_pending': 'Pending',
    'referral_status_ongoing': 'Kasalukuyan',
    'referral_status_completed': 'Tapos na',
    'referral_reason': 'Dahilan ng Referral',
    'target_facility': 'Pasilidad',
    'create_referral': 'Gumawa ng Referral',
    'urgent_referral_title': 'Kailangan ng Agarang Referral',
    'urgent_referral_desc': 'Ang batang ito ay may matinding kakulangan sa nutrisyon na nangangailangan ng agarang lunas sa health center.',

    // ── Supplementary Feeding ──
    'feeding_program': 'Feeding Program',
    'attendance': 'Pagdalo',
    'present': 'Narito',
    'absent': 'Liban',
    'beneficiaries': 'Mga Benepisyaryo',

    // ── Sync & Reports ──
    'sync_status': 'Katayuan ng Sync',
    'sync_now': 'I-sync Ngayon',
    'all_synced': 'Lahat ay naka-sync',
    'records_pending': '{count} tala ang nakapila',
    'sync_in_progress': 'Kasalukuyang nag-si-sync...',
    'last_sync': 'Huling sync: {time}',

    // ── Common UI Buttons & Labels ──
    'save': 'I-save',
    'cancel': 'Kanselahin',
    'confirm': 'Kumpirmahin',
    'close': 'Isara',
    'back': 'Bumalik',
    'delete': 'Burahin',
    'loading': 'Naglo-load...',
    'online': 'Online',
    'offline': 'Offline',
    'yes': 'Oo',
    'no': 'Hindi',
    'success': 'Tagumpay',
    'error': 'May Error',
    'warning': 'Babala',

    // ── Shell & Background Sync ──
    'only_bns_can_add': 'BNS lamang ang maaaring magdagdag.',
    'cloud_syncing_bg': 'Nag-si-sync sa cloud...',
    'cloud_sync_failed': 'Pumalya ang sync. May kopya sa cellphone.',
    'retry': 'Ulitin',
    'auto_sync_completed': 'Tapos na ang Auto-Sync',
    'synced_n_records': 'Nai-sync ang {count} tala sa server.',

    // ── Dashboard Stat Cards & Subtitles ──
    'stat_children_0_59': 'Mga Bata (0-59 buwan)',
    'stat_lactating_mothers': 'Mga Nagpapasusong Ina',
    'stat_sam_cases': 'Kaso ng SAM',
    'stat_feeding_program': 'Feeding Program',
    'due_for_weighing_count': '{count} dapat timbangin',
    'new_this_month_count': '{count} bago ngayong buwan',
    'all_up_to_date': 'Lahat ay nasuri',
    'no_new_this_month': 'Walang bago ngayong buwan',
    'sam_wasting_severe': '{sam} malubha · {severe} severe',
    'severe_no_acute': '{severe} severe (walang SAM)',
    'no_active_cases': 'Walang aktibong kaso',
    'enrolled_count': '{count} nakatala',
    'none_enrolled': 'Walang nakatala',
    'nutritional_status_who': 'Katayuan sa Nutrisyon (WHO)',
    'no_measurements_recorded': 'Wala pang sukat. Mag-uupdate ito kapag may tinimbang.',
    'upcoming_title': 'Paparating',
    'no_upcoming_activities': 'Walang nakatakdang gawain.',

    // ── Beneficiary Add Sheet ──
    'add_profile_prompt': 'Ano ang nais mong idagdag?',
    'choose_profile_sub': 'Pumili ng irerehistro',
    'register_child_sub': 'Magrehistro ng bata',
    'register_mother_sub': 'Magrehistro ng ina',

    // ── Auth & Login ──
    'bns_health_monitoring': 'BNS Health Monitoring',
    'municipality_of_gasan': 'Bayan ng Gasan',
    'welcome_bns': 'Maligayang Pagdating BNS!',
    'hint_enter_email': 'Ilagay ang email',
    'hint_enter_password': 'Ilagay ang password',
    'remember_me': 'Tandaan Ako',
    'login_error_empty': 'Ilagay ang email at password.',

    // ── Forgot Password Screen ──
    'reset_account_password': 'Baguhin ang password',
    'reset_password_instruction': 'Ilagay ang email para makatanggap ng 6-digit code.',
    'enter_email_first': 'Ilagay muna ang email at humingi ng OTP.',
    'verify_otp_first': 'Kumpirmahin muna ang 6-digit OTP code.',
    'enter_email': 'Ilagay ang iyong email address.',
    'enter_full_otp': 'Ilagay ang buong 6-digit OTP.',
    'otp_verified_prompt': 'Kumpirmado na ang OTP. Ilagay ang bagong password.',
    'complete_password_fields': 'Punan ang lahat ng patlang ng password.',
    'password_reset_success': 'Nabago na ang password. Mag-login muli.',
    'step_enter_email': 'Hakbang 1 ng 3: Ilagay ang Email',
    'step_verify_otp': 'Hakbang 2 ng 3: Kumpirmahin ang OTP',
    'step_reset_password': 'Hakbang 3 ng 3: Bagong Password',
    'otp_sent_to': 'Ipinadala ang 6-digit code sa:',
    'otp_label': '6-digit OTP',
    'otp_hint': 'Ilagay ang 6-digit code',
    'resend_code_cooldown': 'Ipadala Muli ({seconds}s)',
    'create_new_password': 'Bagong Password',
    'identity_verified': 'Kumpirmado ang pagkakakilanlan. Ilagay ang bagong password.',
    'hint_new_password': 'Bagong password (di-bababa sa 8 karakter)',
    'hint_confirm_password': 'Ulitin ang password',
    'incorrect_expired_code': 'Mali o expired na ang code.',
    'check_your_email': 'Tingnan ang iyong email',
    'check_your_phone': 'Tingnan ang iyong telepono',
    'send_code_via': 'Ipadala ang code sa',
    'no_registered_number': 'Walang nakarehistrong numero. Gamitin ang email.',
    'password_changed_title': 'Matagumpay',
    'password_changed_desc': 'Napalitan na ang iyong password',
    'back_to_login': 'Bumalik sa Login',

    // ── Urgent Referral Dialog ──
    'urgent_attention_needed': 'Kailangan ng agarang pansin',
    'create_referral_prompt': 'Gumawa ng referral para kay {name} ngayon?',
    'this_suggests': 'Ipinapahiwatig nito:',
    'not_now': 'Mamaya',

    // ── Deactivate / Transfer Sheet ──
    'deactivate_name': 'I-deactivate si {name}',
    'transfer_name': 'Ilipat si {name}',
    'transfer_record_desc': 'Ililipat ang tala sa bagong barangay.',
    'deactivate_record_desc': 'Kailangan ang dahilan at petsa sa talaan.',
    'select_target_barangay': 'Pumili ng bagong barangay.',
    'specify_reason': 'Mangyaring ilagay ang dahilan.',
    'date_required': 'Petsa (Kailangan)',
    'transfer_to_which_barangay': 'Ilipat sa anong barangay? (Kailangan)',
    'no_other_barangays': 'Walang ibang barangay na magagamit.',
    'also_transfer_mother': 'Ilipat din ba ang ina?',
    'also_transfer_children': 'Ilipat din ba ang mga anak?',
    'transfer_linked_mother_sub': 'Isasama ang nakalink na record ng ina.',
    'transfer_linked_children_sub': 'Isasama ang mga nakalink na anak.',
    'specify_reason_required': 'Ilagay ang dahilan (Kailangan)',
    'specify_reason_hint': 'Ilagay ang dahilan',
    'transfer_btn': 'Ilipat',

    // ── Masterlist ──
    'master_list_title': 'Master list',
    'children_tab': 'Mga Bata ({count})',
    'mothers_tab': 'Mga Ina ({count})',
    'active_count_tab': 'Aktibo ({count})',
    'inactive_count_tab': 'Di-aktibo ({count})',
    'search_children': 'Maghanap ng bata...',
    'search_mothers': 'Maghanap ng ina...',
    'children_completed_monitoring': 'Mga batang nakatapos ng monitoring',
    'mothers_stopped_breastfeeding': 'Mga inang huminto sa pagpapasuso',
    'sort_by': 'Ayusin ayon sa',
    'advanced_filters': 'Mga Filter',
    'sort_severity': 'Kalubhaan',
    'sort_severity_sub': 'Severe, At risk, Overweight/Obese, Normal',
    'sort_name': 'Pangalan (A hanggang Z)',
    'sort_name_sub': 'Naka-alpabeto',
    'sort_age': 'Edad',
    'sort_age_children_sub': 'Pinakabata muna',
    'sort_age_mothers_sub': 'Edad ng ina',
    'sort_purok': 'Purok / Tirahan',
    'sort_purok_sub': 'Ayon sa purok o tirahan',

    // ── Shared Widgets ──
    'required_field': 'Kailangang patlang',
  };
}

/// String extension for one-line translation: `'key'.tr` or `'key'.trArgs({'param': value})`.
extension StringTranslate on String {
  String get tr {
    final current = L.lang.value;
    if (current == 'tl') {
      return L.tl[this] ?? L.en[this] ?? this;
    }
    return L.en[this] ?? this;
  }

  String trArgs(Map<String, String> args) {
    String res = tr;
    args.forEach((k, v) {
      res = res.replaceAll('{$k}', v);
    });
    return res;
  }
}

/// Backwards compatibility wrapper for AppStrings.t('key').
class AppStrings {
  static String t(String key) => key.tr;
  static bool get isTagalog => L.isTagalog;
}
