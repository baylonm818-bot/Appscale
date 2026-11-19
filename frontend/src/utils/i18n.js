/**
 * i18n.js — Tagalog / English translations and age formatting helpers
 */

export const translations = {
  en: {
    // Navigation & Common
    dashboard: 'Dashboard',
    userManagement: 'User Management',
    masterlist: 'Master List',
    schedule: 'Schedule',
    calendarOfActivities: 'Calendar of Activities',
    purokManagement: 'Purok Management',
    systemLogs: 'System Logs',
    signatories: 'Signatories',
    settings: 'Settings',
    profile: 'Profile',
    medicalRecords: 'Medical Records',
    needAttention: 'Need Attention',
    referrals: 'Referrals',
    notifications: 'Notifications',
    logout: 'Log Out',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    active: 'Active',
    inactive: 'Inactive',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    allBarangays: 'All Barangays',
    barangay: 'Barangay',
    purok: 'Purok',

    // Language & Display Settings
    languageSettings: 'Language & Display Settings',
    systemLanguage: 'System Language',
    english: 'English',
    tagalog: 'Tagalog (Filipino)',
    ageFormat: 'Age Display Format',
    ageWithDays: 'Include days in age (e.g. 3 months and 4 days)',
    ageMonthsOnly: 'Months only (default, e.g. 3 months)',

    // Nutrition & Status
    normal: 'Normal',
    underweight: 'Underweight',
    severelyUnderweight: 'Severely Underweight',
    stunted: 'Stunted',
    severelyStunted: 'Severely Stunted',
    wasted: 'Wasted',
    severelyWasted: 'Severely Wasted',
    overweight: 'Overweight',
    obese: 'Obese',
    mam: 'MAM',
    sam: 'SAM',

    // Dashboard & Feeding
    feedingOverview: 'Feeding Program Overview',
    enrolledInFeeding: 'Enrolled in Feeding',
    reachedNormalInFeeding: 'Reached Normal (Within Schedule)',
    achievedNormalInBarangay: 'Reached Normal (In Barangay)',
    underIntervention: 'Under Intervention',
    feedingLogs: 'Feeding Logs',
    nutritionalStatusByYear: 'Nutritional Status by Year',
    activitiesReport: 'Activities Report',

    // Forms
    fullName: 'Full Name',
    firstName: 'First Name',
    lastName: 'Last Name',
    middleInitial: 'Middle Initial',
    birthDate: 'Date of Birth',
    contactNumber: 'Contact Number',
    guardianName: 'Guardian Name',
    venue: 'Venue',
    activityTitle: 'Activity Title',
    activityType: 'Activity Type',
    date: 'Date',
    time: 'Time',
    remarks: 'Remarks',
    disability: 'Disability',
  },
  tl: {
    // Navigation & Common
    dashboard: 'Talaan ng Impormasyon',
    userManagement: 'Pamamahala ng Gumagamit',
    masterlist: 'Pangunahing Listahan',
    schedule: 'Iskedyul',
    calendarOfActivities: 'Kalendaryo ng mga Aktibidad',
    purokManagement: 'Pamamahala ng Purok',
    systemLogs: 'Ulat ng Sistema',
    signatories: 'Mga Lalagda sa Ulat',
    settings: 'Mga Setting',
    profile: 'Profile',
    medicalRecords: 'Medikal na Rekord',
    needAttention: 'Nangangailangan ng Pansin',
    referrals: 'Mga Referral',
    notifications: 'Mga Abiso',
    logout: 'Mag-logout',
    save: 'I-save',
    cancel: 'Kanselahin',
    edit: 'I-edit',
    delete: 'Tanggalin',
    active: 'Aktibo',
    inactive: 'Hindi Aktibo',
    search: 'Maghanap',
    filter: 'Salain',
    export: 'I-export',
    allBarangays: 'Lahat ng Barangay',
    barangay: 'Barangay',
    purok: 'Purok',

    // Language & Display Settings
    languageSettings: 'Mga Setting ng Wika at Anyo',
    systemLanguage: 'Wika ng Sistema',
    english: 'Ingles (English)',
    tagalog: 'Tagalog (Filipino)',
    ageFormat: 'Anyo ng Edad',
    ageWithDays: 'Isama ang mga araw sa edad (hal. 3 buwan at 4 araw)',
    ageMonthsOnly: 'Mga buwan lamang (hal. 3 buwan)',

    // Nutrition & Status
    normal: 'Normal',
    underweight: 'Kulang sa Timbang',
    severelyUnderweight: 'Labis na Kulang sa Timbang',
    stunted: 'Pandak',
    severelyStunted: 'Labis na Pandak',
    wasted: 'Payat',
    severelyWasted: 'Labis na Payat',
    overweight: 'Sobra sa Timbang',
    obese: 'Labis ang Katabaan',
    mam: 'MAM (Katamtamang Malnutrisyon)',
    sam: 'SAM (Malubhang Malnutrisyon)',

    // Dashboard & Feeding
    feedingOverview: 'Pangkalahatang-ideya ng Programa sa Pagpapakain',
    enrolledInFeeding: 'Naka-enroll sa Pagpapakain',
    reachedNormalInFeeding: 'Naging Normal (Sa Loob ng Iskedyul)',
    achievedNormalInBarangay: 'Naging Normal (Sa Buong Barangay)',
    underIntervention: 'Sumasailalim sa Interbensyon',
    feedingLogs: 'Tala ng Pagpapakain',
    nutritionalStatusByYear: 'Katayuan sa Nutrisyon Bawat Taon',
    activitiesReport: 'Ulat ng mga Aktibidad',

    // Forms
    fullName: 'Buong Pangalan',
    firstName: 'Pangalan',
    lastName: 'Apelyido',
    middleInitial: 'Gitnang Inisyal',
    birthDate: 'Araw ng Kapanganakan',
    contactNumber: 'Numero ng Telepono',
    guardianName: 'Pangalan ng Tagapag-alaga',
    venue: 'Lugar / Venue',
    activityTitle: 'Pamagat ng Aktibidad',
    activityType: 'Uri ng Aktibidad',
    date: 'Petsa',
    time: 'Oras',
    remarks: 'Puna / Remarks',
    disability: 'Kapansanan',
  },
};

/**
 * Returns translated string according to current language
 */
export function t(key, lang = 'en') {
  const currentLang = (lang === 'tl' || lang === 'tagalog') ? 'tl' : 'en';
  return translations[currentLang]?.[key] || translations.en[key] || key;
}

/**
 * Auto-capitalizes first letter of every word (including after spaces)
 */
export function capitalizeWords(str) {
  if (!str) return '';
  return String(str).replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
}

/**
 * Format child age.
 * @param {string|Date} birthDate - birth date string or Date object
 * @param {boolean} showDays - whether to include days (default false)
 * @param {number} fallbackMonths - fallback age in months if birthDate is unavailable
 * @param {string} lang - 'en' or 'tl'
 */
export function formatChildAge(birthDate, showDays = false, fallbackMonths = 0, lang = 'en') {
  const isTl = lang === 'tl';
  if (!birthDate) {
    const mos = fallbackMonths || 0;
    if (isTl) return `${mos} ${mos === 1 ? 'buwan' : 'buwan'}`;
    return `${mos} ${mos === 1 ? 'month' : 'months'}`;
  }

  const b = new Date(birthDate);
  if (isNaN(b.getTime())) {
    const mos = fallbackMonths || 0;
    return isTl ? `${mos} buwan` : `${mos} months`;
  }

  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  let months = now.getMonth() - b.getMonth();
  let days = now.getDate() - b.getDate();

  if (days < 0) {
    months--;
    // Days in previous month
    const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += prevMonthDays;
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const totalMonths = years * 12 + months;

  if (showDays) {
    if (isTl) {
      if (days > 0) {
        return `${totalMonths} buwan at ${days} ${days === 1 ? 'araw' : 'araw'}`;
      }
      return `${totalMonths} buwan`;
    }
    if (days > 0) {
      return `${totalMonths} ${totalMonths === 1 ? 'month' : 'months'} and ${days} ${days === 1 ? 'day' : 'days'}`;
    }
    return `${totalMonths} ${totalMonths === 1 ? 'month' : 'months'}`;
  }

  return isTl ? `${totalMonths} buwan` : `${totalMonths} ${totalMonths === 1 ? 'month' : 'months'}`;
}

export const COMMON_DISABILITIES = [
  'None',
  'Visual Impairment / Blindness',
  'Hearing Impairment / Deafness',
  'Speech and Language Impairment',
  'Physical / Mobility Impairment',
  'Intellectual Disability',
  'Autism Spectrum Disorder',
  'Developmental Delay',
  'Learning Disability',
  'Multiple Disabilities',
  'Other',
];
