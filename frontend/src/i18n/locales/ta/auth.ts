const auth = {
    continueWithGoogle: "Google மூலம் தொடரவும்",
    continueWithTruecaller: "Truecaller மூலம் தொடரவும்",
  // ── App header (LoginScreen) ──────────────────────────────────────────────
  title: 'Neerani',
  subtitle: 'இறால் மீன்வளர்ப்பு மேலாண்மை',

  // ── Shared field labels / placeholders ───────────────────────────────────
  emailLabel: 'மின்னஞ்சல்',
  emailPlaceholder: 'your@email.com',
  passwordLabel: 'கடவுச்சொல்',
  passwordPlaceholder: 'உங்கள் கடவுச்சொல்லை உள்ளிடுக',

  // ── Shared validation messages ────────────────────────────────────────────
  emailRequired: 'மின்னஞ்சல் தேவை',
  emailInvalid: 'சரியான மின்னஞ்சல் உள்ளிடுக',
  passwordRequired: 'கடவுச்சொல் தேவை',

  // ── LoginScreen ───────────────────────────────────────────────────────────
  signIn: 'உள்நுழை',
  orContinueWith: 'அல்லது இதன் மூலம் தொடர்க',
  forgotPassword: 'கடவுச்சொல் மறந்துவிட்டீர்களா?',
  signInWithEmailCode: 'மின்னஞ்சல் குறியீட்டால் உள்நுழை',
  createAccount: 'கணக்கு உருவாக்கு',

  // Verify-email banner (shown when pendingVerificationEmail is set)
  verifyBanner: '{{email}} சரிபார்க்க, மின்னஞ்சலை மீண்டும் அனுப்ப தட்டவும்.',

  // Resend-verification alerts
  emailRequiredAlert: 'மின்னஞ்சல் தேவை',
  enterEmailFirst: 'முதலில் உங்கள் மின்னஞ்சலை மேலே உள்ளிடுக.',
  verificationSent: 'சரிபார்ப்பு அனுப்பப்பட்டது',
  verificationResentTo: '{{email}} க்கு சரிபார்ப்பு மின்னஞ்சல் மீண்டும் அனுப்பப்பட்டது.',
  couldNotResend: 'சரிபார்ப்பு மின்னஞ்சலை மீண்டும் அனுப்ப முடியவில்லை',

  // Login-time validation
  passwordTooShort: 'கடவுச்சொல் குறைந்தது 6 எழுத்துகள் இருக்க வேண்டும்',

  // ── RegisterScreen ────────────────────────────────────────────────────────
  createAccountTitle: 'கணக்கு உருவாக்கு',
  registerSubtitle: 'உங்கள் இறால் பண்ணைகளை நிர்வகிக்க Neerani-யில் சேருங்கள்',

  firstNameLabel: 'முதல் பெயர்',
  firstNamePlaceholder: 'உங்கள் முதல் பெயரை உள்ளிடுக',
  firstNameRequired: 'முதல் பெயர் தேவை',

  lastNameLabel: 'கடைசி பெயர்',
  lastNamePlaceholder: 'உங்கள் கடைசி பெயரை உள்ளிடுக',

  passwordAtLeast8Placeholder: 'குறைந்தது 8 எழுத்துகள்',
  passwordTooShortRegister: 'கடவுச்சொல் குறைந்தது 8 எழுத்துகள் இருக்க வேண்டும்',
  passwordHint: '8+ எழுத்துகள் — ஒரு பெரிய & சிறிய எழுத்து, ஒரு எண், ஒரு சிறப்பு குறியீடு',
  passwordRuleLength: 'குறைந்தது 8 எழுத்துகளைப் பயன்படுத்தவும்',
  passwordRuleLower: 'ஒரு சிறிய எழுத்தைச் சேர்க்கவும்',
  passwordRuleUpper: 'ஒரு பெரிய எழுத்தைச் சேர்க்கவும்',
  passwordRuleDigit: 'ஒரு எண்ணைச் சேர்க்கவும்',
  passwordRuleSpecial: 'ஒரு சிறப்பு குறியீட்டைச் சேர்க்கவும் (எ.கா. # @ ! -)',

  confirmPasswordLabel: 'கடவுச்சொல்லை உறுதிப்படுத்து',
  confirmPasswordPlaceholder: 'கடவுச்சொல்லை மீண்டும் உள்ளிடுக',
  passwordsDoNotMatch: 'கடவுச்சொற்கள் பொருந்தவில்லை',

  alreadyHaveAccount: 'ஏற்கனவே கணக்கு உள்ளதா? உள்நுழை',

  // Registration success screen
  checkYourEmail: 'உங்கள் மின்னஞ்சலை சரிபார்க்கவும்',
  verificationLinkSent:
    '{{email}} க்கு சரிபார்ப்பு இணைப்பு அனுப்பப்பட்டது. தொடர மின்னஞ்சலை சரிபார்க்கவும்.',
  backToLogin: 'உள்நுழைவுக்கு திரும்பு',

  // ── ForgotPasswordScreen ──────────────────────────────────────────────────
  resetPassword: 'கடவுச்சொல்லை மீட்டமை',
  resetPasswordSubtitle:
    'உங்கள் மின்னஞ்சல் முகவரியை உள்ளிடுக; கடவுச்சொல் மீட்டமைக்க இணைப்பு அனுப்புவோம்.',
  sendResetLink: 'மீட்டமை இணைப்பு அனுப்பு',
  failedToSendReset: 'மீட்டமை மின்னஞ்சல் அனுப்ப முடியவில்லை',
  passwordResetSent:
    '{{email}} க்கு கடவுச்சொல் மீட்டமை இணைப்பு அனுப்பப்பட்டது. மின்னஞ்சலில் உள்ள வழிமுறைகளை பின்பற்றுக.',

  // ── OtpLoginScreen ────────────────────────────────────────────────────────
  signInWithEmailCodeTitle: 'மின்னஞ்சல் குறியீட்டால் உள்நுழை',
  emailRequiredBody: 'உங்கள் கணக்கு மின்னஞ்சலை உள்ளிடுக.',
  codeSent: 'குறியீடு அனுப்பப்பட்டது',
  checkEmailForCode: '6 இலக்க உள்நுழைவு குறியீட்டிற்கு மின்னஞ்சல் சரிபார்க்கவும்.',
  couldNotSendCode: 'குறியீடு அனுப்ப முடியவில்லை',
  noSessionReturned: 'அமர்வு கிடைக்கவில்லை. மீண்டும் முயற்சிக்கவும்.',
  invalidOrExpiredCode: 'தவறான அல்லது காலாவதியான குறியீடு',
  invalidCode: 'தவறான குறியீடு',
  enterSixDigitCode: 'உங்கள் மின்னஞ்சலில் உள்ள 6 இலக்க குறியீட்டை உள்ளிடுக.',
  sixDigitCodeLabel: '6 இலக்க குறியீடு',
  sendCode: 'குறியீடு அனுப்பு',
  verifyAndSignIn: 'சரிபார்த்து உள்நுழை',
  resendCode: 'குறியீட்டை மீண்டும் அனுப்பு',

  // ── TwoFactorChallengeScreen ──────────────────────────────────────────────
  twoFactorTitle: 'இரு-படி சரிபார்ப்பு',
  twoFactorHelp:
    'உள்நுழைவை முடிக்க, அங்கீகரிப்பு ஆப்பிலிருந்து 6 இலக்க குறியீட்டை உள்ளிடுக.',
  authenticatorCodeLabel: 'அங்கீகரிப்பு குறியீடு',
  invalidCodeAlert: 'அங்கீகரிப்பு ஆப்பிலிருந்து 6 இலக்க குறியீட்டை உள்ளிடுக.',
  noSessionSignInAgain: 'அமர்வு கிடைக்கவில்லை. மீண்டும் உள்நுழையவும்.',
  invalidVerificationCode: 'தவறான சரிபார்ப்பு குறியீடு',

  // ── Backup codes (AUTH-4) ──
  twoFactorBackupHelp: 'உள்நுழைவை முடிக்க உங்கள் சேமித்த காப்பு குறியீடுகளில் ஒன்றை உள்ளிடவும்.',
  backupCodeLabel: 'காப்பு குறியீடு',
  useBackupCode: 'மாற்றாக காப்பு குறியீட்டைப் பயன்படுத்தவும்',
  useAuthenticatorInstead: 'மாற்றாக அங்கீகரிப்பு பயன்பாட்டைப் பயன்படுத்தவும்',
  verify: 'சரிபார்',

  // ── TruecallerLoginScreen ─────────────────────────────────────────────────
  truecallerTitle: 'Truecaller மூலம் உள்நுழை',
  truecallerSubtitle: 'உங்கள் இந்திய மொபைல் எண்ணால் சில நொடிகளில் சரிபார்க்கவும்.',
  requestPhonePermissions:
    'உங்கள் எண்ணை சரிபார்க்க தொலைபேசி அனுமதிகளை கேட்போம்.',
  permissionsRequired:
    'Truecaller{{suffix}} மூலம் தொடர தொலைபேசி அனுமதிகள் தேவை. அமைப்புகளில் வழங்கவும் அல்லது மின்னஞ்சல் மூலம் உள்நுழையவும்.',
  loginFailed: 'உள்நுழைவு தோல்வியடைந்தது',
  noSessionByServer: 'சேவையகத்திலிருந்து அமர்வு கிடைக்கவில்லை.',
  networkError: 'நெட்வொர்க் பிழை',
  truecallerAuthFailed: 'Truecaller அங்கீகரிப்பு தோல்வியடைந்தது',
  verificationFailed: 'சரிபார்ப்பு தோல்வியடைந்தது',
  missingAccessToken: 'Truecaller-இலிருந்து அணுகல் டோக்கன் இல்லை.',
  incompleteSignedPayload: 'Truecaller-இலிருந்து முழுமையற்ற கையொப்பமிட்ட தரவு.',
  truecallerCannotVerify: 'Truecaller எண்ணை சரிபார்க்க முடியவில்லை.',
  unknownError: 'தெரியாத பிழை',
  networkCheckMessage:
    'இணைய இணைப்பு இல்லை. நெட்வொர்க்கை சரிபார்த்து மீண்டும் முயற்சிக்கவும்',
  truecallerErrorPrefix: 'Truecaller பிழை: ',
  waitingForMissedCall: 'மிஸ்டு கால் காத்திருக்கிறது',
  missedCallBody:
    'விரைவில் ஒரு மிஸ்டு கால் வரும். எடுக்காதீர்கள் — Truecaller தானாக சரிபார்க்கும்.',
  expiresIn: '{{seconds}}வி-ல் காலாவதியாகும்',
  verifyingWithUpcheck: 'Neerani மூலம் சரிபார்க்கிறது...',
  signInWithEmail: 'மின்னஞ்சல் மூலம் உள்நுழை',
  truecallerNoSession: 'சேவையகம் அமர்வை வழங்கவில்லை. மீண்டும் முயற்சிக்கவும்.',
  truecallerVerificationFailed: 'Truecaller சரிபார்ப்பு தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.',
  networkErrorBody: 'சேவையகத்தை அணுக முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
  serverError: 'ஏதோ தவறு நடந்தது',
  serverErrorBody: 'சேவையகத்தால் உள்நுழைவை முடிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும், தொடர்ந்து நடந்தால் ஆதரவு குழுவைத் தொடர்பு கொள்ளவும்.',

  // ── Truecaller மிஸ்டு-கால் / OTP (Truecaller அல்லாத பயனர்) ஓட்டம் ─────────
  tcFallbackCta: 'Truecaller செயலி இல்லையா? மிஸ்டு காலில் சரிபார்க்கவும்',
  tcPhoneTitle: 'உங்கள் எண்ணைச் சரிபார்க்கவும்',
  tcPhoneSubtitle:
    'உங்கள் எண்ணைச் சரிபார்க்க ஒரு குறுகிய மிஸ்டு கால் செய்வோம் — எதையும் தட்டச்சு செய்ய வேண்டாம்.',
  tcPhoneLabel: 'மொபைல் எண்',
  tcFirstNameLabel: 'முதல் பெயர்',
  tcFirstNamePlaceholder: 'எ.கா. ஆரவ்',
  tcLastNameLabel: 'கடைசி பெயர் (விருப்பம்)',
  tcLastNamePlaceholder: 'எ.கா. சர்மா',
  tcSendVerification: 'மிஸ்டு காலில் சரிபார்க்கவும்',
  tcCallingTitle: 'உங்களை அழைக்கிறோம்…',
  tcCallingBody:
    '{{phone}} க்கு ஒரு குறுகிய அழைப்பை மேற்கொள்கிறோம். எடுக்க வேண்டாம் — நாங்கள் தானாகவே கண்டறிவோம்.',
  tcOtpBody: '{{phone}} க்கு அனுப்பப்பட்ட குறியீட்டை உள்ளிடவும்.',
  tcVerify: 'சரிபார்',
  tcChangeNumber: 'வேறு எண்ணைப் பயன்படுத்தவும்',
  tcInvalidPhone: 'சரியான 10 இலக்க மொபைல் எண்ணை உள்ளிடவும்.',
  tcFirstNameRequired: 'உங்கள் முதல் பெயரை உள்ளிடவும்.',
  tcInvalidOtp: 'நீங்கள் பெற்ற குறியீட்டை உள்ளிடவும்.',
  tcVerificationFailed: 'சரிபார்ப்பு தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.',
  tcPermissionsRequired:
    'சரிபார்ப்பு அழைப்பைத் தானாகக் கண்டறிய ஃபோன் மற்றும் அழைப்பு-பதிவு அனுமதிகள் தேவை. அவற்றை வழங்கவும், அல்லது Truecaller / மின்னஞ்சல் மூலம் உள்நுழையவும்.',
  tcNoCallDetected:
    'சரிபார்ப்பு அழைப்பை எங்களால் கண்டறிய முடியவில்லை. இந்த எண் ஏற்கனவே Truecaller பயன்படுத்தினால், திரும்பிச் சென்று ஒரு-தட்டு உள்நுழைவைப் பயன்படுத்தவும் — அல்லது வேறு எண்ணை முயற்சிக்கவும்.',
  tcUnsupported:
    'மிஸ்டு-கால் சரிபார்ப்பு Truecaller SDK உள்ளடக்கிய ஆண்ட்ராய்டு ஆப் பதிப்பில் மட்டுமே கிடைக்கும்.',

  // ── OtpEntrySection ───────────────────────────────────────────────────────
  enterOtpTitle: 'OTP உள்ளிடுக',
  otpSubtitle:
    'உங்கள் தொலைபேசிக்கு சரிபார்ப்பு குறியீடு அனுப்பப்பட்டது. தொடர கீழே உள்ளிடுக.',
  otpExpired: 'OTP காலாவதியானது',
  otpExpiresIn: '{{time}}-ல் காலாவதியாகும்',
  otpLabel: 'OTP',
  otpPlaceholder: 'குறியீட்டை உள்ளிடுக',
  invalidOtp: 'தவறான OTP',
  resendOtp: 'OTP மீண்டும் அனுப்பு',
  resendOtpIn: '{{time}}-ல் OTP மீண்டும் அனுப்பு',
  verificationFailedError: 'சரிபார்ப்பு தோல்வியடைந்தது',

  // ── PhoneEntrySection ─────────────────────────────────────────────────────
  verifyPhoneTitle: 'உங்கள் தொலைபேசி எண்ணை சரிபார்க்கவும்',
  verifyPhoneSubtitle:
    'உங்கள் இந்திய மொபைல் எண்ணுக்கு சரிபார்ப்பு குறியீடு அனுப்புவோம்.',
  firstNameInputLabel: 'முதல் பெயர்',
  firstNameInputPlaceholder: 'உங்கள் முதல் பெயர்',
  lastNameInputLabel: 'கடைசி பெயர் (விருப்பத்தேர்வு)',
  lastNameInputPlaceholder: 'உங்கள் கடைசி பெயர்',
  mobileNumberLabel: 'மொபைல் எண்',
  mobileNumberHint: '10 இலக்க இந்திய மொபைல் எண்',
  invalidPhoneError: 'சரியான 10 இலக்க இந்திய மொபைல் எண்ணை உள்ளிடுக',
  invalidFirstNameError: 'உங்கள் முதல் பெயரை உள்ளிடவும்',
  sendVerificationCode: 'சரிபார்ப்பு குறியீடு அனுப்பு',
  consentPrefix: "கணக்கை உருவாக்குவதன் மூலம், நீங்கள் எங்கள்",
  legalPrefix: "தொடர்வதன் மூலம், நீங்கள் எங்கள்",
  consentAnd: "மற்றும்",

  // ── Account type (RegisterScreen) ─────────────────────────────────────────
  signupIntentLabel: 'நீங்கள் எதற்காக வந்தீர்கள்?',
  signupIntentRequired: 'ஒன்றைத் தேர்ந்தெடுக்கவும்',
  intentOwnFarmTitle: 'நான் என் சொந்தப் பண்ணையை நடத்துகிறேன்',
  intentOwnFarmDesc: 'உங்கள் பண்ணையையும் குளங்களையும் அமைக்கவும்',
  intentWorkOnFarmTitle: 'நான் மற்றவரின் பண்ணையில் வேலை செய்கிறேன்',
  intentWorkOnFarmDesc: 'சேர அவர்களின் குறியீட்டை உள்ளிடவும்',

  // Create-account screen (artboard 04)
  fullNameLabel: "முழுப் பெயர்",
  fullNamePlaceholder: "உங்கள் பெயர்",
  fullNameRequired: "உங்கள் பெயரை உள்ளிடவும்",
  emailVerifyNote: "இந்த முகவரிக்கு ஒரு சரிபார்ப்பு இணைப்பை அனுப்புவோம்.",
  orDivider: "அல்லது",
  signInPrompt: "ஏற்கனவே கணக்கு உள்ளதா?",
};
export default auth;
