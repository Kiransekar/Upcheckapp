const settings = {
  // ── SettingsScreen ────────────────────────────────────────────────────────
  title: 'सेटिंग्स',
  language: 'भाषा',
  languageDesc: 'अपनी पसंदीदा ऐप भाषा चुनें',
  appPreferences: 'ऐप प्राथमिकताएं',
  offlineSync: 'ऑफलाइन सिंक',
  offlineSyncDesc: 'ऑफलाइन उपयोग के लिए डेटा कैश करें',
  notifications: 'सूचनाएं',
  pushNotifications: 'पुश सूचनाएं',
  pushNotificationsDesc: 'जल गुणवत्ता और आहार के लिए अलर्ट',
  emailSummaries: 'ईमेल सारांश',
  emailSummariesDesc: 'साप्ताहिक प्रदर्शन रिपोर्ट',
  security: 'सुरक्षा',
  twoFactor: 'दो-चरणीय प्रमाणीकरण',
  about: 'Upcheck के बारे में',
  privacyPolicy: 'गोपनीयता नीति',
  termsOfService: 'सेवा की शर्तें',

  // ── ProfileScreen ─────────────────────────────────────────────────────────
  profile: 'प्रोफ़ाइल',
  editProfile: 'प्रोफ़ाइल संपादित करें',
  linkTruecaller: 'अपना फ़ोन जोड़ें (Truecaller)',
  linkTruecallerUnavailable:
    'Truecaller उपलब्ध नहीं है। Truecaller ऐप खोलें, साइन इन करें, फिर पुनः प्रयास करें।',
  phoneLinked: 'फ़ोन नंबर जोड़ा गया',
  phoneAlreadyLinked: 'वह नंबर पहले से किसी अन्य खाते से जुड़ा है।',
  linkTruecallerFailed: 'आपका नंबर नहीं जोड़ा जा सका। कृपया पुनः प्रयास करें।',
  emailAddress: 'ईमेल पता',
  fullName: 'पूरा नाम',
  phoneNumber: 'फोन नंबर',
  memberSince: 'सदस्यता तिथि',
  firstNameLabel: 'पहला नाम',
  firstNamePlaceholder: 'पहला नाम दर्ज करें',
  lastNameLabel: 'अंतिम नाम',
  lastNamePlaceholder: 'अंतिम नाम दर्ज करें',
  phonePlaceholder: 'फोन नंबर दर्ज करें',
  profileUpdated: 'प्रोफ़ाइल सफलतापूर्वक अपडेट की गई',
  profileUpdateFailed: 'प्रोफ़ाइल अपडेट करने में विफल',
  profileLoadError: 'प्रोफ़ाइल लोड नहीं हो सकी',
  profileNotSet: 'सेट नहीं है',

  // ── HelpScreen ────────────────────────────────────────────────────────────
  helpAndSupport: 'सहायता और समर्थन',
  helpIntroTitle: 'हम कैसे मदद कर सकते हैं?',
  helpIntroText:
    'Upcheck आपका झींगा जलकृषि प्रबंधन साथी है। इसका अधिकतम लाभ उठाने का तरीका यहाँ है।',
  quickGuides: 'त्वरित मार्गदर्शिकाएं',
  contactUs: 'हमसे संपर्क करें',
  // Help topic titles
  helpTopicWaterTitle: 'जल गुणवत्ता निगरानी',
  helpTopicWaterDesc:
    'प्रतिदिन pH, DO, तापमान, लवणता और अन्य मानक दर्ज करें। इष्टतम सीमा से बाहर होने पर अलर्ट प्राप्त करें।',
  helpTopicFeedTitle: 'आहार प्रबंधन',
  helpTopicFeedDesc:
    'आहार उपयोग ट्रैक करें, MBW के आधार पर दैनिक आहार मात्रा की गणना करें, और आहार दक्षता (FCR) की निगरानी करें।',
  helpTopicSamplingTitle: 'नमूनाकरण रिकॉर्ड',
  helpTopicSamplingDesc:
    'नियमित नमूनाकरण से जैव भार, उत्तरजीविता दर और औसत शरीर भार (ABW/MBW) का अनुमान लगाने में मदद मिलती है।',
  helpTopicCalculatorsTitle: 'कैलकुलेटर',
  helpTopicCalculatorsDesc:
    'FCR, आहार मात्रा, उत्पाद खुराक और मुक्त अमोनिया गणनाओं के लिए अंतर्निहित कैलकुलेटर उपयोग करें।',
  helpTopicSimulationsTitle: 'सिमुलेशन',
  helpTopicSimulationsDesc:
    'कटाई तिथियाँ, अपेक्षित उपज और खेती की रणनीतियाँ अनुकूलित करने का पूर्वानुमान लगाने के लिए वृद्धि सिमुलेशन चलाएं।',
  helpTopicFarmTitle: 'फार्म प्रबंधन',
  helpTopicFarmDesc:
    'तालाब व्यवस्थित करें, चक्र प्रबंधित करें, इन्वेंटरी ट्रैक करें, और प्रत्येक फार्म की वित्तीय रिपोर्ट देखें।',

  // ── AboutScreen ───────────────────────────────────────────────────────────
  aboutUpcheck: 'Upcheck के बारे में',
  appTagline: 'झींगा जलकृषि प्रबंधन',
  versionLabel: 'संस्करण',
  buildInfo: 'बिल्ड 2026.04.30',
  descriptionLabel: 'विवरण',
  descriptionText:
    'Upcheck एक व्यापक झींगा जलकृषि प्रबंधन ऐप है जो किसानों को जल गुणवत्ता निगरानी, आहार प्रबंधन, वृद्धि ट्रैकिंग और खेती प्रथाओं को अनुकूलित करने में मदद करता है।',
  featuresLabel: 'विशेषताएं',
  featureMultiFarm: 'बहु-फार्म प्रबंधन',
  featurePondMonitoring: 'तालाब निगरानी और लॉग',
  featureWaterQuality: 'जल गुणवत्ता ट्रैकिंग',
  featureFeedManagement: 'आहार प्रबंधन',
  featureGrowthSimulations: 'वृद्धि सिमुलेशन',
  featureFinancialReports: 'वित्तीय रिपोर्ट',
  developedByLabel: 'विकसित किया',
  developedByTeam: 'Upcheck टीम',
  developedByLocation: 'भारत',
  footerCopyright: '© 2026 Upcheck. सर्वाधिकार सुरक्षित।',

  // ── TwoFactorScreen ───────────────────────────────────────────────────────
  twoFactorTitle: 'दो-चरणीय प्रमाणीकरण',
  twoFactorEnabled: 'सक्षम',
  twoFactorNotEnabled: 'सक्षम नहीं है',
  twoFactorSetup: '2FA सेट अप करें',
  twoFactorScanHelp:
    'एक ऑथेंटिकेटर ऐप (Google Authenticator, Authy…) से यह QR कोड स्कैन करें, फिर पूरा करने के लिए उत्पन्न कोड दर्ज करें।',
  twoFactorManualKey: 'मैन्युअल कुंजी: {{secret}}',
  twoFactorCodeLabel: 'ऐप से कोड',
  twoFactorVerifyEnable: 'सत्यापित करें और सक्षम करें',
  twoFactorDisableHelp: 'दो-चरणीय प्रमाणीकरण बंद करने के लिए वर्तमान कोड दर्ज करें।',
  twoFactorAuthCodeLabel: 'ऑथेंटिकेटर कोड',
  twoFactorDisable: '2FA अक्षम करें',
  twoFactorInvalidCode: 'अपने ऑथेंटिकेटर ऐप से 6-अंकीय कोड दर्ज करें।',
  twoFactorCodeRequired: '2FA अक्षम करने के लिए वर्तमान 6-अंकीय कोड दर्ज करें।',
  twoFactorEnabledSuccess: 'दो-चरणीय प्रमाणीकरण अब चालू है।',
  twoFactorDisabledSuccess: 'दो-चरणीय प्रमाणीकरण अब बंद है।',
  twoFactorSetupError: '2FA सेटअप शुरू नहीं हो सका',

  // ── Backup codes (AUTH-4) ──
  twoFactorBackupTitle: 'अपने बैकअप कोड सहेजें',
  twoFactorBackupHelp:
    'इन एक-बार उपयोग होने वाले कोड को किसी सुरक्षित जगह पर रखें। यदि आप अपने प्रमाणक ऐप तक पहुँच खो देते हैं तो प्रत्येक एक बार काम करता है। ये दोबारा नहीं दिखाए जाएँगे।',
  twoFactorBackupCopy: 'कोड कॉपी करें',
  twoFactorBackupAck: 'मैंने इन्हें सहेज लिया है',
  twoFactorBackupCopied: 'बैकअप कोड क्लिपबोर्ड पर कॉपी किए गए।',
  twoFactorRegenerateHelp:
    'बैकअप कोड का नया सेट बनाएँ। आपके पुराने कोड काम करना बंद कर देंगे।',
  twoFactorRegenerate: 'बैकअप कोड फिर से बनाएँ',

  // ── NotificationsScreen ───────────────────────────────────────────────────
  notificationsTitle: 'सूचनाएं',
  notificationsEmpty: 'सब अपडेट है!',
  notificationsEmptyDesc: 'आपके पास कोई नई सूचना नहीं है।',
  notificationsLoadError: 'सूचनाएं लोड नहीं हो सकीं',
  deleteAccount: "खाता हटाएँ",
  deleteAccountConfirm: "इससे आपका खाता और सभी फ़ार्म डेटा स्थायी रूप से हट जाएगा। इसे पूर्ववत नहीं किया जा सकता। जारी रखें?",
  deleteAccountHint: "आपका खाता और आपके सभी डेटा को स्थायी रूप से हटा देता है।",
  deleteAccountTitle: 'खाता हटाएं',
  deleteAccountWarningTitle: 'इसे पूर्ववत नहीं किया जा सकता',
  deleteAccountWarningBody: 'आपका खाता हटाने से वह और आपके स्वामित्व वाला सारा डेटा स्थायी रूप से हट जाता है। आपको तुरंत साइन आउट कर दिया जाएगा।',
  deleteAccountWhatTitle: 'क्या-क्या हटेगा',
  deleteAccountItemFarms: 'आपके स्वामित्व वाले सभी खेत, और उनके तालाब व चक्र',
  deleteAccountItemLogs: 'सभी पानी, चारा, नमूना और स्वास्थ्य रिकॉर्ड',
  deleteAccountItemFinance: 'सभी वित्तीय रिकॉर्ड, इन्वेंटरी और रिपोर्ट',
  deleteAccountItemTeam: 'अन्य खेतों में आपकी टीम सदस्यता',
  deleteAccountReuseNote: 'आपका ईमेल मुक्त हो जाएगा — आप बाद में नए उपयोगकर्ता के रूप में फिर से साइन अप कर सकते हैं।',
  deleteConfirmPrompt: 'पुष्टि करने के लिए, नीचे दिया गया पाठ ठीक वैसा ही टाइप करें:',
  deleteConfirmLabel: 'पुष्टि',
  deleteConfirmWord: 'DELETE',
  deletePasswordLabel: 'आपका पासवर्ड',
  deletePasswordHint: 'यह पुष्टि करने के लिए कि यह आप ही हैं, अपना पासवर्ड दर्ज करें।',
  deleteAccountButton: 'मेरा खाता स्थायी रूप से हटाएं',
  deleteAccountWrongPassword: 'पासवर्ड गलत है।',
  deleteAccountError:"आपका खाता हटाया नहीं जा सका। कृपया पुनः प्रयास करें।",

  // Settings — artboard p6
  accountEyebrow: "{{name}} · अपचेक",
  edit: "बदलें",
  ownerOfFarms: "{{count}} फ़ार्मों के मालिक",
  ownerOfFarms_one: "{{count}} फ़ार्म के मालिक",
  languageWholeApp: "पूरा ऐप बदल जाता है, वर्कर जो देखते हैं वह भी।",
  signOutConfirm: "क्या इस डिवाइस पर अपचेक से साइन आउट करें?",
  toolsSection: "उपकरण",
  farmSection: "फ़ार्म",

  // ── रिमाइंडर का समय (स्मार्ट रिमाइंडर) ──────────────────────────────────
  reminderTimes: "रिमाइंडर का समय",
  reminderTimesDesc: "तय करें कि Upcheck आपको पानी की गुणवत्ता दर्ज करने के लिए कब याद दिलाए।",
  reminderMorning: "सुबह की जांच",
  reminderAfternoon: "दोपहर की जांच",
  reminderEvening: "शाम की जांच",
  reminderChemistry: "साप्ताहिक रसायन जांच",
  reminderHourLabel: "घंटा",
  reminderMinuteLabel: "मिनट",
};

export default settings;
