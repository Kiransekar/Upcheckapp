const content = {
  // ── Diseases ────────────────────────────────────────────────────────────────
  diseases: {
    // List screen
    title: 'Disease Encyclopedia',
    searchPlaceholder: 'Search diseases…',
    emptySearchTitle: 'No diseases found',
    emptySearchSubtitle: 'Try a different search term',
    emptyTitle: 'No diseases available',
    emptySubtitle: 'Disease library will appear here when available',
    errorTitle: 'Failed to load diseases',
    // Symptom count
    symptomOne: '{{count}} symptom',
    symptomOther: '{{count}} symptoms',
    // Detail screen
    detailTitle: 'Disease Details',
    detailErrorTitle: 'Failed to load disease',
    detailErrorFallback: 'Disease not found',
    alsoKnownAs: 'Also known as: {{names}}',
    severityLabel: 'Severity: {{level}}',
    sectionDescription: 'Description',
    sectionImages: 'Images',
    imagesAvailable: '{{count}} image available',
    imagesAvailableOther: '{{count}} images available',
    noImages: 'No images available',
    sectionSymptoms: 'Symptoms',
    sectionPrevention: 'Prevention',
    sectionTreatment: 'Treatment',
    logButton: 'Log This Disease',
    // Severity badge labels
    severityLow: 'Low',
    severityMedium: 'Medium',
    severityHigh: 'High',
  },

  // ── Reference ───────────────────────────────────────────────────────────────
  reference: {
    title: 'Reference Data',
    // Tab labels
    tabSpecies: 'Species',
    tabHatcheries: 'Hatcheries',
    tabBroodstocks: 'Broodstocks',
    // Loading
    loadingText: 'Loading reference data…',
    // Add-form titles
    addSpecies: 'Add Species',
    addHatchery: 'Add Hatchery',
    addBroodstock: 'Add Broodstock',
    // Species form fields
    fieldScientificName: 'Scientific Name *',
    fieldCommonName: 'Common Name',
    fieldTempMin: 'Temp Min (°C)',
    fieldTempMax: 'Temp Max (°C)',
    fieldPhMin: 'pH Min',
    fieldPhMax: 'pH Max',
    // Hatchery form fields
    fieldHatcheryName: 'Name *',
    fieldLocation: 'Location',
    // Broodstock form fields
    fieldSupplier: 'Supplier *',
    fieldLineCode: 'Line Code',
    fieldOrigin: 'Origin',
    // Placeholders
    placeholderScientificName: 'e.g. Penaeus monodon',
    placeholderCommonName: 'e.g. Black Tiger Shrimp',
    placeholderTempMin: '25',
    placeholderTempMax: '32',
    placeholderPhMin: '7.5',
    placeholderPhMax: '8.5',
    placeholderHatcheryName: 'e.g. Coastal Hatchery',
    placeholderHatcheryLocation: 'e.g. Chennai, TN',
    placeholderSupplier: 'e.g. AquaGen India',
    placeholderLineCode: 'e.g. AG-SPF-01',
    placeholderOrigin: 'e.g. Hawaii, USA',
    // Validation / error alerts
    validationScientificName: 'Scientific name is required.',
    validationHatcheryName: 'Hatchery name is required.',
    validationSupplier: 'Supplier is required.',
    errorCreateSpecies: 'Failed to create species.',
    errorCreateHatchery: 'Failed to create hatchery.',
    errorCreateBroodstock: 'Failed to create broodstock.',
    // Status badges
    statusActive: 'Active',
    statusInactive: 'Inactive',
    // Broodstock line prefix
    linePrefix: 'Line: {{code}}',
    // Empty states
    emptySpeciesTitle: 'No Species Found',
    emptySpeciesSubtitle: 'No species records are available yet.',
    emptyHatcheriesTitle: 'No Hatcheries Found',
    emptyHatcheriesSubtitle: 'No hatchery records are available yet.',
    emptyBroodstocksTitle: 'No Broodstocks Found',
    emptyBroodstocksSubtitle: 'No broodstock records are available yet.',
    // Error state
    errorLoadTitle: "Couldn't Load Data",
    // Alert titles
    alertValidation: 'Validation',
  },

  // ── Tasks ───────────────────────────────────────────────────────────────────
  tasks: {
    headerTitle: 'Tasks',
    headerWithFarm: 'Tasks · {{farmName}}',
    headerMyTasks: 'My tasks',
    headerMyTasksWithFarm: 'My tasks · {{farmName}}',
    addPlaceholder: 'Add a task…',
    errorLoad: "Couldn't Load Tasks",
    // Status labels
    statusOpen: 'Open',
    statusInProgress: 'In Progress',
    statusDone: 'Done',

    // Tapping advances a task; a long press undoes a mis-tap.

    revertHint: "Long press to move it back",
    // Delete confirmation
    deleteAlertTitle: 'Delete Task',
    deleteAlertMessage: 'Delete "{{title}}"?',
    // Error alert
    errorAddTitle: 'Error',
    errorAddFallback: 'Failed to add task',
    // Empty state
    emptyTitle: 'No Tasks Yet',
    emptySubtitle: 'Add the first to-do for this farm above. Tap a task to advance its status.',
    // Due date inline
    dueDate: 'due {{date}}',
  },

  // ── News ────────────────────────────────────────────────────────────────────
  news: {
    title: 'News',
    fallbackTitle: 'News',
    categoryAll: 'All',
    errorLoad: "Couldn't Load News",
    errorLoadArticle: "Couldn't Load Article",
    emptyTitle: 'No News Articles',
    emptySubtitle: 'Check back later for the latest updates.',
    categories: {
      market: 'Market & prices',
      regulation: 'Rules & regulations',
      disease: 'Disease & health',
      research: 'Research',
      production: 'Farming & production',
      trade: 'Exports & trade',
    },
    attribution: 'via {{source}}',
    readAtSource: 'Read at {{source}}',
    readFullArticle: 'Read the full article',
    offlineTitle: 'Showing saved news',
    offlineMessage: 'No connection — last updated {{date}}.',
    offlineLink: 'This article needs a connection.',
  },
};

export default content;
