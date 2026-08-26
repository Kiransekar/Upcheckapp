const content = {
  // ── Diseases ────────────────────────────────────────────────────────────────
  diseases: {
    // List screen
    title: 'রোগ বিশ্বকোষ',
    searchPlaceholder: 'রোগ অনুসন্ধান করুন…',
    emptySearchTitle: 'কোনো রোগ পাওয়া যায়নি',
    emptySearchSubtitle: 'ভিন্ন অনুসন্ধান শব্দ ব্যবহার করুন',
    emptyTitle: 'কোনো রোগ পাওয়া যাচ্ছে না',
    emptySubtitle: 'রোগের লাইব্রেরি পাওয়া গেলে এখানে দেখাবে',
    errorTitle: 'রোগ লোড করতে ব্যর্থ',
    // Symptom count
    symptomOne: '{{count}}টি লক্ষণ',
    symptomOther: '{{count}}টি লক্ষণ',
    // Detail screen
    detailTitle: 'রোগের বিবরণ',
    detailErrorTitle: 'রোগ লোড করতে ব্যর্থ',
    detailErrorFallback: 'রোগ পাওয়া যায়নি',
    alsoKnownAs: 'অন্য নামে পরিচিত: {{names}}',
    severityLabel: 'তীব্রতা: {{level}}',
    sectionDescription: 'বিবরণ',
    sectionImages: 'ছবি',
    imagesAvailable: '{{count}}টি ছবি পাওয়া যাচ্ছে',
    imagesAvailableOther: '{{count}}টি ছবি পাওয়া যাচ্ছে',
    noImages: 'কোনো ছবি পাওয়া যায়নি',
    sectionSymptoms: 'লক্ষণ',
    sectionPrevention: 'প্রতিরোধ',
    sectionTreatment: 'চিকিৎসা',
    logButton: 'এই রোগটি লগ করুন',
    // Severity badge labels
    severityLow: 'কম',
    severityMedium: 'মাঝারি',
    severityHigh: 'বেশি',
  },

  // ── Reference ───────────────────────────────────────────────────────────────
  reference: {
    title: 'রেফারেন্স ডেটা',
    // Tab labels
    tabSpecies: 'প্রজাতি',
    tabHatcheries: 'হ্যাচারি',
    tabBroodstocks: 'ব্রুডস্টক',
    // Loading
    loadingText: 'রেফারেন্স ডেটা লোড হচ্ছে…',
    // Add-form titles
    addSpecies: 'প্রজাতি যোগ করুন',
    addHatchery: 'হ্যাচারি যোগ করুন',
    addBroodstock: 'ব্রুডস্টক যোগ করুন',
    // Species form fields
    fieldScientificName: 'বৈজ্ঞানিক নাম *',
    fieldCommonName: 'সাধারণ নাম',
    fieldTempMin: 'সর্বনিম্ন তাপমাত্রা (°C)',
    fieldTempMax: 'সর্বোচ্চ তাপমাত্রা (°C)',
    fieldPhMin: 'সর্বনিম্ন pH',
    fieldPhMax: 'সর্বোচ্চ pH',
    // Hatchery form fields
    fieldHatcheryName: 'নাম *',
    fieldLocation: 'অবস্থান',
    // Broodstock form fields
    fieldSupplier: 'সরবরাহকারী *',
    fieldLineCode: 'লাইন কোড',
    fieldOrigin: 'উৎস',
    // Placeholders
    placeholderScientificName: 'যেমন: Penaeus monodon',
    placeholderCommonName: 'যেমন: ব্ল্যাক টাইগার চিংড়ি',
    placeholderTempMin: '25',
    placeholderTempMax: '32',
    placeholderPhMin: '7.5',
    placeholderPhMax: '8.5',
    placeholderHatcheryName: 'যেমন: কোস্টাল হ্যাচারি',
    placeholderHatcheryLocation: 'যেমন: চেন্নাই, TN',
    placeholderSupplier: 'যেমন: AquaGen India',
    placeholderLineCode: 'যেমন: AG-SPF-01',
    placeholderOrigin: 'যেমন: হাওয়াই, USA',
    // Validation / error alerts
    validationScientificName: 'বৈজ্ঞানিক নাম আবশ্যক।',
    validationHatcheryName: 'হ্যাচারির নাম আবশ্যক।',
    validationSupplier: 'সরবরাহকারী আবশ্যক।',
    errorCreateSpecies: 'প্রজাতি তৈরিতে ব্যর্থ।',
    errorCreateHatchery: 'হ্যাচারি তৈরিতে ব্যর্থ।',
    errorCreateBroodstock: 'ব্রুডস্টক তৈরিতে ব্যর্থ।',
    // Status badges
    statusActive: 'সক্রিয়',
    statusInactive: 'নিষ্ক্রিয়',
    // Broodstock line prefix
    linePrefix: 'লাইন: {{code}}',
    // Empty states
    emptySpeciesTitle: 'কোনো প্রজাতি পাওয়া যায়নি',
    emptySpeciesSubtitle: 'এখনও কোনো প্রজাতির রেকর্ড নেই।',
    emptyHatcheriesTitle: 'কোনো হ্যাচারি পাওয়া যায়নি',
    emptyHatcheriesSubtitle: 'এখনও কোনো হ্যাচারির রেকর্ড নেই।',
    emptyBroodstocksTitle: 'কোনো ব্রুডস্টক পাওয়া যায়নি',
    emptyBroodstocksSubtitle: 'এখনও কোনো ব্রুডস্টকের রেকর্ড নেই।',
    // Error state
    errorLoadTitle: 'ডেটা লোড করা যায়নি',
    // Alert titles
    alertValidation: 'যাচাইকরণ',
  },

  // ── Tasks ───────────────────────────────────────────────────────────────────
  tasks: {
    headerTitle: 'কাজ',
    headerWithFarm: 'কাজ · {{farmName}}',
    headerMyTasks: 'আমার কাজ',
    headerMyTasksWithFarm: 'আমার কাজ · {{farmName}}',
    addPlaceholder: 'একটি কাজ যোগ করুন…',
    errorLoad: 'কাজ লোড করা যায়নি',
    // Status labels
    statusOpen: 'খোলা',
    statusInProgress: 'চলমান',
    statusDone: 'সম্পন্ন',

    // Tapping advances a task; a long press undoes a mis-tap.

    revertHint: "পিছনে নিতে চেপে ধরুন",
    // Delete confirmation
    deleteAlertTitle: 'কাজ মুছুন',
    deleteAlertMessage: '"{{title}}" মুছবেন?',
    // Error alert
    errorAddTitle: 'ত্রুটি',
    errorAddFallback: 'কাজ যোগ করতে ব্যর্থ',
    // Empty state
    emptyTitle: 'এখনও কোনো কাজ নেই',
    emptySubtitle: 'উপরে এই খামারের প্রথম কাজটি যোগ করুন। স্ট্যাটাস এগিয়ে নিতে কাজে ট্যাপ করুন।',
    // Due date inline
    dueDate: '{{date}}-এর মধ্যে',
  },

  // ── News ────────────────────────────────────────────────────────────────────
  news: {
    title: 'সংবাদ',
    fallbackTitle: 'সংবাদ',
    categoryAll: 'সব',
    errorLoad: 'সংবাদ লোড করা যায়নি',
    errorLoadArticle: 'নিবন্ধ লোড করা যায়নি',
    emptyTitle: 'কোনো সংবাদ নিবন্ধ নেই',
    emptySubtitle: 'সর্বশেষ আপডেটের জন্য পরে আবার দেখুন।',
  },
};

export default content;
