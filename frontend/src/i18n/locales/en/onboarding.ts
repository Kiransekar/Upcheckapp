// First-run join-a-farm step for workers (see JoinFarmScreen).
const onboarding = {
  joinFarmTitle: 'Join your farm',
  joinFarmSubtitle: 'Enter the farm code your owner or manager shared with you.',
  joinFarmCodeLabel: 'Farm code',
  joinFarmCodePlaceholder: '8-character code',
  joinFarmCta: 'Join farm',
  joinFarmSkip: "I'll do this later",
  joinFarmSuccessTitle: 'You joined the farm',
  joinFarmSuccessSub: 'You are now a worker on {{name}}.',
  joinFarmError: 'Could not join with that code. Check it and try again.',

  // First-run onboarding flow (docs/design/onboarding/*)
  stepOf: "Step {{current}} of {{total}}",
  languageTitle: "Choose your language",
  welcomeTitle: "Welcome to Neerani",
  welcomeSubtitle: "Your shrimp farm's daily assistant",
  welcomeProp1: "Log water, feed and growth in seconds",
  welcomeProp2: "Smart advice to boost survival and profit",
  welcomeProp3: "Add workers to share the daily work",
  welcomeCta: "Get started",
  welcomeSkip: "Skip for now",
  intentTitle: "What brings you to Neerani?",
  intentOwnTitle: "I run my own farm",
  intentOwnSub: "Set up your farm and ponds",
  intentWorkTitle: "I work on someone's farm",
  intentWorkSub: "Join a farm with a code",
  intentFootnote: "You can do both later — this only decides where we start.",
  joinFarmCodeHint: "8 characters, letters and numbers.",
  joinFarmScanQr: "Scan QR code instead",
  joinFarmScanClose: "Close scanner",
  joinFarmCameraDenied: "Camera permission is needed to scan a code.",
  joinedBody: "You can log water, feed and growth on this farm.",
  joinedCta: "Go to dashboard",
  joinedPendingTitle: "Your request was sent",
  joinedPendingBody: "The owner must approve you before you can log anything on this farm.",
};

export default onboarding;
