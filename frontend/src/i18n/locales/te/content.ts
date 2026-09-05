const content = {
  // ── Diseases ────────────────────────────────────────────────────────────────
  diseases: {
    // List screen
    title: 'వ్యాధి విజ్ఞాన కోశం',
    searchPlaceholder: 'వ్యాధులు వెతుకు…',
    emptySearchTitle: 'వ్యాధులు కనుగొనబడలేదు',
    emptySearchSubtitle: 'వేరే సెర్చ్ పదం ప్రయత్నించండి',
    emptyTitle: 'వ్యాధులు అందుబాటులో లేవు',
    emptySubtitle: 'అందుబాటులో ఉన్నప్పుడు వ్యాధి లైబ్రరీ ఇక్కడ కనిపిస్తుంది',
    errorTitle: 'వ్యాధులు లోడ్ చేయడం విఫలమైంది',
    // Symptom count
    symptomOne: '{{count}} లక్షణం',
    symptomOther: '{{count}} లక్షణాలు',
    // Detail screen
    detailTitle: 'వ్యాధి వివరాలు',
    detailErrorTitle: 'వ్యాధి లోడ్ చేయడం విఫలమైంది',
    detailErrorFallback: 'వ్యాధి కనుగొనబడలేదు',
    alsoKnownAs: 'మరొక పేరు: {{names}}',
    severityLabel: 'తీవ్రత: {{level}}',
    sectionDescription: 'వివరణ',
    sectionImages: 'చిత్రాలు',
    imagesAvailable: '{{count}} చిత్రం అందుబాటులో ఉంది',
    imagesAvailableOther: '{{count}} చిత్రాలు అందుబాటులో ఉన్నాయి',
    noImages: 'చిత్రాలు అందుబాటులో లేవు',
    sectionSymptoms: 'లక్షణాలు',
    sectionPrevention: 'నివారణ',
    sectionTreatment: 'చికిత్స',
    logButton: 'ఈ వ్యాధిని నమోదు చేయి',
    // Severity badge labels
    severityLow: 'తక్కువ',
    severityMedium: 'మధ్యస్థం',
    severityHigh: 'అధికం',
  },

  // ── Reference ───────────────────────────────────────────────────────────────
  reference: {
    title: 'రిఫరెన్స్ డేటా',
    // Tab labels
    tabSpecies: 'జాతులు',
    tabHatcheries: 'హ్యాచరీలు',
    tabBroodstocks: 'బ్రూడ్‌స్టాక్',
    // Loading
    loadingText: 'రిఫరెన్స్ డేటా లోడ్ అవుతోంది…',
    // Add-form titles
    addSpecies: 'జాతి జోడించు',
    addHatchery: 'హ్యాచరీ జోడించు',
    addBroodstock: 'బ్రూడ్‌స్టాక్ జోడించు',
    // Species form fields
    fieldScientificName: 'శాస్త్రీయ పేరు *',
    fieldCommonName: 'సాధారణ పేరు',
    fieldTempMin: 'కనీస ఉష్ణోగ్రత (°C)',
    fieldTempMax: 'గరిష్ట ఉష్ణోగ్రత (°C)',
    fieldPhMin: 'కనీస pH',
    fieldPhMax: 'గరిష్ట pH',
    // Hatchery form fields
    fieldHatcheryName: 'పేరు *',
    fieldLocation: 'స్థానం',
    // Broodstock form fields
    fieldSupplier: 'సరఫరాదారు *',
    fieldLineCode: 'లైన్ కోడ్',
    fieldOrigin: 'మూలం',
    // Placeholders
    placeholderScientificName: 'ఉదా. Penaeus monodon',
    placeholderCommonName: 'ఉదా. బ్లాక్ టైగర్ రొయ్య',
    placeholderTempMin: '25',
    placeholderTempMax: '32',
    placeholderPhMin: '7.5',
    placeholderPhMax: '8.5',
    placeholderHatcheryName: 'ఉదా. కోస్టల్ హ్యాచరీ',
    placeholderHatcheryLocation: 'ఉదా. చెన్నై, TN',
    placeholderSupplier: 'ఉదా. AquaGen India',
    placeholderLineCode: 'ఉదా. AG-SPF-01',
    placeholderOrigin: 'ఉదా. హవాయి, USA',
    // Validation / error alerts
    validationScientificName: 'శాస్త్రీయ పేరు తప్పనిసరి.',
    validationHatcheryName: 'హ్యాచరీ పేరు తప్పనిసరి.',
    validationSupplier: 'సరఫరాదారు తప్పనిసరి.',
    errorCreateSpecies: 'జాతి సృష్టించడం విఫలమైంది.',
    errorCreateHatchery: 'హ్యాచరీ సృష్టించడం విఫలమైంది.',
    errorCreateBroodstock: 'బ్రూడ్‌స్టాక్ సృష్టించడం విఫలమైంది.',
    // Status badges
    statusActive: 'క్రియాశీలం',
    statusInactive: 'నిష్క్రియం',
    // Broodstock line prefix
    linePrefix: 'లైన్: {{code}}',
    // Empty states
    emptySpeciesTitle: 'జాతులు కనుగొనబడలేదు',
    emptySpeciesSubtitle: 'ఇంకా జాతుల రికార్డులు అందుబాటులో లేవు.',
    emptyHatcheriesTitle: 'హ్యాచరీలు కనుగొనబడలేదు',
    emptyHatcheriesSubtitle: 'ఇంకా హ్యాచరీ రికార్డులు అందుబాటులో లేవు.',
    emptyBroodstocksTitle: 'బ్రూడ్‌స్టాక్ కనుగొనబడలేదు',
    emptyBroodstocksSubtitle: 'ఇంకా బ్రూడ్‌స్టాక్ రికార్డులు అందుబాటులో లేవు.',
    // Error state
    errorLoadTitle: 'డేటా లోడ్ కాలేదు',
    // Alert titles
    alertValidation: 'ధృవీకరణ',
  },

  // ── Tasks ───────────────────────────────────────────────────────────────────
  tasks: {
    headerTitle: 'పనులు',
    headerWithFarm: 'పనులు · {{farmName}}',
    headerMyTasks: 'నా పనులు',
    headerMyTasksWithFarm: 'నా పనులు · {{farmName}}',
    addPlaceholder: 'పని జోడించు…',
    errorLoad: 'పనులు లోడ్ కాలేదు',
    // Status labels
    statusOpen: 'తెరవబడింది',
    statusInProgress: 'జరుగుతోంది',
    statusDone: 'పూర్తయింది',

    // Tapping advances a task; a long press undoes a mis-tap.

    revertHint: "వెనక్కి తరలించడానికి ఎక్కువసేపు నొక్కండి",
    // Delete confirmation
    deleteAlertTitle: 'పని తొలగించు',
    deleteAlertMessage: '"{{title}}" తొలగించాలా?',
    // Error alert
    errorAddTitle: 'లోపం',
    errorAddFallback: 'పని జోడించడం విఫలమైంది',
    // Empty state
    emptyTitle: 'ఇంకా పనులు లేవు',
    emptySubtitle: 'పైన ఈ ఫారానికి మొదటి పని జోడించండి. స్థితి ముందుకు వెళ్ళడానికి పని ట్యాప్ చేయండి.',
    // Due date inline
    dueDate: '{{date}} కి గడువు',
  },

  // ── News ────────────────────────────────────────────────────────────────────
  news: {
    title: 'వార్తలు',
    fallbackTitle: 'వార్తలు',
    categoryAll: 'అన్నీ',
    errorLoad: 'వార్తలు లోడ్ కాలేదు',
    errorLoadArticle: 'వ్యాసం లోడ్ కాలేదు',
    emptyTitle: 'వార్తా వ్యాసాలు లేవు',
    emptySubtitle: 'తాజా నవీనతల కోసం తర్వాత తనిఖీ చేయండి.',
    noRecentNews: 'ఇటీవలి వార్తలు లేవు',
    noRecentNewsSubtitle: 'చూపించడానికి కొత్తదేమీ కనిపించలేదు. మళ్ళీ తనిఖీ చేయడానికి కిందికి లాగండి.',
    ago: '{{ago}} క్రితం',
    categories: {
      market: 'మార్కెట్ & ధరలు',
      regulation: 'నియమాలు & నిబంధనలు',
      disease: 'వ్యాధి & ఆరోగ్యం',
      research: 'పరిశోధన',
      production: 'సాగు & ఉత్పత్తి',
      trade: 'ఎగుమతులు & వాణిజ్యం',
    },
    attribution: '{{source}} నుండి',
    readAtSource: '{{source}} లో చదవండి',
    readFullArticle: 'పూర్తి కథనం చదవండి',
    offlineTitle: 'సేవ్ చేసిన వార్తలు చూపుతోంది',
    offlineMessage: 'కనెక్షన్ లేదు — చివరి అప్‌డేట్ {{date}}.',
    offlineLink: 'ఈ కథనానికి ఇంటర్నెట్ కనెక్షన్ అవసరం.',
    translate: {
      action: 'అనువదించి వివరించండి',
      copied: 'ప్రాంప్ట్ క్లిప్‌బోర్డ్‌కు కాపీ అయింది',
      modalTitle: 'అనువదించి వివరించండి',
      modalBody: 'షేర్ ఆప్షన్ తెరవలేకపోయాం. దిగువ ప్రాంప్ట్‌ను కాపీ చేసి మీ అనువాద యాప్‌లో పేస్ట్ చేయండి.',
      copyButton: 'ప్రాంప్ట్ కాపీ చేయండి',
      close: 'మూసివేయి',
      prompt: {
        instruction: 'ఈ వార్తా కథనాన్ని తెలుగులోకి అనువదించి, ఒక రొయ్యల రైతు కోసం సరళమైన భాషలో వివరించండి. మొదట ఒక వాక్యంలో అనువాదం ఇవ్వండి, తర్వాత ఒక చిన్న వివరణ ఇవ్వండి.',
        headline: 'శీర్షిక',
        summary: 'సారాంశం',
        source: 'మూలం',
        shared: 'Upcheck యాప్ నుండి షేర్ చేయబడింది.',
      },
    },
  },
};

export default content;
