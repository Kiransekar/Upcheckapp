const simulations = {
  // ── SimulationListScreen ──────────────────────────────────────────────────
  list: {
    title: 'সিমুলেশন',
    statBiomass: '{{value}} kg বায়োমাস',
    statProfit: 'মুনাফা: {{value}}',
    statNa: 'N/A',
    emptyTitle: 'এখনও কোনো সিমুলেশন নেই',
    emptyDesc: 'পরবর্তী চক্র কার্যকরভাবে পরিকল্পনা করতে আপনার প্রথম পূর্বাভাস তৈরি করুন।',
    deleteTitle: 'সিমুলেশন মুছুন',
    deleteMessage: 'এই সংরক্ষিত সিমুলেশনটি সরিয়ে দেবেন?',
    errorDelete: 'সিমুলেশন মুছতে ব্যর্থ',
  
    // artboard p4
    eyebrow: "পরিকল্পনা",
    intro: "আপনি আসলে যে প্রশ্নটি করছেন সেটি বেছে নিন। সংখ্যা পুকুর থেকে আসে — আপনি শুধু যা পরীক্ষা করছেন তাই বদলান।",
    whileRunning: "চক্র চলাকালীন",
    beforeStocking: "পুকুরে মজুত করার আগে",
    saved: "সংরক্ষিত",
    pickPondTitle: "প্রথমে একটি পুকুর বেছে নিন",
    pickPondBody: "এই প্রশ্নটি কোন পুকুর সম্পর্কে তা বেছে নিন, যাতে তার সংখ্যা ব্যবহার করা যায়।",
  },

  // ── SimulationCreateScreen ────────────────────────────────────────────────
  create: {
    title: 'নতুন সিমুলেশন',
    subtitle: 'একটি সক্রিয় পুকুর চক্রে "কী হলে" পরিস্থিতি চালান',
    sectionPond: 'পুকুর',
    labelPondId: 'পুকুর ID *',
    placeholderPondId: 'সক্রিয় চক্র সহ পুকুরের UUID',
    sectionScenario: 'পরিস্থিতির ধরন',
    scenarioFeedChange: 'খাদ্য পরিবর্তন',
    scenarioPriceChange: 'মূল্য পরিবর্তন',
    scenarioStockingDensity: 'মজুদের ঘনত্ব',
    sectionVariables: 'ভেরিয়েবল',
    labelFeedPrice: 'খাদ্যের মূল্য (প্রতি kg)',
    labelGrowthImprovement: 'বৃদ্ধির উন্নতি (%)',
    labelSellingPrice: 'বিক্রয় মূল্য (প্রতি kg)',
    labelStockingDensity: 'মজুদের ঘনত্ব (PL/m²)',
    runSimulation: 'সিমুলেশন চালান',
    errorPondId: 'একটি পুকুর ID লিখুন',
    errorSimFailed: 'সিমুলেশন চালাতে ব্যর্থ',
    validationTitle: 'যাচাইকরণ ত্রুটি',
    simFailedTitle: 'সিমুলেশন ব্যর্থ',
  
    // artboard p4
    eyebrow: "সিমুলেশন",
    whatYouAreChanging: "আপনি যা বদলাচ্ছেন",
    currently: "এখন {{value}}",
  },

  // ── SimulationResultsScreen ───────────────────────────────────────────────
  results: {
    title: 'সিমুলেশনের ফলাফল',
    vsBaseline: 'বেসলাইনের তুলনায়',
    profitDifference: 'মুনাফার পার্থক্য',
    sectionResults: 'সিমুলেশনের ফলাফল',
    labelProjectedBiomass: 'প্রক্ষেপিত বায়োমাস',
    labelProjectedFcr: 'প্রক্ষেপিত FCR',
    labelTotalRevenue: 'মোট রাজস্ব',
    labelTotalCost: 'মোট খরচ',
    sectionProfitComparison: 'মুনাফার তুলনা',
    labelBaselineProfit: 'বেসলাইন নিট মুনাফা:',
    labelSimulatedProfit: 'সিমুলেটেড নিট মুনাফা:',
    labelRiskWarning: 'ঝুঁকির সতর্কতা:',
    noData: 'কোনো সিমুলেশন ডেটা পাওয়া যায়নি।',
  
    // artboard p5
    shortTitle: "ফলাফল",
    whatItPredicts: "এই রান যা বলছে",
    againstDoingNothing: "কিছু না করার তুলনায়",
    barsNote: "ধূসর যা আপনি এমনিতেই পান। সবুজ যা পরিবর্তন যোগ করে।",
    barsNoteLoss: "ধূসর যা আপনি এমনিতেই পান। লাল যা পরিবর্তনের খরচ।",
    whatYouChanged: "আপনি যা বদলেছেন",
    runOn: "{{date}} তারিখে চালানো",
    keepPlan: "এই পরিকল্পনা রাখুন",
    runAgain: "আবার চালান",
  },

  // Questions — artboard p4
  q: {
    feed_change: {
      title: "সস্তা খাবার কি লাভজনক?",
      desc: "খাবারের দাম বনাম FCR ও বৃদ্ধি",
      label: "খাবারের দাম (₹/কেজি)",
      errorValue: "পরীক্ষা করতে খাবারের দাম দিন",
    },
    price_change: {
      title: "বিক্রির দাম বদলালে?",
      desc: "চিংড়ির দাম বনাম আয় ও মার্জিন",
      label: "বিক্রির দাম (₹/কেজি)",
      errorValue: "পরীক্ষা করতে বিক্রির দাম দিন",
    },
    stocking_density: {
      title: "কত ঘনভাবে মজুত করব?",
      desc: "প্রতি m² PL বনাম বেঁচে থাকা ও FCR",
      label: "মজুত ঘনত্ব (PL/m²)",
      errorValue: "পরীক্ষা করতে ঘনত্ব দিন",
    },
  },
};
export default simulations;
