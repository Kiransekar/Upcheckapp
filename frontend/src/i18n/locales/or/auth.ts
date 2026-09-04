const auth = {
    continueWithGoogle: "Google ସହ ଜାରି ରଖନ୍ତୁ",
    continueWithTruecaller: "Truecaller ସହ ଜାରି ରଖନ୍ତୁ",
  // ── App header (LoginScreen) ──────────────────────────────────────────────
  title: 'Upcheck',
  subtitle: 'ଚିଙ୍ଗୁଡ଼ି ଜଳକୃଷି ପ୍ରବନ୍ଧନ',

  // ── Shared field labels / placeholders ───────────────────────────────────
  emailLabel: 'ଇମେଲ',
  emailPlaceholder: 'your@email.com',
  passwordLabel: 'ପାସୱାର୍ଡ',
  passwordPlaceholder: 'ଆପଣଙ୍କ ପାସୱାର୍ଡ ଦିଅନ୍ତୁ',

  // ── Shared validation messages ────────────────────────────────────────────
  emailRequired: 'ଇମେଲ ଆବଶ୍ୟକ',
  emailInvalid: 'ସଠିକ ଇମେଲ ଦିଅନ୍ତୁ',
  passwordRequired: 'ପାସୱାର୍ଡ ଆବଶ୍ୟକ',

  // ── LoginScreen ───────────────────────────────────────────────────────────
  signIn: 'ସାଇନ ଇନ',
  orContinueWith: 'ଅଥବା ଏହା ଦ୍ୱାରା ଜାରି ରଖନ୍ତୁ',
  forgotPassword: 'ପାସୱାର୍ଡ ଭୁଲିଗଲେ?',
  signInWithEmailCode: 'ଇମେଲ କୋଡ଼ ଦ୍ୱାରା ସାଇନ ଇନ',
  createAccount: 'ଆକାଉଣ୍ଟ ତୈରି କରନ୍ତୁ',

  // Verify-email banner (shown when pendingVerificationEmail is set)
  verifyBanner: 'ସାଇନ ଅପ ସଂପୂର୍ଣ୍ଣ କରିବାକୁ {{email}} ଯାଞ୍ଚ କରନ୍ତୁ। ଇମେଲ ପୁଣି ପଠାଇବାକୁ ଟ୍ୟାପ କରନ୍ତୁ।',

  // Resend-verification alerts
  emailRequiredAlert: 'ଇମେଲ ଆବଶ୍ୟକ',
  enterEmailFirst: 'ଉପରେ ପ୍ରଥମେ ଆପଣଙ୍କ ଇମେଲ ଦିଅନ୍ତୁ।',
  verificationSent: 'ଯାଞ୍ଚ ପଠାଯାଇଛି',
  verificationResentTo: 'ଆମେ {{email}} କୁ ପୁଣି ଯାଞ୍ଚ ଇମେଲ ପଠାଇଛୁ।',
  couldNotResend: 'ଯାଞ୍ଚ ଇମେଲ ପୁଣି ପଠାଯାଇ ପାରିଲା ନାହିଁ',

  // Login-time validation
  passwordTooShort: 'ପାସୱାର୍ଡ ଅନ୍ତତଃ ୬ ଅକ୍ଷର ହେବା ଆବଶ୍ୟକ',

  // ── RegisterScreen ────────────────────────────────────────────────────────
  createAccountTitle: 'ଆକାଉଣ୍ଟ ତୈରି କରନ୍ତୁ',
  registerSubtitle: 'ଆପଣଙ୍କ ଚିଙ୍ଗୁଡ଼ି ଫାର୍ମ ପ୍ରବନ୍ଧନ ପାଇଁ Upcheck ରେ ଯୋଗ ଦିଅନ୍ତୁ',

  firstNameLabel: 'ପ୍ରଥମ ନାମ',
  firstNamePlaceholder: 'ଆପଣଙ୍କ ପ୍ରଥମ ନାମ ଦିଅନ୍ତୁ',
  firstNameRequired: 'ପ୍ରଥମ ନାମ ଆବଶ୍ୟକ',

  lastNameLabel: 'ଶେଷ ନାମ',
  lastNamePlaceholder: 'ଆପଣଙ୍କ ଶେଷ ନାମ ଦିଅନ୍ତୁ',

  passwordAtLeast8Placeholder: 'ଅନ୍ତତଃ ୮ ଅକ୍ଷର',
  passwordTooShortRegister: 'ପାସୱାର୍ଡ ଅନ୍ତତଃ ୮ ଅକ୍ଷର ହେବା ଆବଶ୍ୟକ',
  passwordHint: '୮+ ଅକ୍ଷର — ଗୋଟିଏ ବଡ଼ ଓ ଛୋଟ ଅକ୍ଷର, ଗୋଟିଏ ସଂଖ୍ୟା ଏବଂ ଗୋଟିଏ ବିଶେଷ ଚିହ୍ନ',
  passwordRuleLength: 'ଅତିକମରେ ୮ଟି ଅକ୍ଷର ବ୍ୟବହାର କରନ୍ତୁ',
  passwordRuleLower: 'ଗୋଟିଏ ଛୋଟ ଅକ୍ଷର ଯୋଡ଼ନ୍ତୁ',
  passwordRuleUpper: 'ଗୋଟିଏ ବଡ଼ ଅକ୍ଷର ଯୋଡ଼ନ୍ତୁ',
  passwordRuleDigit: 'ଗୋଟିଏ ସଂଖ୍ୟା ଯୋଡ଼ନ୍ତୁ',
  passwordRuleSpecial: 'ଗୋଟିଏ ବିଶେଷ ଚିହ୍ନ ଯୋଡ଼ନ୍ତୁ (ଯେପରି # @ ! -)',

  confirmPasswordLabel: 'ପାସୱାର୍ଡ ନିଶ୍ଚିତ କରନ୍ତୁ',
  confirmPasswordPlaceholder: 'ପାସୱାର୍ଡ ପୁଣି ଦିଅନ୍ତୁ',
  passwordsDoNotMatch: 'ପାସୱାର୍ଡ ମେଳ ଖାଉ ନାହିଁ',

  alreadyHaveAccount: 'ଆଗରୁ ଆକାଉଣ୍ଟ ଅଛି? ସାଇନ ଇନ',

  // Registration success screen
  checkYourEmail: 'ଆପଣଙ୍କ ଇମେଲ ଯାଞ୍ଚ କରନ୍ତୁ',
  verificationLinkSent:
    'ଆମେ {{email}} କୁ ଏକ ଯାଞ୍ଚ ଲିଙ୍କ ପଠାଇଛୁ। ଜାରି ରଖିବାକୁ ଆପଣଙ୍କ ଇମେଲ ଯାଞ୍ଚ କରନ୍ତୁ।',
  backToLogin: 'ଲଗଇନକୁ ଫେରନ୍ତୁ',

  // ── ForgotPasswordScreen ──────────────────────────────────────────────────
  resetPassword: 'ପାସୱାର୍ଡ ରିସେଟ',
  resetPasswordSubtitle:
    'ଆପଣଙ୍କ ଇମେଲ ଠିକଣା ଦିଅନ୍ତୁ, ଆମେ ପାସୱାର୍ଡ ରିସେଟ ଲିଙ୍କ ପଠାଇବୁ।',
  sendResetLink: 'ରିସେଟ ଲିଙ୍କ ପଠାନ୍ତୁ',
  failedToSendReset: 'ରିସେଟ ଇମେଲ ପଠାଇ ହୋଇ ପାରିଲା ନାହିଁ',
  passwordResetSent:
    'ଆମେ {{email}} କୁ ପାସୱାର୍ଡ ରିସେଟ ଲିଙ୍କ ପଠାଇଛୁ। ପାସୱାର୍ଡ ରିସେଟ କରିବାକୁ ଇମେଲ ନିର୍ଦ୍ଦେଶ ଅନୁସରଣ କରନ୍ତୁ।',

  // ── OtpLoginScreen ────────────────────────────────────────────────────────
  signInWithEmailCodeTitle: 'ଇମେଲ କୋଡ଼ ଦ୍ୱାରା ସାଇନ ଇନ',
  emailRequiredBody: 'ଆପଣଙ୍କ ଆକାଉଣ୍ଟ ଇମେଲ ଦିଅନ୍ତୁ।',
  codeSent: 'କୋଡ଼ ପଠାଯାଇଛି',
  checkEmailForCode: '୬-ଅଙ୍କ ଲଗଇନ କୋଡ଼ ପାଇଁ ଆପଣଙ୍କ ଇମେଲ ଦେଖନ୍ତୁ।',
  couldNotSendCode: 'କୋଡ଼ ପଠାଯାଇ ପାରିଲା ନାହିଁ',
  noSessionReturned: 'ସେସନ ଫେରିଲା ନାହିଁ। ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।',
  invalidOrExpiredCode: 'ଅବୈଧ ବା ମିଆଦ ଶେଷ ହୋଇଯାଇଥିବା କୋଡ଼',
  invalidCode: 'ଅବୈଧ କୋଡ଼',
  enterSixDigitCode: 'ଆପଣଙ୍କ ଇମେଲ ର ୬-ଅଙ୍କ କୋଡ଼ ଦିଅନ୍ତୁ।',
  sixDigitCodeLabel: '୬-ଅଙ୍କ କୋଡ଼',
  sendCode: 'କୋଡ଼ ପଠାନ୍ତୁ',
  verifyAndSignIn: 'ଯାଞ୍ଚ ଓ ସାଇନ ଇନ',
  resendCode: 'କୋଡ଼ ପୁଣି ପଠାନ୍ତୁ',

  // ── TwoFactorChallengeScreen ──────────────────────────────────────────────
  twoFactorTitle: 'ଦ୍ୱି-ଘଟକ ଯାଞ୍ଚ',
  twoFactorHelp:
    'ସାଇନ ଇନ ସଂପୂର୍ଣ୍ଣ କରିବାକୁ ଆପଣଙ୍କ ଅଥେଣ୍ଟିକେଟର ଆପ ରୁ ୬-ଅଙ୍କ କୋଡ଼ ଦିଅନ୍ତୁ।',
  authenticatorCodeLabel: 'ଅଥେଣ୍ଟିକେଟର କୋଡ଼',
  invalidCodeAlert: 'ଆପଣଙ୍କ ଅଥେଣ୍ଟିକେଟର ଆପ ରୁ ୬-ଅଙ୍କ କୋଡ଼ ଦିଅନ୍ତୁ।',
  noSessionSignInAgain: 'ସେସନ ଫେରିଲା ନାହିଁ। ପୁଣି ସାଇନ ଇନ କରନ୍ତୁ।',
  invalidVerificationCode: 'ଅବୈଧ ଯାଞ୍ଚ କୋଡ଼',

  // ── Backup codes (AUTH-4) ──
  twoFactorBackupHelp: 'ସାଇନ୍ ଇନ୍ ସମ୍ପୂର୍ଣ୍ଣ କରିବାକୁ ଆପଣଙ୍କ ସଞ୍ଚିତ ବ୍ୟାକଅପ୍ କୋଡ଼ ମଧ୍ୟରୁ ଗୋଟିଏ ପ୍ରବେଶ କରନ୍ତୁ।',
  backupCodeLabel: 'ବ୍ୟାକଅପ୍ କୋଡ଼',
  useBackupCode: 'ଏହା ପରିବର୍ତ୍ତେ ଏକ ବ୍ୟାକଅପ୍ କୋଡ଼ ବ୍ୟବହାର କରନ୍ତୁ',
  useAuthenticatorInstead: 'ଏହା ପରିବର୍ତ୍ତେ ପ୍ରାମାଣିକ ଆପ୍ ବ୍ୟବହାର କରନ୍ତୁ',
  verify: 'ଯାଞ୍ଚ କରନ୍ତୁ',

  // ── TruecallerLoginScreen ─────────────────────────────────────────────────
  truecallerTitle: 'Truecaller ଦ୍ୱାରା ସାଇନ ଇନ',
  truecallerSubtitle: 'ଆପଣଙ୍କ ଭାରତୀୟ ମୋବାଇଲ ନମ୍ବର ଦ୍ୱାରା କ୍ଷଣ ମଧ୍ୟରେ ଯାଞ୍ଚ କରନ୍ତୁ।',
  requestPhonePermissions:
    'ଆପଣଙ୍କ ନମ୍ବର ଯାଞ୍ଚ କରିବାକୁ ଆମେ ଫୋନ ଅନୁମତି ଚାହିଁବୁ।',
  permissionsRequired:
    'Truecaller{{suffix}} ଦ୍ୱାରା ଜାରି ରଖିବାକୁ ଫୋନ ଅନୁମତି ଆବଶ୍ୟକ। ସେଟିଂସ ରେ ଅନୁମତି ଦିଅନ୍ତୁ ବା ଇମେଲ ଦ୍ୱାରା ସାଇନ ଇନ କରନ୍ତୁ।',
  loginFailed: 'ଲଗଇନ ବିଫଳ',
  noSessionByServer: 'ସର୍ଭର ଦ୍ୱାରା ସେସନ ଫେରିଲା ନାହିଁ।',
  networkError: 'ନେଟୱାର୍କ ତ୍ରୁଟି',
  truecallerAuthFailed: 'Truecaller ପ୍ରମାଣୀକରଣ ବିଫଳ',
  verificationFailed: 'ଯାଞ୍ଚ ବିଫଳ',
  missingAccessToken: 'Truecaller ରୁ ଆକ୍ସେସ ଟୋକେନ ମିଳିଲା ନାହିଁ।',
  incompleteSignedPayload: 'Truecaller ରୁ ଅସଂପୂର୍ଣ୍ଣ ସ୍ୱାକ୍ଷରିତ ପେଲୋଡ।',
  truecallerCannotVerify: 'Truecaller ନମ୍ବର ଯାଞ୍ଚ କରିପାରିଲା ନାହିଁ।',
  unknownError: 'ଅଜ୍ଞାତ ତ୍ରୁଟି',
  networkCheckMessage:
    'ଇଣ୍ଟରନେଟ ସଂଯୋଗ ନାହିଁ। ଆପଣଙ୍କ ନେଟୱାର୍କ ଯାଞ୍ଚ କରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ',
  truecallerErrorPrefix: 'Truecaller ତ୍ରୁଟି: ',
  waitingForMissedCall: 'ମିସ ଡ ଫୋନ ପ୍ରତୀକ୍ଷା',
  missedCallBody:
    'ଶୀଘ୍ର ଆପଣଙ୍କ ଫୋନ ବଜିବ। ଉଠାଉ ନ ଥିবେ — Truecaller ସ୍ୱଯଂଚାଳିତ ଭାବେ ଯାଞ୍ଚ କରିବ।',
  expiresIn: '{{seconds}}s ରେ ସମୟ ଶେଷ',
  verifyingWithUpcheck: 'Upcheck ସହ ଯାଞ୍ଚ ହେଉଛି...',
  signInWithEmail: 'ଇମେଲ ଦ୍ୱାରା ସାଇନ ଇନ',
  truecallerNoSession: 'ସର୍ଭର କୌଣସି ସେସନ ଫେରାଇ ନାହିଁ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।',
  truecallerVerificationFailed: 'Truecaller ଯାଞ୍ଚ ବିଫଳ ହେଲା। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।',
  networkErrorBody: 'ସର୍ଭରରେ ପହଞ୍ଚିପାରିଲୁ ନାହିଁ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।',
  serverError: 'କିଛି ଭୁଲ ହୋଇଛି',
  serverErrorBody: 'ସର୍ଭର ସାଇନ୍-ଇନ୍ ସମ୍ପୂର୍ଣ୍ଣ କରିପାରିଲା ନାହିଁ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ, କିମ୍ବା ବାରମ୍ବାର ହେଲେ ସହାୟତା ଦଳଙ୍କ ସହ ଯୋଗାଯୋଗ କରନ୍ତୁ।',

  // ── Truecaller ମିସଡ୍-କଲ୍ / OTP (Truecaller-ହୀନ ୟୁଜର) ଫ୍ଲୋ ─────────────────
  tcFallbackCta: 'Truecaller ଆପ୍ ନାହିଁ? ମିସଡ୍ କଲ୍ ଦ୍ୱାରା ଯାଞ୍ଚ କରନ୍ତୁ',
  tcPhoneTitle: 'ଆପଣଙ୍କ ନମ୍ବର ଯାଞ୍ଚ କରନ୍ତୁ',
  tcPhoneSubtitle:
    'ଆପଣଙ୍କ ନମ୍ବର ଯାଞ୍ଚ କରିବାକୁ ଆମେ ଏକ ଛୋଟ ମିସଡ୍ କଲ୍ କରିବୁ — କିଛି ଟାଇପ୍ କରିବାର ଆବଶ୍ୟକ ନାହିଁ।',
  tcPhoneLabel: 'ମୋବାଇଲ୍ ନମ୍ବର',
  tcFirstNameLabel: 'ପ୍ରଥମ ନାମ',
  tcFirstNamePlaceholder: 'ଉଦା. ଆରଭ',
  tcLastNameLabel: 'ଉପନାମ (ଐଚ୍ଛିକ)',
  tcLastNamePlaceholder: 'ଉଦା. ଶର୍ମା',
  tcSendVerification: 'ମିସଡ୍ କଲ୍ ଦ୍ୱାରା ଯାଞ୍ଚ କରନ୍ତୁ',
  tcCallingTitle: 'ଆପଣଙ୍କୁ କଲ୍ କରୁଛୁ…',
  tcCallingBody:
    'ଆମେ {{phone}} କୁ ଏକ ଛୋଟ କଲ୍ କରୁଛୁ। ଉଠାନ୍ତୁ ନାହିଁ — ଆମେ ଏହାକୁ ସ୍ୱୟଂଚାଳିତ ଭାବରେ ଚିହ୍ନଟ କରିବୁ।',
  tcOtpBody: '{{phone}} କୁ ପଠାଯାଇଥିବା କୋଡ୍ ଲେଖନ୍ତୁ।',
  tcVerify: 'ଯାଞ୍ଚ କରନ୍ତୁ',
  tcChangeNumber: 'ଅନ୍ୟ ଏକ ନମ୍ବର ବ୍ୟବହାର କରନ୍ତୁ',
  tcInvalidPhone: 'ଏକ ବୈଧ ୧୦-ଅଙ୍କ ମୋବାଇଲ୍ ନମ୍ବର ଲେଖନ୍ତୁ।',
  tcFirstNameRequired: 'ଦୟାକରି ଆପଣଙ୍କ ପ୍ରଥମ ନାମ ଲେଖନ୍ତୁ।',
  tcInvalidOtp: 'ଆପଣ ପାଇଥିବା କୋଡ୍ ଲେଖନ୍ତୁ।',
  tcVerificationFailed: 'ଯାଞ୍ଚ ବିଫଳ ହେଲା। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।',
  tcPermissionsRequired:
    'ଯାଞ୍ଚ କଲ୍ ସ୍ୱୟଂଚାଳିତ ଭାବରେ ଚିହ୍ନଟ କରିବାକୁ ଫୋନ୍ ଏବଂ କଲ୍-ଲଗ୍ ଅନୁମତି ଆବଶ୍ୟକ। ଦୟାକରି ସେଗୁଡ଼ିକ ଦିଅନ୍ତୁ, କିମ୍ବା Truecaller / ଇମେଲ ଦ୍ୱାରା ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।',
  tcNoCallDetected:
    'ଆମେ କୌଣସି ଯାଞ୍ଚ କଲ୍ ଚିହ୍ନଟ କରିପାରିଲୁ ନାହିଁ। ଏହି ନମ୍ବର ଯଦି ପୂର୍ବରୁ Truecaller ବ୍ୟବହାର କରେ, ତେବେ ପଛକୁ ଯାଇ ୱାନ୍-ଟାପ୍ ସାଇନ୍-ଇନ୍ କରନ୍ତୁ — କିମ୍ବା ଅନ୍ୟ ଏକ ନମ୍ବର ଚେଷ୍ଟା କରନ୍ତୁ।',
  tcUnsupported:
    'ମିସଡ୍-କଲ୍ ଯାଞ୍ଚ କେବଳ Android ରେ ସେହି ଆପ୍ ବିଲ୍ଡରେ ଉପଲବ୍ଧ ଯେଉଁଥିରେ Truecaller SDK ଅନ୍ତର୍ଭୁକ୍ତ ଅଛି।',

  // ── OtpEntrySection ───────────────────────────────────────────────────────
  enterOtpTitle: 'OTP ଦିଅନ୍ତୁ',
  otpSubtitle:
    'ଆମେ ଆପଣଙ୍କ ଫୋନ ରେ ଯାଞ୍ଚ କୋଡ଼ ପଠାଇଛୁ। ଜାରି ରଖିବାକୁ ତଳେ ଦିଅନ୍ତୁ।',
  otpExpired: 'OTP ସମୟ ଶେଷ',
  otpExpiresIn: '{{time}} ରେ ସମୟ ଶେଷ',
  otpLabel: 'OTP',
  otpPlaceholder: 'କୋଡ଼ ଦିଅନ୍ତୁ',
  invalidOtp: 'ଅବୈଧ OTP',
  resendOtp: 'OTP ପୁଣି ପଠାନ୍ତୁ',
  resendOtpIn: '{{time}} ରେ OTP ପୁଣି ପଠାନ୍ତୁ',
  verificationFailedError: 'ଯାଞ୍ଚ ବିଫଳ',

  // ── PhoneEntrySection ─────────────────────────────────────────────────────
  verifyPhoneTitle: 'ଆପଣଙ୍କ ଫୋନ ନମ୍ବର ଯାଞ୍ଚ କରନ୍ତୁ',
  verifyPhoneSubtitle:
    'ଆମେ ଆପଣଙ୍କ ଭାରତୀୟ ମୋବାଇଲ ନମ୍ବରରେ ଯାଞ୍ଚ କୋଡ଼ ପଠାଇବୁ।',
  firstNameInputLabel: 'ପ୍ରଥମ ନାମ',
  firstNameInputPlaceholder: 'ଆପଣଙ୍କ ପ୍ରଥମ ନାମ',
  lastNameInputLabel: 'ଶେଷ ନାମ (ଐଚ୍ଛିକ)',
  lastNameInputPlaceholder: 'ଆପଣଙ୍କ ଶେଷ ନାମ',
  mobileNumberLabel: 'ମୋବାଇଲ ନମ୍ବର',
  mobileNumberHint: '୧୦-ଅଙ୍କ ଭାରତୀୟ ମୋବାଇଲ ନମ୍ବର',
  invalidPhoneError: 'ସଠିକ ୧୦-ଅଙ୍କ ଭାରତୀୟ ମୋବାଇଲ ନମ୍ବର ଦିଅନ୍ତୁ',
  invalidFirstNameError: 'ଆପଣଙ୍କ ପ୍ରଥମ ନାମ ଦିଅନ୍ତୁ',
  sendVerificationCode: 'ଯାଞ୍ଚ କୋଡ଼ ପଠାନ୍ତୁ',
  consentPrefix: "ଖାତା ସୃଷ୍ଟି କରି, ଆପଣ ଆମର",
  legalPrefix: "ଜାରି ରଖି, ଆପଣ ଆମର",
  consentAnd: "ଏବଂ",

  // ── Account type selection ────────────────────────────────────────────────
  signupIntentLabel: 'ଆପଣ କାହିଁକି ଆସିଛନ୍ତି?',
  signupIntentRequired: 'ଦୟାକରି ଗୋଟିଏ ବାଛନ୍ତୁ',
  intentOwnFarmTitle: 'ମୁଁ ନିଜ ଫାର୍ମ ଚଳାଏ',
  intentOwnFarmDesc: 'ଆପଣଙ୍କ ଫାର୍ମ ଓ ପୋଖରୀ ସେଟ କରନ୍ତୁ',
  intentWorkOnFarmTitle: 'ମୁଁ ଅନ୍ୟର ଫାର୍ମରେ କାମ କରେ',
  intentWorkOnFarmDesc: 'ଯୋଗ ଦେବାକୁ ସେମାନଙ୍କ କୋଡ୍ ଦିଅନ୍ତୁ',

  // Create-account screen (artboard 04)
  fullNameLabel: "ପୂରା ନାମ",
  fullNamePlaceholder: "ଆପଣଙ୍କ ନାମ",
  fullNameRequired: "ଆପଣଙ୍କ ନାମ ଲେଖନ୍ତୁ",
  emailVerifyNote: "ଆମେ ଏହି ଠିକଣାକୁ ଏକ ଯାଞ୍ଚ ଲିଙ୍କ ପଠାଇବୁ।",
  orDivider: "କିମ୍ବା",
  signInPrompt: "ପୂର୍ବରୁ ଖାତା ଅଛି କି?",
};
export default auth;
