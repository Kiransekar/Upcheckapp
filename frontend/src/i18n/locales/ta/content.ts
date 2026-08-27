const content = {
  // ── Diseases ────────────────────────────────────────────────────────────────
  diseases: {
    // List screen
    title: 'நோய் கலைக்களஞ்சியம்',
    searchPlaceholder: 'நோய்களை தேடு…',
    emptySearchTitle: 'நோய்கள் கிடைக்கவில்லை',
    emptySearchSubtitle: 'வேறொரு தேடல் சொல்லை முயற்சிக்கவும்',
    emptyTitle: 'நோய்கள் கிடைக்கவில்லை',
    emptySubtitle: 'நோய் நூலகம் கிடைக்கும்போது இங்கே தெரியும்',
    errorTitle: 'நோய்களை ஏற்றத் தோல்வியடைந்தது',
    // Symptom count
    symptomOne: '{{count}} அறிகுறி',
    symptomOther: '{{count}} அறிகுறிகள்',
    // Detail screen
    detailTitle: 'நோய் விவரங்கள்',
    detailErrorTitle: 'நோயை ஏற்றத் தோல்வியடைந்தது',
    detailErrorFallback: 'நோய் கிடைக்கவில்லை',
    alsoKnownAs: 'மற்றும் அறியப்படுவது: {{names}}',
    severityLabel: 'தீவிரம்: {{level}}',
    sectionDescription: 'விளக்கம்',
    sectionImages: 'படங்கள்',
    imagesAvailable: '{{count}} படம் கிடைக்கிறது',
    imagesAvailableOther: '{{count}} படங்கள் கிடைக்கின்றன',
    noImages: 'படங்கள் இல்லை',
    sectionSymptoms: 'அறிகுறிகள்',
    sectionPrevention: 'தடுப்பு',
    sectionTreatment: 'சிகிச்சை',
    logButton: 'இந்த நோயை பதிவு செய்',
    // Severity badge labels
    severityLow: 'குறைவான',
    severityMedium: 'மிதமான',
    severityHigh: 'தீவிரமான',
  },

  // ── Reference ───────────────────────────────────────────────────────────────
  reference: {
    title: 'குறிப்பு தரவு',
    // Tab labels
    tabSpecies: 'இனங்கள்',
    tabHatcheries: 'குஞ்சு பொரிப்பகங்கள்',
    tabBroodstocks: 'ப்ரூட்ஸ்டாக்',
    // Loading
    loadingText: 'குறிப்பு தரவை ஏற்றுகிறது…',
    // Add-form titles
    addSpecies: 'இனம் சேர்',
    addHatchery: 'குஞ்சு பொரிப்பகம் சேர்',
    addBroodstock: 'ப்ரூட்ஸ்டாக் சேர்',
    // Species form fields
    fieldScientificName: 'அறிவியல் பெயர் *',
    fieldCommonName: 'பொதுவான பெயர்',
    fieldTempMin: 'குறைந்தபட்ச வெப்பநிலை (°C)',
    fieldTempMax: 'அதிகபட்ச வெப்பநிலை (°C)',
    fieldPhMin: 'குறைந்தபட்ச pH',
    fieldPhMax: 'அதிகபட்ச pH',
    // Hatchery form fields
    fieldHatcheryName: 'பெயர் *',
    fieldLocation: 'இடம்',
    // Broodstock form fields
    fieldSupplier: 'சப்ளையர் *',
    fieldLineCode: 'வரிசை குறியீடு',
    fieldOrigin: 'தோற்றம்',
    // Placeholders
    placeholderScientificName: 'எ.கா. Penaeus monodon',
    placeholderCommonName: 'எ.கா. கருப்பு புலி இறால்',
    placeholderTempMin: '25',
    placeholderTempMax: '32',
    placeholderPhMin: '7.5',
    placeholderPhMax: '8.5',
    placeholderHatcheryName: 'எ.கா. கடலோர குஞ்சு பொரிப்பகம்',
    placeholderHatcheryLocation: 'எ.கா. சென்னை, TN',
    placeholderSupplier: 'எ.கா. AquaGen India',
    placeholderLineCode: 'எ.கா. AG-SPF-01',
    placeholderOrigin: 'எ.கா. Hawaii, USA',
    // Validation / error alerts
    validationScientificName: 'அறிவியல் பெயர் தேவை.',
    validationHatcheryName: 'குஞ்சு பொரிப்பகம் பெயர் தேவை.',
    validationSupplier: 'சப்ளையர் தேவை.',
    errorCreateSpecies: 'இனம் உருவாக்கத் தோல்வியடைந்தது.',
    errorCreateHatchery: 'குஞ்சு பொரிப்பகம் உருவாக்கத் தோல்வியடைந்தது.',
    errorCreateBroodstock: 'ப்ரூட்ஸ்டாக் உருவாக்கத் தோல்வியடைந்தது.',
    // Status badges
    statusActive: 'செயலில்',
    statusInactive: 'செயலற்று',
    // Broodstock line prefix
    linePrefix: 'வரிசை: {{code}}',
    // Empty states
    emptySpeciesTitle: 'இனங்கள் கிடைக்கவில்லை',
    emptySpeciesSubtitle: 'இன பதிவுகள் இன்னும் இல்லை.',
    emptyHatcheriesTitle: 'குஞ்சு பொரிப்பகங்கள் கிடைக்கவில்லை',
    emptyHatcheriesSubtitle: 'குஞ்சு பொரிப்பகம் பதிவுகள் இன்னும் இல்லை.',
    emptyBroodstocksTitle: 'ப்ரூட்ஸ்டாக் கிடைக்கவில்லை',
    emptyBroodstocksSubtitle: 'ப்ரூட்ஸ்டாக் பதிவுகள் இன்னும் இல்லை.',
    // Error state
    errorLoadTitle: 'தரவை ஏற்ற முடியவில்லை',
    // Alert titles
    alertValidation: 'சரிபார்ப்பு',
  },

  // ── Tasks ───────────────────────────────────────────────────────────────────
  tasks: {
    headerTitle: 'பணிகள்',
    headerWithFarm: 'பணிகள் · {{farmName}}',
    headerMyTasks: 'எனது பணிகள்',
    headerMyTasksWithFarm: 'எனது பணிகள் · {{farmName}}',
    addPlaceholder: 'ஒரு பணி சேர்க்கவும்…',
    errorLoad: 'பணிகளை ஏற்ற முடியவில்லை',
    // Status labels
    statusOpen: 'திறந்த',
    statusInProgress: 'நடைபெறுகிறது',
    statusDone: 'முடிந்தது',

    // Tapping advances a task; a long press undoes a mis-tap.

    revertHint: "பின்னால் நகர்த்த நீண்ட நேரம் அழுத்தவும்",
    // Delete confirmation
    deleteAlertTitle: 'பணியை நீக்கு',
    deleteAlertMessage: '"{{title}}" நீக்கவா?',
    // Error alert
    errorAddTitle: 'பிழை',
    errorAddFallback: 'பணி சேர்க்கத் தோல்வியடைந்தது',
    // Empty state
    emptyTitle: 'பணிகள் இன்னும் இல்லை',
    emptySubtitle: 'இந்த பண்ணைக்கான முதல் பணியை மேலே சேர்க்கவும். நிலையை மாற்ற ஒரு பணியை தட்டவும்.',
    // Due date inline
    dueDate: 'காலக்கெடு {{date}}',
  },

  // ── News ────────────────────────────────────────────────────────────────────
  news: {
    title: 'செய்திகள்',
    fallbackTitle: 'செய்திகள்',
    categoryAll: 'அனைத்தும்',
    errorLoad: 'செய்திகளை ஏற்ற முடியவில்லை',
    errorLoadArticle: 'கட்டுரையை ஏற்ற முடியவில்லை',
    emptyTitle: 'செய்தி கட்டுரைகள் இல்லை',
    emptySubtitle: 'சமீபத்திய புதுப்பிப்புகளுக்கு பின்னர் சரிபார்க்கவும்.',
  },
};

export default content;
