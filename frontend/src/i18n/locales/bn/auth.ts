const auth = {
  // ── App header (LoginScreen) ──────────────────────────────────────────────
  title: 'Upcheck',
  subtitle: 'চিংড়ি অ্যাকুয়াকালচার ম্যানেজমেন্ট',

  // ── Shared field labels / placeholders ───────────────────────────────────
  emailLabel: 'ইমেইল',
  emailPlaceholder: 'your@email.com',
  passwordLabel: 'পাসওয়ার্ড',
  passwordPlaceholder: 'আপনার পাসওয়ার্ড লিখুন',

  // ── Shared validation messages ────────────────────────────────────────────
  emailRequired: 'ইমেইল আবশ্যক',
  emailInvalid: 'সঠিক ইমেইল লিখুন',
  passwordRequired: 'পাসওয়ার্ড আবশ্যক',

  // ── LoginScreen ───────────────────────────────────────────────────────────
  signIn: 'সাইন ইন',
  orContinueWith: 'অথবা এর মাধ্যমে চালিয়ে যান',
  forgotPassword: 'পাসওয়ার্ড ভুলে গেছেন?',
  signInWithEmailCode: 'ইমেইল কোড দিয়ে সাইন ইন',
  createAccount: 'অ্যাকাউন্ট তৈরি করুন',

  // Verify-email banner (shown when pendingVerificationEmail is set)
  verifyBanner: 'সাইনআপ সম্পন্ন করতে {{email}} যাচাই করুন। পুনরায় পাঠাতে ট্যাপ করুন।',

  // Resend-verification alerts
  emailRequiredAlert: 'ইমেইল আবশ্যক',
  enterEmailFirst: 'আগে উপরে আপনার ইমেইল লিখুন।',
  verificationSent: 'যাচাইকরণ পাঠানো হয়েছে',
  verificationResentTo: 'আমরা {{email}}-এ যাচাইকরণ ইমেইল পুনরায় পাঠিয়েছি।',
  couldNotResend: 'যাচাইকরণ ইমেইল পুনরায় পাঠানো যায়নি',

  // Login-time validation
  passwordTooShort: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে',

  // ── RegisterScreen ────────────────────────────────────────────────────────
  createAccountTitle: 'অ্যাকাউন্ট তৈরি করুন',
  registerSubtitle: 'চিংড়ি খামার পরিচালনা করতে Upcheck-এ যোগ দিন',

  firstNameLabel: 'প্রথম নাম',
  firstNamePlaceholder: 'আপনার প্রথম নাম লিখুন',
  firstNameRequired: 'প্রথম নাম আবশ্যক',

  lastNameLabel: 'পদবি',
  lastNamePlaceholder: 'আপনার পদবি লিখুন',

  passwordAtLeast8Placeholder: 'কমপক্ষে ৮ অক্ষর',
  passwordTooShortRegister: 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে',
  passwordHint: '৮+ অক্ষর — একটি বড় ও ছোট হাতের অক্ষর, একটি সংখ্যা এবং একটি বিশেষ চিহ্ন',
  passwordRuleLength: 'কমপক্ষে ৮টি অক্ষর ব্যবহার করুন',
  passwordRuleLower: 'একটি ছোট হাতের অক্ষর যোগ করুন',
  passwordRuleUpper: 'একটি বড় হাতের অক্ষর যোগ করুন',
  passwordRuleDigit: 'একটি সংখ্যা যোগ করুন',
  passwordRuleSpecial: 'একটি বিশেষ চিহ্ন যোগ করুন (যেমন # @ ! -)',

  confirmPasswordLabel: 'পাসওয়ার্ড নিশ্চিত করুন',
  confirmPasswordPlaceholder: 'পাসওয়ার্ড পুনরায় লিখুন',
  passwordsDoNotMatch: 'পাসওয়ার্ড মিলছে না',

  alreadyHaveAccount: 'ইতিমধ্যে অ্যাকাউন্ট আছে? সাইন ইন করুন',

  // Registration success screen
  checkYourEmail: 'ইমেইল চেক করুন',
  verificationLinkSent:
    'আমরা {{email}}-এ একটি যাচাইকরণ লিংক পাঠিয়েছি। চালিয়ে যেতে আপনার ইমেইল যাচাই করুন।',
  backToLogin: 'লগইনে ফিরুন',

  // ── ForgotPasswordScreen ──────────────────────────────────────────────────
  resetPassword: 'পাসওয়ার্ড রিসেট করুন',
  resetPasswordSubtitle:
    'আপনার ইমেইল ঠিকানা লিখুন, আমরা পাসওয়ার্ড রিসেটের একটি লিংক পাঠাব।',
  sendResetLink: 'রিসেট লিংক পাঠান',
  failedToSendReset: 'রিসেট ইমেইল পাঠাতে ব্যর্থ',
  passwordResetSent:
    'আমরা {{email}}-এ পাসওয়ার্ড রিসেট লিংক পাঠিয়েছি। পাসওয়ার্ড রিসেট করতে ইমেইলের নির্দেশনা অনুসরণ করুন।',

  // ── OtpLoginScreen ────────────────────────────────────────────────────────
  signInWithEmailCodeTitle: 'ইমেইল কোড দিয়ে সাইন ইন',
  emailRequiredBody: 'আপনার অ্যাকাউন্টের ইমেইল লিখুন।',
  codeSent: 'কোড পাঠানো হয়েছে',
  checkEmailForCode: '৬ সংখ্যার লগইন কোডের জন্য আপনার ইমেইল দেখুন।',
  couldNotSendCode: 'কোড পাঠানো যায়নি',
  noSessionReturned: 'কোনো সেশন পাওয়া যায়নি। আবার চেষ্টা করুন।',
  invalidOrExpiredCode: 'অবৈধ বা মেয়াদোত্তীর্ণ কোড',
  invalidCode: 'অবৈধ কোড',
  enterSixDigitCode: 'আপনার ইমেইল থেকে ৬ সংখ্যার কোডটি লিখুন।',
  sixDigitCodeLabel: '৬ সংখ্যার কোড',
  sendCode: 'কোড পাঠান',
  verifyAndSignIn: 'যাচাই করুন ও সাইন ইন করুন',
  resendCode: 'কোড পুনরায় পাঠান',

  // ── TwoFactorChallengeScreen ──────────────────────────────────────────────
  twoFactorTitle: 'দ্বি-স্তরীয় যাচাইকরণ',
  twoFactorHelp:
    'সাইন ইন সম্পন্ন করতে আপনার অথেনটিকেটর অ্যাপ থেকে ৬ সংখ্যার কোডটি লিখুন।',
  authenticatorCodeLabel: 'অথেনটিকেটর কোড',
  invalidCodeAlert: 'আপনার অথেনটিকেটর অ্যাপ থেকে ৬ সংখ্যার কোডটি লিখুন।',
  noSessionSignInAgain: 'কোনো সেশন পাওয়া যায়নি। আবার সাইন ইন করুন।',
  invalidVerificationCode: 'অবৈধ যাচাইকরণ কোড',

  // ── Backup codes (AUTH-4) ──
  twoFactorBackupHelp: 'সাইন ইন সম্পূর্ণ করতে আপনার সংরক্ষিত ব্যাকআপ কোডগুলির একটি লিখুন।',
  backupCodeLabel: 'ব্যাকআপ কোড',
  useBackupCode: 'পরিবর্তে একটি ব্যাকআপ কোড ব্যবহার করুন',
  useAuthenticatorInstead: 'পরিবর্তে অথেন্টিকেটর অ্যাপ ব্যবহার করুন',
  verify: 'যাচাই করুন',

  // ── TruecallerLoginScreen ─────────────────────────────────────────────────
  truecallerTitle: 'Truecaller দিয়ে সাইন ইন',
  truecallerSubtitle: 'কয়েক সেকেন্ডে আপনার ভারতীয় মোবাইল নম্বর দিয়ে যাচাই করুন।',
  requestPhonePermissions:
    'আপনার নম্বর যাচাই করতে আমরা ফোন অনুমতি চাইব।',
  permissionsRequired:
    'Truecaller{{suffix}} দিয়ে চালিয়ে যেতে ফোন অনুমতি আবশ্যক। সেটিংসে গিয়ে অনুমতি দিন অথবা পরিবর্তে ইমেইল দিয়ে সাইন ইন করুন।',
  loginFailed: 'লগইন ব্যর্থ',
  noSessionByServer: 'সার্ভার থেকে কোনো সেশন পাওয়া যায়নি।',
  networkError: 'নেটওয়ার্ক ত্রুটি',
  truecallerAuthFailed: 'Truecaller যাচাইকরণ ব্যর্থ',
  verificationFailed: 'যাচাইকরণ ব্যর্থ',
  missingAccessToken: 'Truecaller থেকে অ্যাক্সেস টোকেন পাওয়া যায়নি।',
  incompleteSignedPayload: 'Truecaller থেকে অসম্পূর্ণ স্বাক্ষরিত পেলোড।',
  truecallerCannotVerify: 'Truecaller নম্বরটি যাচাই করতে পারেনি।',
  unknownError: 'অজানা ত্রুটি',
  networkCheckMessage:
    'ইন্টারনেট সংযোগ নেই। আপনার নেটওয়ার্ক চেক করুন এবং আবার চেষ্টা করুন',
  truecallerErrorPrefix: 'Truecaller ত্রুটি: ',
  waitingForMissedCall: 'মিসড কলের জন্য অপেক্ষা করছে',
  missedCallBody:
    'শীঘ্রই আপনার কাছে একটি মিসড কল আসবে। কলটি তুলবেন না — Truecaller স্বয়ংক্রিয়ভাবে যাচাই করবে।',
  expiresIn: '{{seconds}}s-এ মেয়াদ শেষ',
  verifyingWithUpcheck: 'Upcheck-এর সাথে যাচাই হচ্ছে...',
  signInWithEmail: 'ইমেইল দিয়ে সাইন ইন',
  truecallerNoSession: 'সার্ভার কোনো সেশন ফেরত দেয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
  truecallerVerificationFailed: 'Truecaller যাচাই ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
  networkErrorBody: 'সার্ভারে পৌঁছানো যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',

  // ── Truecaller মিসড-কল / OTP (নন-Truecaller ইউজার) ফ্লো ──────────────────
  tcFallbackCta: 'Truecaller অ্যাপ নেই? মিসড কলে যাচাই করুন',
  tcPhoneTitle: 'আপনার নম্বর যাচাই করুন',
  tcPhoneSubtitle:
    'আপনার নম্বর যাচাই করতে আমরা একটি ছোট মিসড কল করব — কিছু টাইপ করার দরকার নেই।',
  tcPhoneLabel: 'মোবাইল নম্বর',
  tcFirstNameLabel: 'নামের প্রথম অংশ',
  tcFirstNamePlaceholder: 'যেমন আরভ',
  tcLastNameLabel: 'পদবি (ঐচ্ছিক)',
  tcLastNamePlaceholder: 'যেমন শর্মা',
  tcSendVerification: 'মিসড কলে যাচাই করুন',
  tcCallingTitle: 'আপনাকে কল করা হচ্ছে…',
  tcCallingBody:
    'আমরা {{phone}} নম্বরে একটি ছোট কল করছি। ধরবেন না — আমরা স্বয়ংক্রিয়ভাবে এটি শনাক্ত করব।',
  tcOtpBody: '{{phone}} নম্বরে পাঠানো কোডটি লিখুন।',
  tcVerify: 'যাচাই করুন',
  tcChangeNumber: 'অন্য নম্বর ব্যবহার করুন',
  tcInvalidPhone: 'একটি বৈধ ১০-সংখ্যার মোবাইল নম্বর লিখুন।',
  tcFirstNameRequired: 'অনুগ্রহ করে আপনার নামের প্রথম অংশ লিখুন।',
  tcInvalidOtp: 'আপনি যে কোডটি পেয়েছেন সেটি লিখুন।',
  tcVerificationFailed: 'যাচাই ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
  tcPermissionsRequired:
    'যাচাই কলটি স্বয়ংক্রিয়ভাবে শনাক্ত করতে ফোন ও কল-লগ অনুমতি প্রয়োজন। অনুগ্রহ করে সেগুলি দিন, অথবা Truecaller / ইমেইল দিয়ে সাইন ইন করুন।',
  tcNoCallDetected:
    'আমরা কোনো যাচাই কল শনাক্ত করতে পারিনি। এই নম্বরটি যদি ইতিমধ্যে Truecaller ব্যবহার করে, তবে ফিরে গিয়ে ওয়ান-ট্যাপ সাইন-ইন করুন — অথবা অন্য একটি নম্বর চেষ্টা করুন।',
  tcUnsupported:
    'মিসড-কল যাচাই কেবল Android-এ সেই অ্যাপ বিল্ডে উপলব্ধ যেটিতে Truecaller SDK অন্তর্ভুক্ত রয়েছে।',

  // ── OtpEntrySection ───────────────────────────────────────────────────────
  enterOtpTitle: 'OTP লিখুন',
  otpSubtitle:
    'আমরা আপনার ফোনে একটি যাচাইকরণ কোড পাঠিয়েছি। চালিয়ে যেতে নিচে লিখুন।',
  otpExpired: 'OTP মেয়াদোত্তীর্ণ',
  otpExpiresIn: '{{time}}-এ মেয়াদ শেষ',
  otpLabel: 'OTP',
  otpPlaceholder: 'কোড লিখুন',
  invalidOtp: 'অবৈধ OTP',
  resendOtp: 'OTP পুনরায় পাঠান',
  resendOtpIn: '{{time}}-এ OTP পুনরায় পাঠান',
  verificationFailedError: 'যাচাইকরণ ব্যর্থ',

  // ── PhoneEntrySection ─────────────────────────────────────────────────────
  verifyPhoneTitle: 'আপনার ফোন নম্বর যাচাই করুন',
  verifyPhoneSubtitle:
    'আমরা আপনার ভারতীয় মোবাইল নম্বরে একটি যাচাইকরণ কোড পাঠাব।',
  firstNameInputLabel: 'প্রথম নাম',
  firstNameInputPlaceholder: 'আপনার প্রথম নাম',
  lastNameInputLabel: 'পদবি (ঐচ্ছিক)',
  lastNameInputPlaceholder: 'আপনার পদবি',
  mobileNumberLabel: 'মোবাইল নম্বর',
  mobileNumberHint: '১০ সংখ্যার ভারতীয় মোবাইল নম্বর',
  invalidPhoneError: 'সঠিক ১০ সংখ্যার ভারতীয় মোবাইল নম্বর লিখুন',
  invalidFirstNameError: 'আপনার প্রথম নাম লিখুন',
  sendVerificationCode: 'যাচাইকরণ কোড পাঠান',
  consentPrefix: "একটি অ্যাকাউন্ট তৈরি করে, আপনি আমাদের",
  legalPrefix: "চালিয়ে গিয়ে, আপনি আমাদের",
  consentAnd: "এবং",

  // ── Account type (RegisterScreen) ─────────────────────────────────────────
  accountTypeLabel: 'আমি একজন…',
  accountTypeRequired: 'অনুগ্রহ করে একটি অ্যাকাউন্টের ধরন বেছে নিন',
  accountOwnerTitle: 'খামার মালিক',
  accountOwnerDesc: 'নিজের খামার তৈরি ও পরিচালনা করুন',
  accountWorkerTitle: 'কর্মী',
  accountWorkerDesc: 'একটি খামারে যোগ দিন ও দৈনিক কাজ লিপিবদ্ধ করুন',
};
export default auth;
