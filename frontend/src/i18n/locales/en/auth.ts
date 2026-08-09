const auth = {
  // ── App header (LoginScreen) ──────────────────────────────────────────────
  title: 'Upcheck',
  subtitle: 'Shrimp Aquaculture Management',

  // ── Shared field labels / placeholders ───────────────────────────────────
  emailLabel: 'Email',
  emailPlaceholder: 'your@email.com',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Enter your password',

  // ── Shared validation messages ────────────────────────────────────────────
  emailRequired: 'Email is required',
  emailInvalid: 'Enter a valid email',
  passwordRequired: 'Password is required',

  // ── LoginScreen ───────────────────────────────────────────────────────────
  signIn: 'Sign In',
  orContinueWith: 'Or continue with',
  forgotPassword: 'Forgot Password?',
  signInWithEmailCode: 'Sign in with email code',
  createAccount: 'Create Account',

  // Verify-email banner (shown when pendingVerificationEmail is set)
  verifyBanner: 'Verify {{email}} to finish signing up. Tap to resend the email.',

  // Resend-verification alerts
  emailRequiredAlert: 'Email required',
  enterEmailFirst: 'Enter your email above first.',
  verificationSent: 'Verification sent',
  verificationResentTo: 'We re-sent the verification email to {{email}}.',
  couldNotResend: 'Could not resend verification email',

  // Login-time validation
  passwordTooShort: 'Password must be at least 6 characters',

  // ── RegisterScreen ────────────────────────────────────────────────────────
  createAccountTitle: 'Create Account',
  registerSubtitle: 'Join Upcheck to manage your shrimp farms',

  firstNameLabel: 'First Name',
  firstNamePlaceholder: 'Enter your first name',
  firstNameRequired: 'First name is required',

  lastNameLabel: 'Last Name',
  lastNamePlaceholder: 'Enter your last name',

  passwordAtLeast8Placeholder: 'At least 8 characters',
  passwordTooShortRegister: 'Password must be at least 8 characters',
  passwordHint: '8+ characters with an uppercase & lowercase letter, a number, and a symbol',
  passwordRuleLength: 'Use at least 8 characters',
  passwordRuleLower: 'Add a lowercase letter',
  passwordRuleUpper: 'Add an uppercase letter',
  passwordRuleDigit: 'Add a number',
  passwordRuleSpecial: 'Add a special character (e.g. # @ ! -)',

  confirmPasswordLabel: 'Confirm Password',
  confirmPasswordPlaceholder: 'Re-enter your password',
  passwordsDoNotMatch: 'Passwords do not match',

  alreadyHaveAccount: 'Already have an account? Sign In',

  // Registration success screen
  checkYourEmail: 'Check Your Email',
  verificationLinkSent:
    "We've sent a verification link to {{email}}. Please verify your email to continue.",
  backToLogin: 'Back to Login',

  // ── ForgotPasswordScreen ──────────────────────────────────────────────────
  resetPassword: 'Reset Password',
  resetPasswordSubtitle:
    "Enter your email address and we'll send you a link to reset your password.",
  sendResetLink: 'Send Reset Link',
  failedToSendReset: 'Failed to send reset email',
  passwordResetSent:
    "We've sent a password reset link to {{email}}. Follow the instructions in the email to reset your password.",

  // ── OtpLoginScreen ────────────────────────────────────────────────────────
  signInWithEmailCodeTitle: 'Sign in with email code',
  emailRequiredBody: 'Enter your account email.',
  codeSent: 'Code sent',
  checkEmailForCode: 'Check your email for the 6-digit login code.',
  couldNotSendCode: 'Could not send code',
  noSessionReturned: 'No session returned. Please try again.',
  invalidOrExpiredCode: 'Invalid or expired code',
  invalidCode: 'Invalid code',
  enterSixDigitCode: 'Enter the 6-digit code from your email.',
  sixDigitCodeLabel: '6-digit code',
  sendCode: 'Send code',
  verifyAndSignIn: 'Verify & sign in',
  resendCode: 'Resend code',

  // ── TwoFactorChallengeScreen ──────────────────────────────────────────────
  twoFactorTitle: 'Two-factor verification',
  twoFactorHelp:
    'Enter the 6-digit code from your authenticator app to finish signing in.',
  authenticatorCodeLabel: 'Authenticator code',
  invalidCodeAlert: 'Enter the 6-digit code from your authenticator app.',
  noSessionSignInAgain: 'No session returned. Please sign in again.',
  invalidVerificationCode: 'Invalid verification code',

  // ── Backup codes (AUTH-4) ──
  twoFactorBackupHelp: 'Enter one of your saved backup codes to finish signing in.',
  backupCodeLabel: 'Backup code',
  useBackupCode: 'Use a backup code instead',
  useAuthenticatorInstead: 'Use authenticator app instead',
  verify: 'Verify',

  // ── TruecallerLoginScreen ─────────────────────────────────────────────────
  truecallerTitle: 'Sign in with Truecaller',
  truecallerSubtitle: 'Verify with your Indian mobile number in seconds.',
  requestPhonePermissions:
    'We will request phone permissions to verify your number.',
  permissionsRequired:
    'Phone permissions are required to continue with Truecaller{{suffix}}. Please grant them in Settings or sign in with email instead.',
  loginFailed: 'Login failed',
  noSessionByServer: 'No session returned by the server.',
  networkError: 'Network error',
  truecallerAuthFailed: 'Truecaller authentication failed',
  verificationFailed: 'Verification failed',
  missingAccessToken: 'Missing access token from Truecaller.',
  incompleteSignedPayload: 'Incomplete signed payload from Truecaller.',
  truecallerCannotVerify: 'Truecaller could not verify the number.',
  unknownError: 'Unknown error',
  networkCheckMessage:
    'No internet connection. Please check your network and try again',
  truecallerErrorPrefix: 'Truecaller error: ',
  waitingForMissedCall: 'Waiting for missed call',
  missedCallBody:
    'You will receive a missed call shortly. Do not pick it up — Truecaller will verify automatically.',
  expiresIn: 'Expires in {{seconds}}s',
  verifyingWithUpcheck: 'Verifying with Upcheck...',
  signInWithEmail: 'Sign in with email',
  truecallerNoSession: 'The server did not return a session. Please try again.',
  truecallerVerificationFailed: 'Truecaller verification failed. Please try again.',
  networkErrorBody: 'Could not reach the server. Please try again.',

  // ── Truecaller missed-call / OTP (non-Truecaller-user) flow ───────────────
  tcFallbackCta: 'No Truecaller app? Verify with a missed call',
  tcPhoneTitle: 'Verify your number',
  tcPhoneSubtitle:
    "We'll place a quick missed call to verify your number — nothing to type.",
  tcPhoneLabel: 'Mobile number',
  tcFirstNameLabel: 'First name',
  tcFirstNamePlaceholder: 'e.g. Aarav',
  tcLastNameLabel: 'Last name (optional)',
  tcLastNamePlaceholder: 'e.g. Sharma',
  tcSendVerification: 'Verify with missed call',
  tcCallingTitle: 'Calling you…',
  tcCallingBody:
    "We're placing a quick call to {{phone}}. Don't pick up — we'll detect it automatically.",
  tcOtpBody: 'Enter the code sent to {{phone}}.',
  tcVerify: 'Verify',
  tcChangeNumber: 'Use a different number',
  tcInvalidPhone: 'Enter a valid 10-digit mobile number.',
  tcFirstNameRequired: 'Please enter your first name.',
  tcInvalidOtp: 'Enter the code you received.',
  tcVerificationFailed: 'Verification failed. Please try again.',
  tcPermissionsRequired:
    'Phone and call-log permissions are needed to auto-detect the verification call. Please grant them, or sign in with Truecaller / email.',
  tcNoCallDetected:
    "We couldn't detect a verification call. If this number already uses Truecaller, go back and use one-tap sign-in — or try a different number.",
  tcUnsupported:
    'Missed-call verification is only available on Android with the app build that bundles the Truecaller SDK.',

  // ── OtpEntrySection ───────────────────────────────────────────────────────
  enterOtpTitle: 'Enter the OTP',
  otpSubtitle:
    'We sent a verification code to your phone. Enter it below to continue.',
  otpExpired: 'OTP expired',
  otpExpiresIn: 'Expires in {{time}}',
  otpLabel: 'OTP',
  otpPlaceholder: 'Enter the code',
  invalidOtp: 'Invalid OTP',
  resendOtp: 'Resend OTP',
  resendOtpIn: 'Resend OTP in {{time}}',
  verificationFailedError: 'Verification failed',

  // ── PhoneEntrySection ─────────────────────────────────────────────────────
  verifyPhoneTitle: 'Verify your phone number',
  verifyPhoneSubtitle:
    'We will send a verification code to your Indian mobile number.',
  firstNameInputLabel: 'First name',
  firstNameInputPlaceholder: 'Your first name',
  lastNameInputLabel: 'Last name (optional)',
  lastNameInputPlaceholder: 'Your last name',
  mobileNumberLabel: 'Mobile number',
  mobileNumberHint: '10-digit Indian mobile number',
  invalidPhoneError: 'Enter a valid 10-digit Indian mobile number',
  invalidFirstNameError: 'Please enter your first name',
  sendVerificationCode: 'Send verification code',
  consentPrefix: "By creating an account, you agree to our",
  legalPrefix: "By continuing, you agree to our",
  consentAnd: "and",

  // ── Account type (Owner / Worker) ─────────────────────────────────────────
  accountTypeLabel: 'I am a…',
  accountTypeRequired: 'Please choose an account type',
  accountOwnerTitle: 'Farm Owner',
  accountOwnerDesc: 'Set up and manage your own farm',
  accountWorkerTitle: 'Worker',
  accountWorkerDesc: 'Join a farm and log daily work',
};
export default auth;
