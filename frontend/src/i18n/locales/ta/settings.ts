const settings = {
  // ── SettingsScreen ────────────────────────────────────────────────────────
  title: 'அமைப்புகள்',
  language: 'மொழி',
  languageDesc: 'உங்கள் விருப்பமான ஆப் மொழியை தேர்ந்தெடுக்கவும்',
  appPreferences: 'ஆப் விருப்பங்கள்',
  offlineSync: 'ஆஃப்லைன் ஒத்திசைவு',
  offlineSyncDesc: 'ஆஃப்லைன் பயன்பாட்டிற்கு தரவை தற்காலிகமாக சேமி',
  notifications: 'அறிவிப்புகள்',
  pushNotifications: 'புஷ் அறிவிப்புகள்',
  pushNotificationsDesc: 'நீர் தரம் & தீவனம் குறித்த எச்சரிக்கைகள்',
  emailSummaries: 'மின்னஞ்சல் சுருக்கங்கள்',
  emailSummariesDesc: 'வாராந்திர செயல்திறன் அறிக்கைகள்',
  security: 'பாதுகாப்பு',
  twoFactor: 'இரு-படி அங்கீகரிப்பு',
  about: 'Upcheck பற்றி',
  privacyPolicy: 'தனியுரிமை கொள்கை',
  termsOfService: 'சேவை விதிமுறைகள்',

  // ── ProfileScreen ─────────────────────────────────────────────────────────
  profile: 'சுயவிவரம்',
  editProfile: 'சுயவிவரம் திருத்து',
  linkTruecaller: 'உங்கள் தொலைபேசியை இணைக்கவும் (Truecaller)',
  linkTruecallerUnavailable:
    'Truecaller கிடைக்கவில்லை. Truecaller செயலியைத் திறந்து, உள்நுழைந்து, மீண்டும் முயற்சிக்கவும்.',
  phoneLinked: 'தொலைபேசி எண் இணைக்கப்பட்டது',
  phoneAlreadyLinked: 'அந்த எண் ஏற்கனவே வேறு கணக்குடன் இணைக்கப்பட்டுள்ளது.',
  linkTruecallerFailed: 'உங்கள் எண்ணை இணைக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
  emailAddress: 'மின்னஞ்சல் முகவரி',
  fullName: 'முழு பெயர்',
  phoneNumber: 'தொலைபேசி எண்',
  memberSince: 'உறுப்பினர் ஆனது',
  firstNameLabel: 'முதல் பெயர்',
  firstNamePlaceholder: 'முதல் பெயரை உள்ளிடுக',
  lastNameLabel: 'கடைசி பெயர்',
  lastNamePlaceholder: 'கடைசி பெயரை உள்ளிடுக',
  phonePlaceholder: 'தொலைபேசி எண்ணை உள்ளிடுக',
  profileUpdated: 'சுயவிவரம் வெற்றிகரமாக புதுப்பிக்கப்பட்டது',
  profileUpdateFailed: 'சுயவிவரம் புதுப்பிக்கத் தோல்வியடைந்தது',
  profileLoadError: 'சுயவிவரத்தை ஏற்ற முடியவில்லை',
  profileNotSet: 'அமைக்கப்படவில்லை',

  // ── HelpScreen ────────────────────────────────────────────────────────────
  helpAndSupport: 'உதவி & ஆதரவு',
  helpIntroTitle: 'எவ்வாறு உதவலாம்?',
  helpIntroText:
    'Upcheck உங்கள் இறால் மீன்வளர்ப்பு மேலாண்மை உதவியாளர். இதை சிறப்பாக பயன்படுத்த கீழே காணுங்கள்.',
  quickGuides: 'விரைவு வழிகாட்டிகள்',
  contactUs: 'எங்களை தொடர்பு கொள்',
  // Help topic titles
  helpTopicWaterTitle: 'நீர் தர கண்காணிப்பு',
  helpTopicWaterDesc:
    'தினமும் pH, DO, வெப்பநிலை, உப்புத்தன்மை மற்றும் பிற அளவுருக்களை பதிவு செய்யுங்கள். மதிப்புகள் உகந்த வரம்பை மீறும்போது எச்சரிக்கை பெறுங்கள்.',
  helpTopicFeedTitle: 'தீவன மேலாண்மை',
  helpTopicFeedDesc:
    'தீவன பயன்பாட்டை கண்காணிக்கவும், MBW அடிப்படையில் தினசரி தீவன அளவை கணக்கிடவும், தீவன திறனை (FCR) கவனிக்கவும்.',
  helpTopicSamplingTitle: 'மாதிரி பதிவுகள்',
  helpTopicSamplingDesc:
    'தொடர்ந்த மாதிரி சேகரிப்பு உயிரி நிறை, உயிர்வாழ்வு விகிதம் மற்றும் சராசரி உடல் எடையை (ABW/MBW) மதிப்பிட உதவுகிறது.',
  helpTopicCalculatorsTitle: 'கணக்கீடுகள்',
  helpTopicCalculatorsDesc:
    'FCR, தீவன அளவு, பொருள் அளவு மற்றும் சுதந்திர அம்மோனியா கணக்கீட்டுக்கு உள்ளமைக்கப்பட்ட கணக்கீடுகளை பயன்படுத்துங்கள்.',
  helpTopicSimulationsTitle: 'உருவகப்படுத்தல்கள்',
  helpTopicSimulationsDesc:
    'அறுவடை தேதிகளை கணிக்க, எதிர்பார்க்கப்படும் விளைச்சலை மதிப்பிட, மற்றும் வளர்ப்பு உத்திகளை மேம்படுத்த வளர்ச்சி உருவகப்படுத்தல்களை இயக்குங்கள்.',
  helpTopicFarmTitle: 'பண்ணை மேலாண்மை',
  helpTopicFarmDesc:
    'குளங்களை ஒழுங்கமைக்கவும், சுழற்சிகளை நிர்வகிக்கவும், சரக்கை கண்காணிக்கவும், பண்ணைவாரியாக நிதி அறிக்கைகளை பார்க்கவும்.',

  // ── AboutScreen ───────────────────────────────────────────────────────────
  aboutUpcheck: 'Upcheck பற்றி',
  appTagline: 'இறால் மீன்வளர்ப்பு மேலாண்மை',
  versionLabel: 'பதிப்பு',
  buildInfo: 'Build 2026.04.30',
  descriptionLabel: 'விளக்கம்',
  descriptionText:
    'Upcheck என்பது நீர் தரம் கண்காணிக்க, தீவனம் நிர்வகிக்க, வளர்ச்சியை கண்காணிக்க மற்றும் வளர்ப்பு முறைகளை மேம்படுத்த விவசாயிகளுக்கு உதவும் விரிவான இறால் மீன்வளர்ப்பு மேலாண்மை பயன்பாடு.',
  featuresLabel: 'அம்சங்கள்',
  featureMultiFarm: 'பல பண்ணை மேலாண்மை',
  featurePondMonitoring: 'குளம் கண்காணிப்பு & பதிவுகள்',
  featureWaterQuality: 'நீர் தர கண்காணிப்பு',
  featureFeedManagement: 'தீவன மேலாண்மை',
  featureGrowthSimulations: 'வளர்ச்சி உருவகப்படுத்தல்கள்',
  featureFinancialReports: 'நிதி அறிக்கைகள்',
  developedByLabel: 'உருவாக்கியவர்கள்',
  developedByTeam: 'Upcheck குழு',
  developedByLocation: 'இந்தியா',
  footerCopyright: '© 2026 Upcheck. அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.',

  // ── TwoFactorScreen ───────────────────────────────────────────────────────
  twoFactorTitle: 'இரு-படி அங்கீகரிப்பு',
  twoFactorEnabled: 'இயக்கப்பட்டது',
  twoFactorNotEnabled: 'இயக்கப்படவில்லை',
  twoFactorSetup: '2FA அமை',
  twoFactorScanHelp:
    'அங்கீகரிப்பு ஆப் (Google Authenticator, Authy…) மூலம் இந்த QR குறியீட்டை ஸ்கேன் செய்து, முடிக்க உருவாக்கப்பட்ட குறியீட்டை உள்ளிடுக.',
  twoFactorManualKey: 'கைமுறை விசை: {{secret}}',
  twoFactorCodeLabel: 'ஆப்பிலிருந்து குறியீடு',
  twoFactorVerifyEnable: 'சரிபார்த்து இயக்கு',
  twoFactorDisableHelp: 'இரு-படி அங்கீகரிப்பை முடக்க தற்போதைய குறியீட்டை உள்ளிடுக.',
  twoFactorAuthCodeLabel: 'அங்கீகரிப்பு குறியீடு',
  twoFactorDisable: '2FA முடக்கு',
  twoFactorInvalidCode: 'அங்கீகரிப்பு ஆப்பிலிருந்து 6 இலக்க குறியீட்டை உள்ளிடுக.',
  twoFactorCodeRequired: '2FA முடக்க தற்போதைய 6 இலக்க குறியீட்டை உள்ளிடுக.',
  twoFactorEnabledSuccess: 'இரு-படி அங்கீகரிப்பு இப்போது இயக்கப்பட்டது.',
  twoFactorDisabledSuccess: 'இரு-படி அங்கீகரிப்பு இப்போது முடக்கப்பட்டது.',
  twoFactorSetupError: '2FA அமைவு தொடங்க முடியவில்லை',

  // ── Backup codes (AUTH-4) ──
  twoFactorBackupTitle: 'உங்கள் காப்பு குறியீடுகளைச் சேமிக்கவும்',
  twoFactorBackupHelp:
    'இந்த ஒரு முறை குறியீடுகளை பாதுகாப்பான இடத்தில் வைக்கவும். உங்கள் அங்கீகரிப்பு பயன்பாட்டை இழந்தால் ஒவ்வொன்றும் ஒரு முறை வேலை செய்யும். இவை மீண்டும் காட்டப்படாது.',
  twoFactorBackupCopy: 'குறியீடுகளை நகலெடுக்கவும்',
  twoFactorBackupAck: 'நான் அவற்றைச் சேமித்துவிட்டேன்',
  twoFactorBackupCopied: 'காப்பு குறியீடுகள் கிளிப்போர்டுக்கு நகலெடுக்கப்பட்டன.',
  twoFactorRegenerateHelp:
    'புதிய காப்பு குறியீடுகளை உருவாக்கவும். உங்கள் பழைய குறியீடுகள் வேலை செய்வதை நிறுத்தும்.',
  twoFactorRegenerate: 'காப்பு குறியீடுகளை மீண்டும் உருவாக்கவும்',

  // ── NotificationsScreen ───────────────────────────────────────────────────
  notificationsTitle: 'அறிவிப்புகள்',
  notificationsEmpty: 'அனைத்தும் சரிபார்க்கப்பட்டது!',
  notificationsEmptyDesc: 'புதிய அறிவிப்புகள் எதுவும் இல்லை.',
  notificationsLoadError: 'அறிவிப்புகளை ஏற்ற முடியவில்லை',
  deleteAccount: "கணக்கை நீக்கு",
  deleteAccountConfirm: "இது உங்கள் கணக்கையும் அனைத்து பண்ணைத் தரவையும் நிரந்தரமாக நீக்கும். இதை மீட்டெடுக்க முடியாது. தொடரவா?",
  deleteAccountHint: "உங்கள் கணக்கையும் நீங்கள் வைத்திருக்கும் அனைத்து தரவையும் நிரந்தரமாக நீக்குகிறது.",
  deleteAccountTitle: 'கணக்கை நீக்கு',
  deleteAccountWarningTitle: 'இதை மீட்டெடுக்க முடியாது',
  deleteAccountWarningBody: 'உங்கள் கணக்கை நீக்குவது அதையும் நீங்கள் சொந்தமாகக் கொண்ட அனைத்து தரவையும் நிரந்தரமாக அகற்றும். உடனடியாக வெளியேற்றப்படுவீர்கள்.',
  deleteAccountWhatTitle: 'என்ன நீக்கப்படும்',
  deleteAccountItemFarms: 'நீங்கள் சொந்தமாகக் கொண்ட அனைத்து பண்ணைகள், அவற்றின் குளங்கள் மற்றும் சுழற்சிகள்',
  deleteAccountItemLogs: 'அனைத்து நீர், தீவனம், மாதிரி மற்றும் ஆரோக்கியப் பதிவுகள்',
  deleteAccountItemFinance: 'அனைத்து நிதிப் பதிவுகள், சரக்கு மற்றும் அறிக்கைகள்',
  deleteAccountItemTeam: 'மற்ற பண்ணைகளில் உங்கள் குழு உறுப்பினர் பதிவுகள்',
  deleteAccountReuseNote: 'உங்கள் மின்னஞ்சல் விடுவிக்கப்படும் — பின்னர் புதிய பயனராக மீண்டும் பதிவு செய்யலாம்.',
  deleteConfirmPrompt: 'உறுதிப்படுத்த, கீழே உள்ள உரையை அப்படியே தட்டச்சு செய்யவும்:',
  deleteConfirmLabel: 'உறுதிப்படுத்தல்',
  deleteConfirmWord: 'DELETE',
  deletePasswordLabel: 'உங்கள் கடவுச்சொல்',
  deletePasswordHint: 'நீங்கள்தான் என்பதை உறுதிப்படுத்த உங்கள் கடவுச்சொல்லை உள்ளிடவும்.',
  deleteAccountButton: 'என் கணக்கை நிரந்தரமாக நீக்கு',
  deleteAccountWrongPassword: 'கடவுச்சொல் தவறானது.',
  deleteAccountError:"உங்கள் கணக்கை நீக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",

  // Settings — artboard p6
  accountEyebrow: "{{name}} · அப்செக்",
  edit: "திருத்து",
  ownerOfFarms: "{{count}} பண்ணைகளின் உரிமையாளர்",
  ownerOfFarms_one: "{{count}} பண்ணையின் உரிமையாளர்",
  languageWholeApp: "பணியாளர்கள் பார்ப்பது உட்பட, ஆப் முழுவதும் மாறும்.",
  signOutConfirm: "இந்தச் சாதனத்தில் அப்செக்கிலிருந்து வெளியேறவா?",
  toolsSection: "கருவிகள்",
  farmSection: "பண்ணை",

  // ── நினைவூட்டல் நேரங்கள் (ஸ்மார்ட் நினைவூட்டல்கள்) ───────────────────
  reminderTimes: "நினைவூட்டல் நேரங்கள்",
  reminderTimesDesc: "நீரின் தரத்தை பதிவு செய்ய Upcheck உங்களுக்கு எப்போது நினைவூட்ட வேண்டும் என்பதைத் தேர்ந்தெடுக்கவும்.",
  reminderMorning: "காலை சோதனை",
  reminderAfternoon: "மதிய சோதனை",
  reminderEvening: "மாலை சோதனை",
  reminderChemistry: "வாராந்திர வேதியியல் சோதனை",
  reminderHourLabel: "மணி",
  reminderMinuteLabel: "நிமிடம்",
  reminderStatusOn: "நினைவூட்டல்கள் இயங்குகின்றன. அடுத்தது: {{when}}",
  reminderStatusOff: "இப்போது எந்த நினைவூட்டலும் அமைக்கப்படவில்லை. ஒரு குளத்தைச் சேர்த்து, Upcheck-ஐ ஒருமுறை திறந்தால் அவை அமைக்கப்படும்.",
  reminderStatusBlocked: "இந்த ஃபோனில் Upcheck அறிவிப்புகளைக் காட்ட முடியாது, எனவே நினைவூட்டல்கள் வராது.",
  reminderStatusOpenSettings: "ஃபோன் அமைப்புகளைத் திற",
  reminderWhenToday: "இன்று {{time}} மணிக்கு",
  reminderWhenTomorrow: "நாளை {{time}} மணிக்கு",
  reminderWhenOn: "{{date}} அன்று {{time}} மணிக்கு",

  // ── தனியுரிமை: செயலிழப்பு அறிக்கை மற்றும் பயன்பாட்டுத் தகவல் ──────────────
  privacySection: "தனியுரிமை",
  crashReportsToggle: "செயலிழப்பு அறிக்கைகள்",
  crashReportsDesc:
    "இயக்கத்தில் உள்ளது — நீங்கள் சொல்வதற்கு முன்பே கோளாறை சரிசெய்ய. இந்த அறிக்கைகளில் உங்கள் ஃபோன் எண், மின்னஞ்சல், கடவுச்சொல், பணக் கணக்கு அல்லது பண்ணைப் பதிவுகள் இருக்காது. இதை நீங்கள் நிறுத்தலாம்.",
  analyticsToggle: "பயன்பாட்டுத் தகவல்",
  analyticsToggleDesc:
    "நீங்கள் இயக்கும் வரை நிறுத்தப்பட்டிருக்கும். எந்தத் திரைகள் பயன்படுகின்றன என்பதைச் சொல்கிறது, சரியானவற்றை உருவாக்க. உங்கள் குளம், பணம், அறுவடைத் தகவல் ஒருபோதும் அனுப்பப்படாது.",
  analyticsPromptTitle: "நீங்கள் எந்தத் திரைகளைப் பயன்படுத்துகிறீர்கள் என்று பார்க்கலாமா?",
  analyticsPromptBody:
    "எது பயன்படுத்த கடினமாக உள்ளது என்பதைச் சரிசெய்ய இது உதவும். திரையின் பெயரை மட்டுமே அனுப்புவோம் — உங்கள் குளம், பணம் அல்லது அறுவடைக் கணக்குகளை ஒருபோதும் இல்லை. நீங்கள் என்ன சொன்னாலும் செயலி முழுவதும் ஒரே மாதிரி வேலை செய்யும்.",
  analyticsPromptAllow: "சரி, பரவாயில்லை",
  analyticsPromptDecline: "வேண்டாம், நன்றி",
};

export default settings;
