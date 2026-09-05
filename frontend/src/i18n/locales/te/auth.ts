const auth = {
    continueWithGoogle: "Googleతో కొనసాగండి",
    continueWithTruecaller: "Truecallerతో కొనసాగండి",
  // ── App header (LoginScreen) ──────────────────────────────────────────────
  title: 'Neerani',
  subtitle: 'రొయ్యల జలకృషి నిర్వహణ',

  // ── Shared field labels / placeholders ───────────────────────────────────
  emailLabel: 'ఇమెయిల్',
  emailPlaceholder: 'your@email.com',
  passwordLabel: 'పాస్‌వర్డ్',
  passwordPlaceholder: 'మీ పాస్‌వర్డ్ నమోదు చేయండి',

  // ── Shared validation messages ────────────────────────────────────────────
  emailRequired: 'ఇమెయిల్ తప్పనిసరి',
  emailInvalid: 'చెల్లుబాటు అయ్యే ఇమెయిల్ నమోదు చేయండి',
  passwordRequired: 'పాస్‌వర్డ్ తప్పనిసరి',

  // ── LoginScreen ───────────────────────────────────────────────────────────
  signIn: 'సైన్ ఇన్',
  orContinueWith: 'లేదా దీంతో కొనసాగండి',
  forgotPassword: 'పాస్‌వర్డ్ మర్చిపోయారా?',
  signInWithEmailCode: 'ఇమెయిల్ కోడ్‌తో సైన్ ఇన్',
  createAccount: 'ఖాతా సృష్టించు',

  // Verify-email banner (shown when pendingVerificationEmail is set)
  verifyBanner: 'సైన్ అప్ పూర్తి చేయడానికి {{email}} ధృవీకరించండి. రీసెండ్ చేయడానికి ట్యాప్ చేయండి.',

  // Resend-verification alerts
  emailRequiredAlert: 'ఇమెయిల్ అవసరం',
  enterEmailFirst: 'పైన మీ ఇమెయిల్ ముందు నమోదు చేయండి.',
  verificationSent: 'ధృవీకరణ పంపబడింది',
  verificationResentTo: 'మేము {{email}}కి ధృవీకరణ ఇమెయిల్ మళ్ళీ పంపాము.',
  couldNotResend: 'ధృవీకరణ ఇమెయిల్ రీసెండ్ చేయడం సాధ్యపడలేదు',

  // Login-time validation
  passwordTooShort: 'పాస్‌వర్డ్ కనీసం 6 అక్షరాలు ఉండాలి',

  // ── RegisterScreen ────────────────────────────────────────────────────────
  createAccountTitle: 'ఖాతా సృష్టించు',
  registerSubtitle: 'మీ రొయ్యల ఫారాలను నిర్వహించడానికి Neerani లో చేరండి',

  firstNameLabel: 'మొదటి పేరు',
  firstNamePlaceholder: 'మీ మొదటి పేరు నమోదు చేయండి',
  firstNameRequired: 'మొదటి పేరు తప్పనిసరి',

  lastNameLabel: 'చివరి పేరు',
  lastNamePlaceholder: 'మీ చివరి పేరు నమోదు చేయండి',

  passwordAtLeast8Placeholder: 'కనీసం 8 అక్షరాలు',
  passwordTooShortRegister: 'పాస్‌వర్డ్ కనీసం 8 అక్షరాలు ఉండాలి',
  passwordHint: '8+ అక్షరాలు — ఒక పెద్ద & చిన్న అక్షరం, ఒక సంఖ్య, ఒక ప్రత్యేక గుర్తు',
  passwordRuleLength: 'కనీసం 8 అక్షరాలు ఉపయోగించండి',
  passwordRuleLower: 'ఒక చిన్న అక్షరాన్ని జోడించండి',
  passwordRuleUpper: 'ఒక పెద్ద అక్షరాన్ని జోడించండి',
  passwordRuleDigit: 'ఒక సంఖ్యను జోడించండి',
  passwordRuleSpecial: 'ఒక ప్రత్యేక గుర్తును జోడించండి (ఉదా. # @ ! -)',

  confirmPasswordLabel: 'పాస్‌వర్డ్ నిర్ధారించు',
  confirmPasswordPlaceholder: 'పాస్‌వర్డ్ మళ్ళీ నమోదు చేయండి',
  passwordsDoNotMatch: 'పాస్‌వర్డ్‌లు సరిపోలడం లేదు',

  alreadyHaveAccount: 'ఇప్పటికే ఖాతా ఉందా? సైన్ ఇన్',

  // Registration success screen
  checkYourEmail: 'మీ ఇమెయిల్ తనిఖీ చేయండి',
  verificationLinkSent:
    '{{email}}కి ధృవీకరణ లింక్ పంపబడింది. కొనసాగడానికి మీ ఇమెయిల్ ధృవీకరించండి.',
  backToLogin: 'లాగిన్‌కు తిరిగి వెళ్ళు',

  // ── ForgotPasswordScreen ──────────────────────────────────────────────────
  resetPassword: 'పాస్‌వర్డ్ రీసెట్',
  resetPasswordSubtitle:
    'మీ ఇమెయిల్ చిరునామా నమోదు చేయండి, పాస్‌వర్డ్ రీసెట్ చేయడానికి లింక్ పంపుతాము.',
  sendResetLink: 'రీసెట్ లింక్ పంపు',
  failedToSendReset: 'రీసెట్ ఇమెయిల్ పంపడం విఫలమైంది',
  passwordResetSent:
    '{{email}}కి పాస్‌వర్డ్ రీసెట్ లింక్ పంపబడింది. పాస్‌వర్డ్ రీసెట్ చేయడానికి ఇమెయిల్‌లోని సూచనలు పాటించండి.',

  // ── OtpLoginScreen ────────────────────────────────────────────────────────
  signInWithEmailCodeTitle: 'ఇమెయిల్ కోడ్‌తో సైన్ ఇన్',
  emailRequiredBody: 'మీ ఖాతా ఇమెయిల్ నమోదు చేయండి.',
  codeSent: 'కోడ్ పంపబడింది',
  checkEmailForCode: 'లాగిన్ కోసం 6-అంకెల కోడ్ మీ ఇమెయిల్‌లో తనిఖీ చేయండి.',
  couldNotSendCode: 'కోడ్ పంపడం సాధ్యపడలేదు',
  noSessionReturned: 'సెషన్ రాలేదు. దయచేసి మళ్ళీ ప్రయత్నించండి.',
  invalidOrExpiredCode: 'చెల్లని లేదా గడువు మించిన కోడ్',
  invalidCode: 'చెల్లని కోడ్',
  enterSixDigitCode: 'మీ ఇమెయిల్‌లోని 6-అంకెల కోడ్ నమోదు చేయండి.',
  sixDigitCodeLabel: '6-అంకెల కోడ్',
  sendCode: 'కోడ్ పంపు',
  verifyAndSignIn: 'ధృవీకరించి సైన్ ఇన్ చేయి',
  resendCode: 'కోడ్ మళ్ళీ పంపు',

  // ── TwoFactorChallengeScreen ──────────────────────────────────────────────
  twoFactorTitle: 'రెండు-దశల ధృవీకరణ',
  twoFactorHelp:
    'సైన్ ఇన్ పూర్తి చేయడానికి మీ ఆథెంటికేటర్ యాప్ నుండి 6-అంకెల కోడ్ నమోదు చేయండి.',
  authenticatorCodeLabel: 'ఆథెంటికేటర్ కోడ్',
  invalidCodeAlert: 'మీ ఆథెంటికేటర్ యాప్ నుండి 6-అంకెల కోడ్ నమోదు చేయండి.',
  noSessionSignInAgain: 'సెషన్ రాలేదు. దయచేసి మళ్ళీ సైన్ ఇన్ చేయండి.',
  invalidVerificationCode: 'చెల్లని ధృవీకరణ కోడ్',

  // ── Backup codes (AUTH-4) ──
  twoFactorBackupHelp: 'సైన్ ఇన్ పూర్తి చేయడానికి మీరు సేవ్ చేసిన బ్యాకప్ కోడ్‌లలో ఒకదాన్ని నమోదు చేయండి.',
  backupCodeLabel: 'బ్యాకప్ కోడ్',
  useBackupCode: 'బదులుగా బ్యాకప్ కోడ్‌ను ఉపయోగించండి',
  useAuthenticatorInstead: 'బదులుగా అథెంటికేటర్ యాప్‌ను ఉపయోగించండి',
  verify: 'ధృవీకరించు',

  // ── TruecallerLoginScreen ─────────────────────────────────────────────────
  truecallerTitle: 'Truecaller తో సైన్ ఇన్',
  truecallerSubtitle: 'సెకన్లలో మీ భారతీయ మొబైల్ నంబర్‌తో ధృవీకరించండి.',
  requestPhonePermissions:
    'మీ నంబర్ ధృవీకరించడానికి ఫోన్ అనుమతులు అభ్యర్థిస్తాము.',
  permissionsRequired:
    'Truecaller{{suffix}} తో కొనసాగడానికి ఫోన్ అనుమతులు అవసరం. సెట్టింగ్స్‌లో మంజూరు చేయండి లేదా ఇమెయిల్‌తో సైన్ ఇన్ చేయండి.',
  loginFailed: 'లాగిన్ విఫలమైంది',
  noSessionByServer: 'సర్వర్ నుండి సెషన్ రాలేదు.',
  networkError: 'నెట్‌వర్క్ లోపం',
  truecallerAuthFailed: 'Truecaller ప్రమాణీకరణ విఫలమైంది',
  verificationFailed: 'ధృవీకరణ విఫలమైంది',
  missingAccessToken: 'Truecaller నుండి యాక్సెస్ టోకెన్ లేదు.',
  incompleteSignedPayload: 'Truecaller నుండి అసంపూర్ణ సైన్డ్ పేలోడ్.',
  truecallerCannotVerify: 'Truecaller నంబర్ ధృవీకరించలేకపోయింది.',
  unknownError: 'తెలియని లోపం',
  networkCheckMessage:
    'ఇంటర్నెట్ కనెక్షన్ లేదు. మీ నెట్‌వర్క్ తనిఖీ చేసి మళ్ళీ ప్రయత్నించండి',
  truecallerErrorPrefix: 'Truecaller లోపం: ',
  waitingForMissedCall: 'మిస్డ్ కాల్ కోసం వేచి ఉంది',
  missedCallBody:
    'మీకు త్వరలో మిస్డ్ కాల్ వస్తుంది. తీసుకోకండి — Truecaller స్వయంచాలకంగా ధృవీకరిస్తుంది.',
  expiresIn: '{{seconds}}s లో గడువు ముగుస్తుంది',
  verifyingWithUpcheck: 'Neerani తో ధృవీకరిస్తోంది...',
  signInWithEmail: 'ఇమెయిల్‌తో సైన్ ఇన్',
  truecallerNoSession: 'సర్వర్ సెషన్‌ను అందించలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.',
  truecallerVerificationFailed: 'Truecaller ధృవీకరణ విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.',
  networkErrorBody: 'సర్వర్‌ను చేరుకోలేకపోయాం. దయచేసి మళ్లీ ప్రయత్నించండి.',
  serverError: 'ఏదో తప్పు జరిగింది',
  serverErrorBody: 'సర్వర్ సైన్-ఇన్ పూర్తి చేయలేకపోయింది. మళ్లీ ప్రయత్నించండి, లేదా పదే పదే జరిగితే సపోర్ట్ బృందాన్ని సంప్రదించండి.',

  // ── Truecaller మిస్డ్-కాల్ / OTP (Truecaller కాని యూజర్) ఫ్లో ─────────────
  tcFallbackCta: 'Truecaller యాప్ లేదా? మిస్డ్ కాల్‌తో ధృవీకరించండి',
  tcPhoneTitle: 'మీ నంబర్‌ను ధృవీకరించండి',
  tcPhoneSubtitle:
    'మీ నంబర్‌ను ధృవీకరించడానికి మేము ఒక చిన్న మిస్డ్ కాల్ చేస్తాం — ఏదీ టైప్ చేయాల్సిన అవసరం లేదు.',
  tcPhoneLabel: 'మొబైల్ నంబర్',
  tcFirstNameLabel: 'మొదటి పేరు',
  tcFirstNamePlaceholder: 'ఉదా. ఆరవ్',
  tcLastNameLabel: 'ఇంటిపేరు (ఐచ్ఛికం)',
  tcLastNamePlaceholder: 'ఉదా. శర్మ',
  tcSendVerification: 'మిస్డ్ కాల్‌తో ధృవీకరించండి',
  tcCallingTitle: 'మీకు కాల్ చేస్తున్నాం…',
  tcCallingBody:
    'మేము {{phone}}కు ఒక చిన్న కాల్ చేస్తున్నాం. తీయవద్దు — మేము దానిని ఆటోమేటిక్‌గా గుర్తిస్తాం.',
  tcOtpBody: '{{phone}}కు పంపిన కోడ్‌ను నమోదు చేయండి.',
  tcVerify: 'ధృవీకరించండి',
  tcChangeNumber: 'వేరే నంబర్‌ను ఉపయోగించండి',
  tcInvalidPhone: 'చెల్లుబాటు అయ్యే 10-అంకెల మొబైల్ నంబర్‌ను నమోదు చేయండి.',
  tcFirstNameRequired: 'దయచేసి మీ మొదటి పేరును నమోదు చేయండి.',
  tcInvalidOtp: 'మీకు వచ్చిన కోడ్‌ను నమోదు చేయండి.',
  tcVerificationFailed: 'ధృవీకరణ విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.',
  tcPermissionsRequired:
    'ధృవీకరణ కాల్‌ను ఆటోమేటిక్‌గా గుర్తించడానికి ఫోన్ మరియు కాల్-లాగ్ అనుమతులు అవసరం. దయచేసి వాటిని ఇవ్వండి, లేదా Truecaller / ఇమెయిల్‌తో సైన్ ఇన్ చేయండి.',
  tcNoCallDetected:
    'ధృవీకరణ కాల్‌ను మేము గుర్తించలేకపోయాం. ఈ నంబర్ ఇప్పటికే Truecaller ఉపయోగిస్తే, వెనక్కి వెళ్లి వన్-ట్యాప్ సైన్-ఇన్ వాడండి — లేదా వేరే నంబర్‌ను ప్రయత్నించండి.',
  tcUnsupported:
    'మిస్డ్-కాల్ ధృవీకరణ Truecaller SDK కలిగిన Android యాప్ బిల్డ్‌లో మాత్రమే అందుబాటులో ఉంటుంది.',

  // ── OtpEntrySection ───────────────────────────────────────────────────────
  enterOtpTitle: 'OTP నమోదు చేయండి',
  otpSubtitle:
    'మీ ఫోన్‌కు ధృవీకరణ కోడ్ పంపాము. కొనసాగడానికి దిగువ నమోదు చేయండి.',
  otpExpired: 'OTP గడువు ముగిసింది',
  otpExpiresIn: '{{time}} లో గడువు ముగుస్తుంది',
  otpLabel: 'OTP',
  otpPlaceholder: 'కోడ్ నమోదు చేయండి',
  invalidOtp: 'చెల్లని OTP',
  resendOtp: 'OTP మళ్ళీ పంపు',
  resendOtpIn: '{{time}} లో OTP మళ్ళీ పంపు',
  verificationFailedError: 'ధృవీకరణ విఫలమైంది',

  // ── PhoneEntrySection ─────────────────────────────────────────────────────
  verifyPhoneTitle: 'మీ ఫోన్ నంబర్ ధృవీకరించండి',
  verifyPhoneSubtitle:
    'మీ భారతీయ మొబైల్ నంబర్‌కు ధృవీకరణ కోడ్ పంపుతాము.',
  firstNameInputLabel: 'మొదటి పేరు',
  firstNameInputPlaceholder: 'మీ మొదటి పేరు',
  lastNameInputLabel: 'చివరి పేరు (ఐచ్ఛికం)',
  lastNameInputPlaceholder: 'మీ చివరి పేరు',
  mobileNumberLabel: 'మొబైల్ నంబర్',
  mobileNumberHint: '10-అంకెల భారతీయ మొబైల్ నంబర్',
  invalidPhoneError: 'చెల్లుబాటు అయ్యే 10-అంకెల భారతీయ మొబైల్ నంబర్ నమోదు చేయండి',
  invalidFirstNameError: 'మీ మొదటి పేరు నమోదు చేయండి',
  sendVerificationCode: 'ధృవీకరణ కోడ్ పంపు',
  consentPrefix: "ఖాతాను సృష్టించడం ద్వారా, మీరు మా",
  legalPrefix: "కొనసాగించడం ద్వారా, మీరు మా",
  consentAnd: "మరియు",

  // ── Account type selection ────────────────────────────────────────────────
  signupIntentLabel: 'మీరు దేని కోసం వచ్చారు?',
  signupIntentRequired: 'దయచేసి ఒకటి ఎంచుకోండి',
  intentOwnFarmTitle: 'నేను నా సొంత ఫారం నడుపుతాను',
  intentOwnFarmDesc: 'మీ ఫారం, చెరువులు సెటప్ చేయండి',
  intentWorkOnFarmTitle: 'నేను ఇతరుల ఫారంలో పని చేస్తాను',
  intentWorkOnFarmDesc: 'చేరడానికి వారి కోడ్ నమోదు చేయండి',

  // Create-account screen (artboard 04)
  fullNameLabel: "పూర్తి పేరు",
  fullNamePlaceholder: "మీ పేరు",
  fullNameRequired: "మీ పేరు నమోదు చేయండి",
  emailVerifyNote: "ఈ చిరునామాకు మేము ధృవీకరణ లింక్ పంపుతాము.",
  orDivider: "లేదా",
  signInPrompt: "ఇప్పటికే ఖాతా ఉందా?",
};
export default auth;
