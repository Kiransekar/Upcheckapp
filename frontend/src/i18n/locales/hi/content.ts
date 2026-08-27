const content = {
  // ── Diseases ────────────────────────────────────────────────────────────────
  diseases: {
    // List screen
    title: 'रोग विश्वकोश',
    searchPlaceholder: 'रोग खोजें…',
    emptySearchTitle: 'कोई रोग नहीं मिला',
    emptySearchSubtitle: 'अलग खोज शब्द आजमाएं',
    emptyTitle: 'कोई रोग उपलब्ध नहीं',
    emptySubtitle: 'रोग पुस्तकालय उपलब्ध होने पर यहाँ दिखेगा',
    errorTitle: 'रोग लोड करने में विफल',
    // Symptom count
    symptomOne: '{{count}} लक्षण',
    symptomOther: '{{count}} लक्षण',
    // Detail screen
    detailTitle: 'रोग विवरण',
    detailErrorTitle: 'रोग लोड करने में विफल',
    detailErrorFallback: 'रोग नहीं मिला',
    alsoKnownAs: 'अन्य नाम: {{names}}',
    severityLabel: 'गंभीरता: {{level}}',
    sectionDescription: 'विवरण',
    sectionImages: 'चित्र',
    imagesAvailable: '{{count}} चित्र उपलब्ध',
    imagesAvailableOther: '{{count}} चित्र उपलब्ध',
    noImages: 'कोई चित्र उपलब्ध नहीं',
    sectionSymptoms: 'लक्षण',
    sectionPrevention: 'रोकथाम',
    sectionTreatment: 'उपचार',
    logButton: 'यह रोग दर्ज करें',
    // Severity badge labels
    severityLow: 'कम',
    severityMedium: 'मध्यम',
    severityHigh: 'अधिक',
  },

  // ── Reference ───────────────────────────────────────────────────────────────
  reference: {
    title: 'संदर्भ डेटा',
    // Tab labels
    tabSpecies: 'प्रजातियाँ',
    tabHatcheries: 'हैचरी',
    tabBroodstocks: 'ब्रूडस्टॉक',
    // Loading
    loadingText: 'संदर्भ डेटा लोड हो रहा है…',
    // Add-form titles
    addSpecies: 'प्रजाति जोड़ें',
    addHatchery: 'हैचरी जोड़ें',
    addBroodstock: 'ब्रूडस्टॉक जोड़ें',
    // Species form fields
    fieldScientificName: 'वैज्ञानिक नाम *',
    fieldCommonName: 'सामान्य नाम',
    fieldTempMin: 'न्यूनतम तापमान (°C)',
    fieldTempMax: 'अधिकतम तापमान (°C)',
    fieldPhMin: 'न्यूनतम pH',
    fieldPhMax: 'अधिकतम pH',
    // Hatchery form fields
    fieldHatcheryName: 'नाम *',
    fieldLocation: 'स्थान',
    // Broodstock form fields
    fieldSupplier: 'आपूर्तिकर्ता *',
    fieldLineCode: 'लाइन कोड',
    fieldOrigin: 'उत्पत्ति',
    // Placeholders
    placeholderScientificName: 'उदा. Penaeus monodon',
    placeholderCommonName: 'उदा. ब्लैक टाइगर श्रिम्प',
    placeholderTempMin: '25',
    placeholderTempMax: '32',
    placeholderPhMin: '7.5',
    placeholderPhMax: '8.5',
    placeholderHatcheryName: 'उदा. कोस्टल हैचरी',
    placeholderHatcheryLocation: 'उदा. चेन्नई, TN',
    placeholderSupplier: 'उदा. AquaGen India',
    placeholderLineCode: 'उदा. AG-SPF-01',
    placeholderOrigin: 'उदा. हवाई, USA',
    // Validation / error alerts
    validationScientificName: 'वैज्ञानिक नाम आवश्यक है।',
    validationHatcheryName: 'हैचरी का नाम आवश्यक है।',
    validationSupplier: 'आपूर्तिकर्ता आवश्यक है।',
    errorCreateSpecies: 'प्रजाति बनाने में विफल।',
    errorCreateHatchery: 'हैचरी बनाने में विफल।',
    errorCreateBroodstock: 'ब्रूडस्टॉक बनाने में विफल।',
    // Status badges
    statusActive: 'सक्रिय',
    statusInactive: 'निष्क्रिय',
    // Broodstock line prefix
    linePrefix: 'लाइन: {{code}}',
    // Empty states
    emptySpeciesTitle: 'कोई प्रजाति नहीं मिली',
    emptySpeciesSubtitle: 'अभी कोई प्रजाति रिकॉर्ड उपलब्ध नहीं है।',
    emptyHatcheriesTitle: 'कोई हैचरी नहीं मिली',
    emptyHatcheriesSubtitle: 'अभी कोई हैचरी रिकॉर्ड उपलब्ध नहीं है।',
    emptyBroodstocksTitle: 'कोई ब्रूडस्टॉक नहीं मिला',
    emptyBroodstocksSubtitle: 'अभी कोई ब्रूडस्टॉक रिकॉर्ड उपलब्ध नहीं है।',
    // Error state
    errorLoadTitle: 'डेटा लोड नहीं हो सका',
    // Alert titles
    alertValidation: 'सत्यापन',
  },

  // ── Tasks ───────────────────────────────────────────────────────────────────
  tasks: {
    headerTitle: 'कार्य',
    headerWithFarm: 'कार्य · {{farmName}}',
    headerMyTasks: 'मेरे कार्य',
    headerMyTasksWithFarm: 'मेरे कार्य · {{farmName}}',
    addPlaceholder: 'कार्य जोड़ें…',
    errorLoad: 'कार्य लोड नहीं हो सके',
    // Status labels
    statusOpen: 'खुला',
    statusInProgress: 'प्रगति में',
    statusDone: 'पूर्ण',

    // Tapping advances a task; a long press undoes a mis-tap.

    revertHint: "वापस ले जाने के लिए देर तक दबाएँ",
    // Delete confirmation
    deleteAlertTitle: 'कार्य हटाएं',
    deleteAlertMessage: '"{{title}}" हटाएं?',
    // Error alert
    errorAddTitle: 'त्रुटि',
    errorAddFallback: 'कार्य जोड़ने में विफल',
    // Empty state
    emptyTitle: 'अभी कोई कार्य नहीं',
    emptySubtitle: 'ऊपर इस फार्म के लिए पहला कार्य जोड़ें। स्थिति बदलने के लिए किसी कार्य पर टैप करें।',
    // Due date inline
    dueDate: '{{date}} को देय',
  },

  // ── News ────────────────────────────────────────────────────────────────────
  news: {
    title: 'समाचार',
    fallbackTitle: 'समाचार',
    categoryAll: 'सभी',
    errorLoad: 'समाचार लोड नहीं हो सके',
    errorLoadArticle: 'लेख लोड नहीं हो सका',
    emptyTitle: 'कोई समाचार लेख नहीं',
    emptySubtitle: 'नवीनतम अपडेट के लिए बाद में देखें।',
  },
};

export default content;
