const settings = {
  // ── SettingsScreen ────────────────────────────────────────────────────────
  title: 'Settings',
  language: 'Language',
  languageDesc: 'Choose your preferred app language',
  appPreferences: 'App Preferences',
  offlineSync: 'Offline Sync',
  offlineSyncDesc: 'Cache data for offline usage',
  notifications: 'Notifications',
  pushNotifications: 'Push Notifications',
  pushNotificationsDesc: 'Alerts for water quality & feeding',
  emailSummaries: 'Email Summaries',
  emailSummariesDesc: 'Weekly performance reports (coming soon)',
  security: 'Security',
  twoFactor: 'Two-Factor Authentication',
  about: 'About Neerani',
  privacyPolicy: 'Privacy Policy',
  termsOfService: 'Terms of Service',

  // ── ProfileScreen ─────────────────────────────────────────────────────────
  profile: 'Profile',
  editProfile: 'Edit Profile',
  linkTruecaller: 'Link your phone (Truecaller)',
  linkTruecallerUnavailable:
    "Truecaller isn't available. Open the Truecaller app, sign in, then try again.",
  phoneLinked: 'Phone number linked',
  phoneAlreadyLinked: 'That number is already linked to another account.',
  linkTruecallerFailed: 'Could not link your number. Please try again.',
  emailAddress: 'Email Address',
  fullName: 'Full Name',
  phoneNumber: 'Phone Number',
  memberSince: 'Member Since',
  firstNameLabel: 'First Name',
  firstNamePlaceholder: 'Enter first name',
  lastNameLabel: 'Last Name',
  lastNamePlaceholder: 'Enter last name',
  phonePlaceholder: 'Enter phone number',
  profileUpdated: 'Profile updated successfully',
  profileUpdateFailed: 'Failed to update profile',
  profileLoadError: "Couldn't Load Profile",
  profileNotSet: 'Not set',

  // ── HelpScreen ────────────────────────────────────────────────────────────
  helpAndSupport: 'Help & Support',
  helpIntroTitle: 'How can we help?',
  helpIntroText:
    "Neerani is your shrimp aquaculture management companion. Here's how to get the most out of it.",
  quickGuides: 'Quick Guides',
  contactUs: 'Contact Us',
  // Help topic titles
  helpTopicWaterTitle: 'Water Quality Monitoring',
  helpTopicWaterDesc:
    'Record pH, DO, temperature, salinity and other parameters daily. Get alerts when values are outside optimal ranges.',
  helpTopicFeedTitle: 'Feed Management',
  helpTopicFeedDesc:
    'Track feed usage, calculate daily feed amounts based on MBW, and monitor feeding efficiency (FCR).',
  helpTopicSamplingTitle: 'Sampling Records',
  helpTopicSamplingDesc:
    'Regular sampling helps estimate biomass, survival rate, and average body weight (ABW/MBW).',
  helpTopicCalculatorsTitle: 'Calculators',
  helpTopicCalculatorsDesc:
    'Use built-in calculators for FCR, feed amounts, product dosage, and free ammonia calculations.',
  helpTopicSimulationsTitle: 'Simulations',
  helpTopicSimulationsDesc:
    'Run growth simulations to predict harvest dates, expected yields, and optimize cultivation strategies.',
  helpTopicFarmTitle: 'Farm Management',
  helpTopicFarmDesc:
    'Organize ponds, manage cycles, track inventory, and view financial reports per farm.',

  // ── AboutScreen ───────────────────────────────────────────────────────────
  aboutUpcheck: 'About Neerani',
  appTagline: 'Shrimp Aquaculture Management',
  versionLabel: 'Version',
  buildInfo: 'Build {{build}}',

  // ── Over-the-air update status (UpdateStatus, shown under the version) ────
  otaEmbedded: 'Running the version built into the app',
  otaRunning: 'Update from {{date}}, {{time}}',
  otaPending: 'New update ready — restart the app to use it',
  otaAvailable: 'A new update is available',
  otaChecking: 'Checking for updates…',
  otaDownloading: 'Downloading update…',
  otaDisabled: 'Updates are off in this build',
  otaLatestCheckedAt: "You're on the latest — checked at {{time}}",
  otaCheckedAt: 'Checked at {{time}}',
  otaCheckFailed: 'Could not check. Try again when you have signal.',
  otaCheck: 'Check for updates',
  otaDownload: 'Download update',
  otaRestart: 'Restart now',
  otaUpdateId: 'Update {{id}}',

  descriptionLabel: 'Description',
  descriptionText:
    'Neerani is a comprehensive shrimp aquaculture management application designed to help farmers monitor water quality, manage feed, track growth, and optimize cultivation practices.',
  featuresLabel: 'Features',
  featureMultiFarm: 'Multi-farm management',
  featurePondMonitoring: 'Pond monitoring & logs',
  featureWaterQuality: 'Water quality tracking',
  featureFeedManagement: 'Feed management',
  featureGrowthSimulations: 'Growth simulations',
  featureFinancialReports: 'Financial reports',
  developedByLabel: 'Developed By',
  developedByTeam: 'Neerani Team',
  developedByLocation: 'India',
  footerCopyright: '© 2026 Neerani. All rights reserved.',

  // ── TwoFactorScreen ───────────────────────────────────────────────────────
  twoFactorTitle: 'Two-Factor Authentication',
  twoFactorEnabled: 'Enabled',
  twoFactorNotEnabled: 'Not enabled',
  twoFactorSetup: 'Set up 2FA',
  twoFactorScanHelp:
    'Scan this QR code with an authenticator app (Google Authenticator, Authy…), then enter the generated code to finish.',
  twoFactorManualKey: 'Manual key: {{secret}}',
  twoFactorCodeLabel: 'Code from app',
  twoFactorVerifyEnable: 'Verify & enable',
  twoFactorDisableHelp: 'Enter a current code to turn off two-factor authentication.',
  twoFactorAuthCodeLabel: 'Authenticator code',
  twoFactorDisable: 'Disable 2FA',
  twoFactorInvalidCode: 'Enter the 6-digit code from your authenticator app.',
  twoFactorCodeRequired: 'Enter a current 6-digit code to disable 2FA.',
  twoFactorEnabledSuccess: 'Two-factor authentication is now on.',
  twoFactorDisabledSuccess: 'Two-factor authentication is now off.',
  twoFactorSetupError: 'Could not start 2FA setup',

  // ── Backup codes (AUTH-4) ──
  twoFactorBackupTitle: 'Save your backup codes',
  twoFactorBackupHelp:
    'Store these one-time codes somewhere safe. Each works once if you lose access to your authenticator app. They will not be shown again.',
  twoFactorBackupCopy: 'Copy codes',
  twoFactorBackupAck: "I've saved them",
  twoFactorBackupCopied: 'Backup codes copied to clipboard.',
  twoFactorRegenerateHelp:
    'Generate a new set of backup codes. Your old codes will stop working.',
  twoFactorRegenerate: 'Regenerate backup codes',

  // ── NotificationsScreen ───────────────────────────────────────────────────
  notificationsTitle: 'Notifications',
  notificationsEmpty: 'All Caught Up!',
  notificationsEmptyDesc: 'You have no new notifications.',
  notificationsLoadError: "Couldn't Load Notifications",

  // ── Account deletion (Play Store requirement) ─────────────────────────────
  deleteAccount: 'Delete Account',
  deleteAccountConfirm: 'This permanently deletes your account and all your farm data. This cannot be undone. Continue?',
  deleteAccountHint: 'Permanently removes your account and all data you own.',
  deleteAccountError: 'Could not delete your account. Please try again.',
  // Strict delete-account confirmation screen
  deleteAccountTitle: 'Delete account',
  deleteAccountWarningTitle: 'This cannot be undone',
  deleteAccountWarningBody: 'Deleting your account permanently removes it and all data you own. You will be signed out immediately.',
  deleteAccountWhatTitle: 'What gets deleted',
  deleteAccountItemFarms: 'All farms you own, and their ponds and cycles',
  deleteAccountItemLogs: 'All water, feed, sampling and health records',
  deleteAccountItemFinance: 'All financial records, inventory and reports',
  deleteAccountItemTeam: 'Your team memberships on other farms',
  deleteAccountReuseNote: 'Your email will be freed — you can sign up again later as a new user.',
  deleteConfirmPrompt: 'To confirm, type the text below exactly:',
  deleteConfirmLabel: 'Confirmation',
  deleteConfirmWord: 'DELETE',
  deletePasswordLabel: 'Your password',
  deletePasswordHint: 'Enter your password to confirm it is you.',
  deleteAccountButton: 'Permanently delete my account',
  deleteAccountWrongPassword: 'Password is incorrect.',

  // Settings — artboard p6
  accountEyebrow: "{{name}} · Neerani",
  edit: "Edit",
  ownerOfFarms: "owner of {{count}} farms",
  ownerOfFarms_one: "owner of {{count}} farm",
  languageWholeApp: "The whole app changes, including what workers see.",
  signOutConfirm: "Sign out of Neerani on this device?",
  toolsSection: "Tools",
  farmSection: "Farm",

  // ── Reminder times (smart reminders) ──────────────────────────────────────
  reminderTimes: "Reminder times",
  reminderTimesDesc: "Choose when Neerani reminds you to log water quality.",
  reminderMorning: "Morning check",
  reminderAfternoon: "Afternoon check",
  reminderEvening: "Evening check",
  reminderChemistry: "Weekly chemistry check",
  reminderHourLabel: "Hour",
  reminderMinuteLabel: "Minute",
  // The armed-state readout — read back from the phone, not assumed.
  reminderStatusOn: "Reminders are on. Next: {{when}}",
  reminderStatusOff: "No reminders are set right now. Add a pond, then open Neerani once and they will be armed.",
  reminderStatusBlocked: "Neerani cannot show notifications on this phone, so reminders will not appear.",
  reminderStatusOpenSettings: "Open phone settings",
  reminderWhenToday: "today at {{time}}",
  reminderWhenTomorrow: "tomorrow at {{time}}",
  reminderWhenOn: "{{date}} at {{time}}",

  // ── Privacy: crash reports and analytics (Privacy Policy section 6) ───────
  privacySection: "Privacy",
  crashReportsToggle: "Crash reports",
  crashReportsDesc:
    "On, so we can fix faults before you have to report them. Reports carry no phone number, email, password, money figures or farm records. You can switch this off.",
  analyticsToggle: "Product analytics",
  analyticsToggleDesc:
    "Off unless you turn it on. Tells us which screens are used, so we build the right things. Your farm, money and harvest data are never sent.",
  analyticsPromptTitle: "May we see which screens you use?",
  analyticsPromptBody:
    "It helps us fix what is hard to use. We would send only the name of the screen — never your ponds, money or harvest figures. Everything in the app works the same either way.",
  analyticsPromptAllow: "Yes, that's fine",
  analyticsPromptDecline: "No thanks",
};

export default settings;
