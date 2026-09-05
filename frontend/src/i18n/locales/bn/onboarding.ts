// First-run join-a-farm step for workers (see JoinFarmScreen).
const onboarding = {
  joinFarmTitle: 'আপনার খামারে যোগ দিন',
  joinFarmSubtitle: 'আপনার মালিক বা ম্যানেজারের দেওয়া খামার কোডটি লিখুন।',
  joinFarmCodeLabel: 'খামার কোড',
  joinFarmCodePlaceholder: '৮-অক্ষরের কোড',
  joinFarmCta: 'খামারে যোগ দিন',
  joinFarmSkip: 'পরে করব',
  joinFarmSuccessTitle: 'আপনি খামারে যোগ দিয়েছেন',
  joinFarmSuccessSub: 'আপনি এখন {{name}}-এ একজন কর্মী।',
  joinFarmError: 'এই কোড দিয়ে যোগ দেওয়া যায়নি। কোডটি যাচাই করে আবার চেষ্টা করুন।',

  // First-run onboarding flow (docs/design/onboarding/*)
  stepOf: "ধাপ {{current}} / {{total}}",
  languageTitle: "আপনার ভাষা বেছে নিন",
  welcomeTitle: "আপচেক-এ স্বাগতম",
  welcomeSubtitle: "আপনার চিংড়ি খামারের দৈনন্দিন সহায়ক",
  welcomeProp1: "পানি, খাবার ও বৃদ্ধি কয়েক সেকেন্ডে লিখে রাখুন",
  welcomeProp2: "বাঁচার হার ও মুনাফা বাড়াতে স্মার্ট পরামর্শ",
  welcomeProp3: "দৈনন্দিন কাজ ভাগ করতে কর্মী যোগ করুন",
  welcomeCta: "শুরু করুন",
  welcomeSkip: "আপাতত এড়িয়ে যান",
  intentTitle: "আপনি আপচেক-এ কেন এসেছেন?",
  intentOwnTitle: "আমি নিজের খামার চালাই",
  intentOwnSub: "আপনার খামার ও পুকুর সেট করুন",
  intentWorkTitle: "আমি অন্যের খামারে কাজ করি",
  intentWorkSub: "কোড দিয়ে একটি খামারে যোগ দিন",
  intentFootnote: "পরে দুটোই করতে পারবেন — এটি শুধু ঠিক করে আমরা কোথা থেকে শুরু করব।",
  joinFarmCodeHint: "৮টি অক্ষর, অক্ষর ও সংখ্যা।",
  joinFarmScanQr: "এর বদলে QR কোড স্ক্যান করুন",
  joinFarmScanClose: "স্ক্যানার বন্ধ করুন",
  joinFarmCameraDenied: "কোড স্ক্যান করতে ক্যামেরার অনুমতি দরকার।",
  joinedBody: "এই খামারে আপনি পানি, খাবার ও বৃদ্ধি লিখে রাখতে পারবেন।",
  joinedCta: "ড্যাশবোর্ডে যান",
  joinedPendingTitle: "আপনার অনুরোধ পাঠানো হয়েছে",
  joinedPendingBody: "এই খামারে কিছু লেখার আগে মালিককে আপনাকে অনুমোদন দিতে হবে।",
};

export default onboarding;
