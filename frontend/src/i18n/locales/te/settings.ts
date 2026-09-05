const settings = {
  // ── SettingsScreen ────────────────────────────────────────────────────────
  title: 'సెట్టింగ్స్',
  language: 'భాష',
  languageDesc: 'మీకు నచ్చిన యాప్ భాషను ఎంచుకోండి',
  appPreferences: 'యాప్ ప్రాధాన్యతలు',
  offlineSync: 'ఆఫ్‌లైన్ సింక్',
  offlineSyncDesc: 'ఆఫ్‌లైన్ వాడకానికి డేటా కాష్ చేయు',
  notifications: 'నోటిఫికేషన్లు',
  pushNotifications: 'పుష్ నోటిఫికేషన్లు',
  pushNotificationsDesc: 'నీటి నాణ్యత & దాణా హెచ్చరికలు',
  emailSummaries: 'ఇమెయిల్ సారాంశాలు',
  emailSummariesDesc: 'వారపు పనితీరు నివేదికలు',
  security: 'భద్రత',
  twoFactor: 'రెండు-దశల ప్రమాణీకరణ',
  about: 'Neerani గురించి',
  privacyPolicy: 'గోప్యతా విధానం',
  termsOfService: 'సేవా నిబంధనలు',

  // ── ProfileScreen ─────────────────────────────────────────────────────────
  profile: 'ప్రొఫైల్',
  editProfile: 'ప్రొఫైల్ మార్చు',
  linkTruecaller: 'మీ ఫోన్‌ను లింక్ చేయండి (Truecaller)',
  linkTruecallerUnavailable:
    'Truecaller అందుబాటులో లేదు. Truecaller యాప్‌ను తెరిచి, సైన్ ఇన్ చేసి, మళ్లీ ప్రయత్నించండి.',
  phoneLinked: 'ఫోన్ నంబర్ లింక్ చేయబడింది',
  phoneAlreadyLinked: 'ఆ నంబర్ ఇప్పటికే మరో ఖాతాకు లింక్ చేయబడింది.',
  linkTruecallerFailed: 'మీ నంబర్‌ను లింక్ చేయలేకపోయాం. దయచేసి మళ్లీ ప్రయత్నించండి.',
  emailAddress: 'ఇమెయిల్ చిరునామా',
  fullName: 'పూర్తి పేరు',
  phoneNumber: 'ఫోన్ నంబర్',
  memberSince: 'సభ్యత్వం నుండి',
  firstNameLabel: 'మొదటి పేరు',
  firstNamePlaceholder: 'మొదటి పేరు నమోదు చేయండి',
  lastNameLabel: 'చివరి పేరు',
  lastNamePlaceholder: 'చివరి పేరు నమోదు చేయండి',
  phonePlaceholder: 'ఫోన్ నంబర్ నమోదు చేయండి',
  profileUpdated: 'ప్రొఫైల్ విజయవంతంగా నవీకరించబడింది',
  profileUpdateFailed: 'ప్రొఫైల్ నవీకరించడం విఫలమైంది',
  profileLoadError: 'ప్రొఫైల్ లోడ్ కాలేదు',
  profileNotSet: 'సెట్ చేయలేదు',

  // ── HelpScreen ────────────────────────────────────────────────────────────
  helpAndSupport: 'సహాయం & మద్దతు',
  helpIntroTitle: 'మేము ఎలా సహాయపడగలం?',
  helpIntroText:
    'Neerani మీ రొయ్యల జలకృషి నిర్వహణ సహాయకుడు. దీన్ని బాగా ఉపయోగించుకోవడానికి ఇది చదవండి.',
  quickGuides: 'త్వరిత మార్గదర్శకాలు',
  contactUs: 'మాను సంప్రదించండి',
  // Help topic titles
  helpTopicWaterTitle: 'నీటి నాణ్యత పర్యవేక్షణ',
  helpTopicWaterDesc:
    'ప్రతిరోజూ pH, DO, ఉష్ణోగ్రత, లవణీయత మరియు ఇతర పారామీటర్లు నమోదు చేయండి. విలువలు సరైన పరిధి దాటినప్పుడు హెచ్చరికలు అందుకోండి.',
  helpTopicFeedTitle: 'దాణా నిర్వహణ',
  helpTopicFeedDesc:
    'దాణా వాడకాన్ని ట్రాక్ చేయండి, MBW ఆధారంగా రోజువారీ దాణా పరిమాణాలు లెక్కించండి, దాణా సమర్థత (FCR) పర్యవేక్షించండి.',
  helpTopicSamplingTitle: 'శాంపిలింగ్ రికార్డులు',
  helpTopicSamplingDesc:
    'క్రమం తప్పకుండా శాంపిలింగ్ బయోమాస్, మనుగడ రేటు మరియు సగటు శరీర బరువు (ABW/MBW) అంచనా వేయడంలో సహాయపడుతుంది.',
  helpTopicCalculatorsTitle: 'కాల్క్యులేటర్లు',
  helpTopicCalculatorsDesc:
    'FCR, దాణా పరిమాణాలు, ఉత్పత్తి మోతాదు మరియు స్వేచ్ఛ అమ్మోనియా లెక్కింపులకు అంతర్నిర్మిత కాల్క్యులేటర్లు వాడండి.',
  helpTopicSimulationsTitle: 'సిమ్యులేషన్లు',
  helpTopicSimulationsDesc:
    'పంట తేదీలు, అంచనా దిగుబడులు మరియు సాగు వ్యూహాలను అనుకూలపరచడానికి వృద్ధి సిమ్యులేషన్లు నడపండి.',
  helpTopicFarmTitle: 'ఫారం నిర్వహణ',
  helpTopicFarmDesc:
    'చెరువులను నిర్వహించండి, సైకిళ్ళు మేనేజ్ చేయండి, ఇన్వెంటరీ ట్రాక్ చేయండి మరియు ఫారం వారీ ఆర్థిక నివేదికలు చూడండి.',

  // ── AboutScreen ───────────────────────────────────────────────────────────
  aboutUpcheck: 'Neerani గురించి',
  appTagline: 'రొయ్యల జలకృషి నిర్వహణ',
  versionLabel: 'వెర్షన్',
  buildInfo: 'బిల్డ్ 2026.04.30',
  descriptionLabel: 'వివరణ',
  descriptionText:
    'Neerani అనేది రైతులు నీటి నాణ్యత పర్యవేక్షించడానికి, దాణా నిర్వహించడానికి, వృద్ధిని ట్రాక్ చేయడానికి మరియు సాగు పద్ధతులను అనుకూలపరచడానికి రూపొందించిన సమగ్ర రొయ్యల జలకృషి నిర్వహణ అనువర్తనం.',
  featuresLabel: 'ఫీచర్లు',
  featureMultiFarm: 'బహు-ఫారం నిర్వహణ',
  featurePondMonitoring: 'చెరువు పర్యవేక్షణ & లాగ్లు',
  featureWaterQuality: 'నీటి నాణ్యత ట్రాకింగ్',
  featureFeedManagement: 'దాణా నిర్వహణ',
  featureGrowthSimulations: 'వృద్ధి సిమ్యులేషన్లు',
  featureFinancialReports: 'ఆర్థిక నివేదికలు',
  developedByLabel: 'అభివృద్ధి చేసినవారు',
  developedByTeam: 'Neerani బృందం',
  developedByLocation: 'భారతదేశం',
  footerCopyright: '© 2026 Neerani. అన్ని హక్కులు రిజర్వు చేయబడ్డాయి.',

  // ── TwoFactorScreen ───────────────────────────────────────────────────────
  twoFactorTitle: 'రెండు-దశల ప్రమాణీకరణ',
  twoFactorEnabled: 'ప్రారంభించబడింది',
  twoFactorNotEnabled: 'ప్రారంభించబడలేదు',
  twoFactorSetup: '2FA సెటప్ చేయి',
  twoFactorScanHelp:
    'ఆథెంటికేటర్ యాప్‌తో (Google Authenticator, Authy…) ఈ QR కోడ్ స్కాన్ చేయండి, తర్వాత పూర్తి చేయడానికి జనరేట్ అయిన కోడ్ నమోదు చేయండి.',
  twoFactorManualKey: 'మాన్యువల్ కీ: {{secret}}',
  twoFactorCodeLabel: 'యాప్ నుండి కోడ్',
  twoFactorVerifyEnable: 'ధృవీకరించి ప్రారంభించు',
  twoFactorDisableHelp: 'రెండు-దశల ప్రమాణీకరణ ఆపివేయడానికి ప్రస్తుత కోడ్ నమోదు చేయండి.',
  twoFactorAuthCodeLabel: 'ఆథెంటికేటర్ కోడ్',
  twoFactorDisable: '2FA ఆపివేయి',
  twoFactorInvalidCode: 'మీ ఆథెంటికేటర్ యాప్ నుండి 6-అంకెల కోడ్ నమోదు చేయండి.',
  twoFactorCodeRequired: '2FA ఆపివేయడానికి ప్రస్తుత 6-అంకెల కోడ్ నమోదు చేయండి.',
  twoFactorEnabledSuccess: 'రెండు-దశల ప్రమాణీకరణ ఇప్పుడు ఆన్ అయింది.',
  twoFactorDisabledSuccess: 'రెండు-దశల ప్రమాణీకరణ ఇప్పుడు ఆఫ్ అయింది.',
  twoFactorSetupError: '2FA సెటప్ ప్రారంభించడం సాధ్యపడలేదు',

  // ── Backup codes (AUTH-4) ──
  twoFactorBackupTitle: 'మీ బ్యాకప్ కోడ్‌లను సేవ్ చేయండి',
  twoFactorBackupHelp:
    'ఈ ఒక్కసారి కోడ్‌లను సురక్షితమైన చోట ఉంచండి. మీ అథెంటికేటర్ యాప్‌కు యాక్సెస్ కోల్పోతే ప్రతి ఒక్కటి ఒకసారి పనిచేస్తుంది. ఇవి మళ్లీ చూపబడవు.',
  twoFactorBackupCopy: 'కోడ్‌లను కాపీ చేయండి',
  twoFactorBackupAck: 'నేను వాటిని సేవ్ చేసాను',
  twoFactorBackupCopied: 'బ్యాకప్ కోడ్‌లు క్లిప్‌బోర్డ్‌కు కాపీ చేయబడ్డాయి.',
  twoFactorRegenerateHelp:
    'కొత్త బ్యాకప్ కోడ్‌ల సెట్‌ను రూపొందించండి. మీ పాత కోడ్‌లు పనిచేయడం ఆగిపోతాయి.',
  twoFactorRegenerate: 'బ్యాకప్ కోడ్‌లను మళ్లీ రూపొందించండి',

  // ── NotificationsScreen ───────────────────────────────────────────────────
  notificationsTitle: 'నోటిఫికేషన్లు',
  notificationsEmpty: 'అన్నీ చదివారు!',
  notificationsEmptyDesc: 'మీకు కొత్త నోటిఫికేషన్లు లేవు.',
  notificationsLoadError: 'నోటిఫికేషన్లు లోడ్ కాలేదు',
  deleteAccount: "ఖాతాను తొలగించు",
  deleteAccountConfirm: "ఇది మీ ఖాతాను మరియు అన్ని వ్యవసాయ డేటాను శాశ్వతంగా తొలగిస్తుంది. దీన్ని రద్దు చేయలేరు. కొనసాగించాలా?",
  deleteAccountHint: "మీ ఖాతాను మరియు మీకు చెందిన మొత్తం డేటాను శాశ్వతంగా తొలగిస్తుంది.",
  deleteAccountTitle: 'ఖాతాను తొలగించండి',
  deleteAccountWarningTitle: 'దీన్ని రద్దు చేయలేరు',
  deleteAccountWarningBody: 'మీ ఖాతాను తొలగించడం వల్ల అది మరియు మీకు చెందిన మొత్తం డేటా శాశ్వతంగా తొలగించబడుతుంది. మీరు వెంటనే సైన్ అవుట్ చేయబడతారు.',
  deleteAccountWhatTitle: 'ఏమి తొలగించబడుతుంది',
  deleteAccountItemFarms: 'మీకు చెందిన అన్ని ఫారమ్‌లు, వాటి చెరువులు మరియు చక్రాలు',
  deleteAccountItemLogs: 'అన్ని నీరు, మేత, నమూనా మరియు ఆరోగ్య రికార్డులు',
  deleteAccountItemFinance: 'అన్ని ఆర్థిక రికార్డులు, ఇన్వెంటరీ మరియు నివేదికలు',
  deleteAccountItemTeam: 'ఇతర ఫారమ్‌లలో మీ బృంద సభ్యత్వాలు',
  deleteAccountReuseNote: 'మీ ఇమెయిల్ విడుదల చేయబడుతుంది — మీరు తర్వాత కొత్త వినియోగదారుగా మళ్లీ సైన్ అప్ చేయవచ్చు.',
  deleteConfirmPrompt: 'నిర్ధారించడానికి, క్రింది వచనాన్ని సరిగ్గా టైప్ చేయండి:',
  deleteConfirmLabel: 'నిర్ధారణ',
  deleteConfirmWord: 'DELETE',
  deletePasswordLabel: 'మీ పాస్‌వర్డ్',
  deletePasswordHint: 'ఇది మీరేనని నిర్ధారించడానికి మీ పాస్‌వర్డ్‌ను నమోదు చేయండి.',
  deleteAccountButton: 'నా ఖాతాను శాశ్వతంగా తొలగించండి',
  deleteAccountWrongPassword: 'పాస్‌వర్డ్ తప్పు.',
  deleteAccountError:"మీ ఖాతాను తొలగించలేకపోయాం. దయచేసి మళ్లీ ప్రయత్నించండి.",

  // Settings — artboard p6
  accountEyebrow: "{{name}} · అప్‌చెక్",
  edit: "సవరించు",
  ownerOfFarms: "{{count}} ఫారంల యజమాని",
  ownerOfFarms_one: "{{count}} ఫారం యజమాని",
  languageWholeApp: "వర్కర్లు చూసేది సహా, యాప్ మొత్తం మారుతుంది.",
  signOutConfirm: "ఈ పరికరంలో అప్‌చెక్ నుండి సైన్ అవుట్ చేయాలా?",
  toolsSection: "సాధనాలు",
  farmSection: "ఫారం",

  // ── రిమైండర్ సమయాలు (స్మార్ట్ రిమైండర్లు) ────────────────────────────
  reminderTimes: "రిమైండర్ సమయాలు",
  reminderTimesDesc: "నీటి నాణ్యతను నమోదు చేయడానికి Neerani మిమ్మల్ని ఎప్పుడు గుర్తు చేయాలో ఎంచుకోండి.",
  reminderMorning: "ఉదయం తనిఖీ",
  reminderAfternoon: "మధ్యాహ్నం తనిఖీ",
  reminderEvening: "సాయంత్రం తనిఖీ",
  reminderChemistry: "వారపు రసాయన తనిఖీ",
  reminderHourLabel: "గంట",
  reminderMinuteLabel: "నిమిషం",
  reminderStatusOn: "రిమైండర్లు ఆన్‌లో ఉన్నాయి. తదుపరిది: {{when}}",
  reminderStatusOff: "ప్రస్తుతం ఏ రిమైండర్ సెట్ కాలేదు. ఒక చెరువును జోడించి, Neerani ఒకసారి తెరిస్తే అవి సెట్ అవుతాయి.",
  reminderStatusBlocked: "ఈ ఫోన్‌లో Neerani నోటిఫికేషన్లు చూపలేదు, కాబట్టి రిమైండర్లు రావు.",
  reminderStatusOpenSettings: "ఫోన్ సెట్టింగ్‌లు తెరవండి",
  reminderWhenToday: "ఈరోజు {{time}} గంటలకు",
  reminderWhenTomorrow: "రేపు {{time}} గంటలకు",
  reminderWhenOn: "{{date}} న {{time}} గంటలకు",

  // ── గోప్యత: క్రాష్ నివేదికలు మరియు వాడుక సమాచారం ──────────────────────────
  privacySection: "గోప్యత",
  crashReportsToggle: "క్రాష్ నివేదికలు",
  crashReportsDesc:
    "ఆన్‌లో ఉంది — మీరు చెప్పకముందే లోపాన్ని సరిచేయడానికి. ఈ నివేదికల్లో మీ ఫోన్ నంబర్, ఇమెయిల్, పాస్‌వర్డ్, డబ్బు లెక్కలు లేదా వ్యవసాయ రికార్డులు ఉండవు. మీరు దీన్ని ఆపవచ్చు.",
  analyticsToggle: "వాడుక సమాచారం",
  analyticsToggleDesc:
    "మీరు ఆన్ చేసే వరకు ఆఫ్‌లోనే ఉంటుంది. ఏ స్క్రీన్లు వాడుతున్నారో తెలుపుతుంది, సరైనవి తయారుచేయడానికి. మీ చెరువు, డబ్బు, పంట సమాచారం ఎప్పుడూ పంపబడదు.",
  analyticsPromptTitle: "మీరు ఏ స్క్రీన్లు వాడుతున్నారో మేము చూడవచ్చా?",
  analyticsPromptBody:
    "ఏది వాడటం కష్టంగా ఉందో సరిచేయడానికి ఇది సహాయపడుతుంది. మేము స్క్రీన్ పేరు మాత్రమే పంపుతాము — మీ చెరువులు, డబ్బు లేదా పంట లెక్కలు ఎప్పుడూ కాదు. మీరు ఏమి చెప్పినా యాప్‌లో అంతా ఒకేలా పనిచేస్తుంది.",
  analyticsPromptAllow: "సరే, ఫర్వాలేదు",
  analyticsPromptDecline: "వద్దు, ధన్యవాదాలు",
};

export default settings;
