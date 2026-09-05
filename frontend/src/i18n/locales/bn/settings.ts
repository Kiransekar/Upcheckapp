const settings = {
  // ── SettingsScreen ────────────────────────────────────────────────────────
  title: 'সেটিংস',
  language: 'ভাষা',
  languageDesc: 'আপনার পছন্দের অ্যাপের ভাষা বেছে নিন',
  appPreferences: 'অ্যাপের পছন্দ',
  offlineSync: 'অফলাইন সিঙ্ক',
  offlineSyncDesc: 'অফলাইন ব্যবহারের জন্য ডেটা ক্যাশ করুন',
  notifications: 'বিজ্ঞপ্তি',
  pushNotifications: 'পুশ বিজ্ঞপ্তি',
  pushNotificationsDesc: 'পানির মান ও খাওয়ানোর সতর্কতা',
  emailSummaries: 'ইমেইল সারসংক্ষেপ',
  emailSummariesDesc: 'সাপ্তাহিক কার্যকারিতার প্রতিবেদন',
  security: 'নিরাপত্তা',
  twoFactor: 'দ্বি-স্তরীয় প্রমাণীকরণ',
  about: 'Neerani সম্পর্কে',
  privacyPolicy: 'গোপনীয়তা নীতি',
  termsOfService: 'সেবার শর্তাবলী',

  // ── ProfileScreen ─────────────────────────────────────────────────────────
  profile: 'প্রোফাইল',
  editProfile: 'প্রোফাইল সম্পাদনা',
  linkTruecaller: 'আপনার ফোন যুক্ত করুন (Truecaller)',
  linkTruecallerUnavailable:
    'Truecaller উপলব্ধ নয়। Truecaller অ্যাপ খুলুন, সাইন ইন করুন, তারপর আবার চেষ্টা করুন।',
  phoneLinked: 'ফোন নম্বর যুক্ত হয়েছে',
  phoneAlreadyLinked: 'সেই নম্বরটি ইতিমধ্যে অন্য একটি অ্যাকাউন্টের সাথে যুক্ত।',
  linkTruecallerFailed: 'আপনার নম্বর যুক্ত করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
  emailAddress: 'ইমেইল ঠিকানা',
  fullName: 'পুরো নাম',
  phoneNumber: 'ফোন নম্বর',
  memberSince: 'সদস্যপদ শুরু',
  firstNameLabel: 'প্রথম নাম',
  firstNamePlaceholder: 'প্রথম নাম লিখুন',
  lastNameLabel: 'পদবি',
  lastNamePlaceholder: 'পদবি লিখুন',
  phonePlaceholder: 'ফোন নম্বর লিখুন',
  profileUpdated: 'প্রোফাইল সফলভাবে আপডেট হয়েছে',
  profileUpdateFailed: 'প্রোফাইল আপডেটে ব্যর্থ',
  profileLoadError: 'প্রোফাইল লোড করা যায়নি',
  profileNotSet: 'সেট করা হয়নি',

  // ── HelpScreen ────────────────────────────────────────────────────────────
  helpAndSupport: 'সাহায্য ও সহায়তা',
  helpIntroTitle: 'আমরা কীভাবে সাহায্য করতে পারি?',
  helpIntroText:
    'Neerani হলো আপনার চিংড়ি অ্যাকুয়াকালচার ব্যবস্থাপনার সঙ্গী। এটি থেকে সর্বোচ্চ সুবিধা পাওয়ার উপায় জানুন।',
  quickGuides: 'দ্রুত গাইড',
  contactUs: 'যোগাযোগ করুন',
  // Help topic titles
  helpTopicWaterTitle: 'পানির মান পর্যবেক্ষণ',
  helpTopicWaterDesc:
    'প্রতিদিন pH, DO, তাপমাত্রা, লবণাক্ততা ও অন্যান্য প্যারামিটার রেকর্ড করুন। মান সর্বোত্তম সীমার বাইরে গেলে সতর্কতা পান।',
  helpTopicFeedTitle: 'খাদ্য ব্যবস্থাপনা',
  helpTopicFeedDesc:
    'খাদ্য ব্যবহার ট্র্যাক করুন, MBW-এর ভিত্তিতে দৈনিক খাদ্যের পরিমাণ গণনা করুন এবং খাওয়ানোর দক্ষতা (FCR) পর্যবেক্ষণ করুন।',
  helpTopicSamplingTitle: 'নমুনার রেকর্ড',
  helpTopicSamplingDesc:
    'নিয়মিত নমুনা নেওয়া বায়োমাস, বেঁচে থাকার হার এবং গড় দেহ ওজন (ABW/MBW) অনুমান করতে সাহায্য করে।',
  helpTopicCalculatorsTitle: 'ক্যালকুলেটর',
  helpTopicCalculatorsDesc:
    'FCR, খাদ্যের পরিমাণ, পণ্যের ডোজ এবং মুক্ত অ্যামোনিয়া গণনার জন্য অন্তর্নির্মিত ক্যালকুলেটর ব্যবহার করুন।',
  helpTopicSimulationsTitle: 'সিমুলেশন',
  helpTopicSimulationsDesc:
    'ফসলের তারিখ, প্রত্যাশিত ফলন পূর্বাভাস এবং চাষ কৌশল অপ্টিমাইজ করতে বৃদ্ধির সিমুলেশন চালান।',
  helpTopicFarmTitle: 'খামার ব্যবস্থাপনা',
  helpTopicFarmDesc:
    'পুকুর সংগঠিত করুন, চক্র পরিচালনা করুন, ইনভেন্টরি ট্র্যাক করুন এবং খামার প্রতি আর্থিক প্রতিবেদন দেখুন।',

  // ── AboutScreen ───────────────────────────────────────────────────────────
  aboutUpcheck: 'Neerani সম্পর্কে',
  appTagline: 'চিংড়ি অ্যাকুয়াকালচার ম্যানেজমেন্ট',
  versionLabel: 'সংস্করণ',
  buildInfo: 'বিল্ড 2026.04.30',
  descriptionLabel: 'বিবরণ',
  descriptionText:
    'Neerani হলো একটি ব্যাপক চিংড়ি অ্যাকুয়াকালচার ব্যবস্থাপনা অ্যাপ্লিকেশন যা কৃষকদের পানির মান পর্যবেক্ষণ, খাদ্য ব্যবস্থাপনা, বৃদ্ধি ট্র্যাকিং এবং চাষ পদ্ধতি অপ্টিমাইজ করতে সাহায্য করে।',
  featuresLabel: 'বৈশিষ্ট্য',
  featureMultiFarm: 'একাধিক খামার ব্যবস্থাপনা',
  featurePondMonitoring: 'পুকুর পর্যবেক্ষণ ও লগ',
  featureWaterQuality: 'পানির মান ট্র্যাকিং',
  featureFeedManagement: 'খাদ্য ব্যবস্থাপনা',
  featureGrowthSimulations: 'বৃদ্ধির সিমুলেশন',
  featureFinancialReports: 'আর্থিক প্রতিবেদন',
  developedByLabel: 'নির্মাতা',
  developedByTeam: 'Neerani টিম',
  developedByLocation: 'ভারত',
  footerCopyright: '© 2026 Neerani। সর্বস্বত্ব সংরক্ষিত।',

  // ── TwoFactorScreen ───────────────────────────────────────────────────────
  twoFactorTitle: 'দ্বি-স্তরীয় প্রমাণীকরণ',
  twoFactorEnabled: 'সক্রিয়',
  twoFactorNotEnabled: 'সক্রিয় নয়',
  twoFactorSetup: '2FA সেটআপ করুন',
  twoFactorScanHelp:
    'একটি অথেনটিকেটর অ্যাপ (Google Authenticator, Authy…) দিয়ে এই QR কোডটি স্ক্যান করুন, তারপর সম্পন্ন করতে উৎপন্ন কোডটি লিখুন।',
  twoFactorManualKey: 'ম্যানুয়াল কী: {{secret}}',
  twoFactorCodeLabel: 'অ্যাপের কোড',
  twoFactorVerifyEnable: 'যাচাই করুন ও সক্রিয় করুন',
  twoFactorDisableHelp: 'দ্বি-স্তরীয় প্রমাণীকরণ বন্ধ করতে একটি বর্তমান কোড লিখুন।',
  twoFactorAuthCodeLabel: 'অথেনটিকেটর কোড',
  twoFactorDisable: '2FA বন্ধ করুন',
  twoFactorInvalidCode: 'আপনার অথেনটিকেটর অ্যাপ থেকে ৬ সংখ্যার কোডটি লিখুন।',
  twoFactorCodeRequired: '2FA বন্ধ করতে একটি বর্তমান ৬ সংখ্যার কোড লিখুন।',
  twoFactorEnabledSuccess: 'দ্বি-স্তরীয় প্রমাণীকরণ এখন চালু আছে।',
  twoFactorDisabledSuccess: 'দ্বি-স্তরীয় প্রমাণীকরণ এখন বন্ধ আছে।',
  twoFactorSetupError: '2FA সেটআপ শুরু করা যায়নি',

  // ── Backup codes (AUTH-4) ──
  twoFactorBackupTitle: 'আপনার ব্যাকআপ কোড সংরক্ষণ করুন',
  twoFactorBackupHelp:
    'এই এককালীন কোডগুলি নিরাপদ কোথাও রাখুন। আপনি যদি আপনার অথেন্টিকেটর অ্যাপে অ্যাক্সেস হারান তবে প্রতিটি একবার কাজ করে। এগুলি আর দেখানো হবে না।',
  twoFactorBackupCopy: 'কোড কপি করুন',
  twoFactorBackupAck: 'আমি এগুলি সংরক্ষণ করেছি',
  twoFactorBackupCopied: 'ব্যাকআপ কোড ক্লিপবোর্ডে কপি করা হয়েছে।',
  twoFactorRegenerateHelp:
    'ব্যাকআপ কোডের একটি নতুন সেট তৈরি করুন। আপনার পুরানো কোডগুলি কাজ করা বন্ধ করবে।',
  twoFactorRegenerate: 'ব্যাকআপ কোড পুনরায় তৈরি করুন',

  // ── NotificationsScreen ───────────────────────────────────────────────────
  notificationsTitle: 'বিজ্ঞপ্তি',
  notificationsEmpty: 'সব পড়া হয়ে গেছে!',
  notificationsEmptyDesc: 'আপনার কোনো নতুন বিজ্ঞপ্তি নেই।',
  notificationsLoadError: 'বিজ্ঞপ্তি লোড করা যায়নি',
  deleteAccount: "অ্যাকাউন্ট মুছুন",
  deleteAccountConfirm: "এটি স্থায়ীভাবে আপনার অ্যাকাউন্ট এবং সমস্ত খামারের ডেটা মুছে ফেলবে। এটি ফেরানো যাবে না। চালিয়ে যাবেন?",
  deleteAccountHint: "আপনার অ্যাকাউন্ট এবং আপনার মালিকানাধীন সমস্ত ডেটা স্থায়ীভাবে মুছে ফেলে।",
  deleteAccountTitle: 'অ্যাকাউন্ট মুছুন',
  deleteAccountWarningTitle: 'এটি পূর্বাবস্থায় ফেরানো যাবে না',
  deleteAccountWarningBody: 'আপনার অ্যাকাউন্ট মুছে ফেললে এটি এবং আপনার মালিকানাধীন সমস্ত ডেটা স্থায়ীভাবে মুছে যায়। আপনাকে সঙ্গে সঙ্গে সাইন আউট করা হবে।',
  deleteAccountWhatTitle: 'কী কী মুছে যাবে',
  deleteAccountItemFarms: 'আপনার মালিকানাধীন সমস্ত খামার, এবং তাদের পুকুর ও চক্র',
  deleteAccountItemLogs: 'সমস্ত জল, খাদ্য, নমুনা ও স্বাস্থ্য রেকর্ড',
  deleteAccountItemFinance: 'সমস্ত আর্থিক রেকর্ড, ইনভেন্টরি ও রিপোর্ট',
  deleteAccountItemTeam: 'অন্য খামারে আপনার দলের সদস্যপদ',
  deleteAccountReuseNote: 'আপনার ইমেইল মুক্ত হয়ে যাবে — পরে আপনি নতুন ব্যবহারকারী হিসেবে আবার সাইন আপ করতে পারবেন।',
  deleteConfirmPrompt: 'নিশ্চিত করতে, নিচের লেখাটি হুবহু টাইপ করুন:',
  deleteConfirmLabel: 'নিশ্চিতকরণ',
  deleteConfirmWord: 'DELETE',
  deletePasswordLabel: 'আপনার পাসওয়ার্ড',
  deletePasswordHint: 'এটি আপনিই তা নিশ্চিত করতে আপনার পাসওয়ার্ড লিখুন।',
  deleteAccountButton: 'আমার অ্যাকাউন্ট স্থায়ীভাবে মুছুন',
  deleteAccountWrongPassword: 'পাসওয়ার্ড ভুল।',
  deleteAccountError:"আপনার অ্যাকাউন্ট মুছে ফেলা যায়নি। আবার চেষ্টা করুন।",

  // Settings — artboard p6
  accountEyebrow: "{{name}} · আপচেক",
  edit: "সম্পাদনা",
  ownerOfFarms: "{{count}} খামারের মালিক",
  ownerOfFarms_one: "{{count}} খামারের মালিক",
  languageWholeApp: "কর্মীরা যা দেখেন তা সহ পুরো অ্যাপ বদলে যায়।",
  signOutConfirm: "এই ডিভাইসে আপচেক থেকে সাইন আউট করবেন?",
  toolsSection: "সরঞ্জাম",
  farmSection: "খামার",

  // ── রিমাইন্ডারের সময় (স্মার্ট রিমাইন্ডার) ──────────────────────────────
  reminderTimes: "রিমাইন্ডারের সময়",
  reminderTimesDesc: "Neerani কখন আপনাকে পানির গুণমান লগ করার কথা মনে করিয়ে দেবে তা নির্বাচন করুন।",
  reminderMorning: "সকালের চেক",
  reminderAfternoon: "দুপুরের চেক",
  reminderEvening: "সন্ধ্যার চেক",
  reminderChemistry: "সাপ্তাহিক রসায়ন পরীক্ষা",
  reminderHourLabel: "ঘণ্টা",
  reminderMinuteLabel: "মিনিট",
  reminderStatusOn: "রিমাইন্ডার চালু আছে। পরেরটি: {{when}}",
  reminderStatusOff: "এখন কোনো রিমাইন্ডার সেট নেই। একটি পুকুর যোগ করুন, তারপর একবার Neerani খুলুন — রিমাইন্ডার চালু হয়ে যাবে।",
  reminderStatusBlocked: "এই ফোনে Neerani বিজ্ঞপ্তি দেখাতে পারে না, তাই রিমাইন্ডার আসবে না।",
  reminderStatusOpenSettings: "ফোনের সেটিংস খুলুন",
  reminderWhenToday: "আজ {{time}}-এ",
  reminderWhenTomorrow: "আগামীকাল {{time}}-এ",
  reminderWhenOn: "{{date}} তারিখে {{time}}-এ",

  // ── গোপনীয়তা: ক্র্যাশ রিপোর্ট ও ব্যবহারের তথ্য ─────────────────────────────
  privacySection: "গোপনীয়তা",
  crashReportsToggle: "ক্র্যাশ রিপোর্ট",
  crashReportsDesc:
    "চালু আছে, যাতে আপনি জানানোর আগেই আমরা ত্রুটি সারাতে পারি। এই রিপোর্টে আপনার ফোন নম্বর, ইমেল, পাসওয়ার্ড, টাকার হিসাব বা খামারের রেকর্ড যায় না। আপনি এটি বন্ধ করতে পারেন।",
  analyticsToggle: "ব্যবহারের তথ্য",
  analyticsToggleDesc:
    "আপনি চালু না করলে বন্ধ থাকে। কোন স্ক্রিনগুলি ব্যবহার হয় তা জানায়, যাতে আমরা সঠিক জিনিস তৈরি করি। আপনার পুকুর, টাকা ও ফসলের তথ্য কখনও পাঠানো হয় না।",
  analyticsPromptTitle: "আপনি কোন স্ক্রিন ব্যবহার করেন তা কি আমরা দেখতে পারি?",
  analyticsPromptBody:
    "কোনটা ব্যবহার করা কঠিন তা ঠিক করতে এটি সাহায্য করে। আমরা কেবল স্ক্রিনের নাম পাঠাব — আপনার পুকুর, টাকা বা ফসলের হিসাব কখনও নয়। আপনার উত্তর যাই হোক, অ্যাপের সবকিছু একইভাবে কাজ করবে।",
  analyticsPromptAllow: "হ্যাঁ, ঠিক আছে",
  analyticsPromptDecline: "না, ধন্যবাদ",
};

export default settings;
