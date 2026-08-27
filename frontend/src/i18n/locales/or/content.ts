const content = {
  // ── Diseases ────────────────────────────────────────────────────────────────
  diseases: {
    // List screen
    title: 'ରୋଗ ବିଶ୍ୱକୋଷ',
    searchPlaceholder: 'ରୋଗ ଖୋଜନ୍ତୁ…',
    emptySearchTitle: 'କୌଣସି ରୋଗ ମିଳିଲା ନାହିଁ',
    emptySearchSubtitle: 'ଅନ୍ୟ ଏକ ଖୋଜ ଶବ୍ଦ ଚେଷ୍ଟା କରନ୍ତୁ',
    emptyTitle: 'କୌଣସି ରୋଗ ଉପଲବ୍ଧ ନାହିଁ',
    emptySubtitle: 'ଉପଲବ୍ଧ ହେଲେ ରୋଗ ଭଣ୍ଡାର ଏଠାରେ ଦେଖାଯିବ',
    errorTitle: 'ରୋଗ ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ',
    // Symptom count
    symptomOne: '{{count}} ଲକ୍ଷଣ',
    symptomOther: '{{count}} ଲକ୍ଷଣ',
    // Detail screen
    detailTitle: 'ରୋଗ ବିବରଣୀ',
    detailErrorTitle: 'ରୋଗ ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ',
    detailErrorFallback: 'ରୋଗ ମିଳିଲା ନାହିଁ',
    alsoKnownAs: 'ଏହା ମଧ୍ୟ ଜଣାଯାଏ: {{names}}',
    severityLabel: 'ଗୁରୁତ୍ୱ: {{level}}',
    sectionDescription: 'ବିବରଣ',
    sectionImages: 'ଛବି',
    imagesAvailable: '{{count}}ଟି ଛବି ଉପଲବ୍ଧ',
    imagesAvailableOther: '{{count}}ଟି ଛବି ଉପଲବ୍ଧ',
    noImages: 'କୌଣସି ଛବି ଉପଲବ୍ଧ ନାହିଁ',
    sectionSymptoms: 'ଲକ୍ଷଣ',
    sectionPrevention: 'ପ୍ରତିଷେଧ',
    sectionTreatment: 'ଚିକିତ୍ସା',
    logButton: 'ଏହି ରୋଗ ଲଗ୍ କରନ୍ତୁ',
    // Severity badge labels
    severityLow: 'ନିମ୍ନ',
    severityMedium: 'ମଧ୍ୟମ',
    severityHigh: 'ଉଚ୍ଚ',
  },

  // ── Reference ───────────────────────────────────────────────────────────────
  reference: {
    title: 'ରେଫରେନ୍ସ ତଥ୍ୟ',
    // Tab labels
    tabSpecies: 'ପ୍ରଜାତି',
    tabHatcheries: 'ହ୍ୟାଚେରି',
    tabBroodstocks: 'ବ୍ରୁଡ୍ ଷ୍ଟକ',
    // Loading
    loadingText: 'ରେଫରେନ୍ସ ତଥ୍ୟ ଲୋଡ୍ ହେଉଛି…',
    // Add-form titles
    addSpecies: 'ପ୍ରଜାତି ଯୋଡ଼ନ୍ତୁ',
    addHatchery: 'ହ୍ୟାଚେରି ଯୋଡ଼ନ୍ତୁ',
    addBroodstock: 'ବ୍ରୁଡ୍ ଷ୍ଟକ ଯୋଡ଼ନ୍ତୁ',
    // Species form fields
    fieldScientificName: 'ବୈଜ୍ଞାନିକ ନାମ *',
    fieldCommonName: 'ସାଧାରଣ ନାମ',
    fieldTempMin: 'ଲଘୁତ୍ତମ ତାପମାତ୍ରା (°C)',
    fieldTempMax: 'ସର୍ବୋଚ୍ଚ ତାପମାତ୍ରା (°C)',
    fieldPhMin: 'ନ୍ୟୂନ pH',
    fieldPhMax: 'ସର୍ବୋଚ୍ଚ pH',
    // Hatchery form fields
    fieldHatcheryName: 'ନାମ *',
    fieldLocation: 'ସ୍ଥାନ',
    // Broodstock form fields
    fieldSupplier: 'ଯୋଗାଣକାରୀ *',
    fieldLineCode: 'ଲାଇନ୍ କୋଡ',
    fieldOrigin: 'ଉତ୍ପତ୍ତି',
    // Placeholders
    placeholderScientificName: 'ଯଥା Penaeus monodon',
    placeholderCommonName: 'ଯଥା Black Tiger Shrimp',
    placeholderTempMin: '25',
    placeholderTempMax: '32',
    placeholderPhMin: '7.5',
    placeholderPhMax: '8.5',
    placeholderHatcheryName: 'ଯଥା Coastal Hatchery',
    placeholderHatcheryLocation: 'ଯଥା Chennai, TN',
    placeholderSupplier: 'ଯଥା AquaGen India',
    placeholderLineCode: 'ଯଥା AG-SPF-01',
    placeholderOrigin: 'ଯଥା Hawaii, USA',
    // Validation / error alerts
    validationScientificName: 'ବୈଜ୍ଞାନିକ ନାମ ଆବଶ୍ୟକ।',
    validationHatcheryName: 'ହ୍ୟାଚେରି ନାମ ଆବଶ୍ୟକ।',
    validationSupplier: 'ଯୋଗାଣକାରୀ ଆବଶ୍ୟକ।',
    errorCreateSpecies: 'ପ୍ରଜାତି ତିଆରି ହୋଇପାରିଲା ନାହିଁ।',
    errorCreateHatchery: 'ହ୍ୟାଚେରି ତିଆରି ହୋଇପାରିଲା ନାହିଁ।',
    errorCreateBroodstock: 'ବ୍ରୁଡ୍ ଷ୍ଟକ ତିଆରି ହୋଇପାରିଲା ନାହିଁ।',
    // Status badges
    statusActive: 'ସକ୍ରିୟ',
    statusInactive: 'ନିଷ୍କ୍ରିୟ',
    // Broodstock line prefix
    linePrefix: 'ଲାଇନ: {{code}}',
    // Empty states
    emptySpeciesTitle: 'କୌଣସି ପ୍ରଜାତି ମିଳିଲା ନାହିଁ',
    emptySpeciesSubtitle: 'ଏ ପର୍ଯ୍ୟନ୍ତ କୌଣସି ପ୍ରଜାତି ରେକର୍ଡ ଉପଲବ୍ଧ ନାହିଁ।',
    emptyHatcheriesTitle: 'କୌଣସି ହ୍ୟାଚେରି ମିଳିଲା ନାହିଁ',
    emptyHatcheriesSubtitle: 'ଏ ପର୍ଯ୍ୟନ୍ତ କୌଣସି ହ୍ୟାଚେରି ରେକର୍ଡ ଉପଲବ୍ଧ ନାହିଁ।',
    emptyBroodstocksTitle: 'କୌଣସି ବ୍ରୁଡ୍ ଷ୍ଟକ ମିଳିଲା ନାହିଁ',
    emptyBroodstocksSubtitle: 'ଏ ପର୍ଯ୍ୟନ୍ତ କୌଣସି ବ୍ରୁଡ୍ ଷ୍ଟକ ରେକର୍ଡ ଉପଲବ୍ଧ ନାହିଁ।',
    // Error state
    errorLoadTitle: 'ତଥ୍ୟ ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ',
    // Alert titles
    alertValidation: 'ଯାଞ୍ଚ',
  },

  // ── Tasks ───────────────────────────────────────────────────────────────────
  tasks: {
    headerTitle: 'କାର୍ଯ୍ୟ',
    headerWithFarm: 'କାର୍ଯ୍ୟ · {{farmName}}',
    headerMyTasks: 'ମୋର କାର୍ଯ୍ୟ',
    headerMyTasksWithFarm: 'ମୋର କାର୍ଯ୍ୟ · {{farmName}}',
    addPlaceholder: 'ଏକ କାର୍ଯ୍ୟ ଯୋଡ଼ନ୍ତୁ…',
    errorLoad: 'କାର୍ଯ୍ୟ ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ',
    // Status labels
    statusOpen: 'ଖୋଲା',
    statusInProgress: 'ଚାଲୁ ଅଛି',
    statusDone: 'ସମ୍ପୂର୍ଣ୍ଣ',

    // Tapping advances a task; a long press undoes a mis-tap.

    revertHint: "ପଛକୁ ନେବାକୁ ଦବାଇ ରଖନ୍ତୁ",
    // Delete confirmation
    deleteAlertTitle: 'କାର୍ଯ୍ୟ ଡିଲିଟ୍ କରନ୍ତୁ',
    deleteAlertMessage: '"{{title}}" ଡିଲିଟ୍ କରିବେ?',
    // Error alert
    errorAddTitle: 'ତ୍ରୁଟି',
    errorAddFallback: 'କାର୍ଯ୍ୟ ଯୋଡ଼ିହୋଇପାରିଲା ନାହିଁ',
    // Empty state
    emptyTitle: 'ଏ ପର୍ଯ୍ୟନ୍ତ କୌଣସି କାର୍ଯ୍ୟ ନାହିଁ',
    emptySubtitle: 'ଉପରେ ଏହି ଫାର୍ମ ପାଇଁ ପ୍ରଥମ କାର୍ଯ୍ୟ ଯୋଡ଼ନ୍ତୁ। ସ୍ଥିତି ଅଗ୍ରସର କରିବାକୁ ଏକ କାର୍ଯ୍ୟରେ ଟ୍ୟାପ୍ କରନ୍ତୁ।',
    // Due date inline
    dueDate: '{{date}} ମଧ୍ୟରେ',
  },

  // ── News ────────────────────────────────────────────────────────────────────
  news: {
    title: 'ସମ୍ବାଦ',
    fallbackTitle: 'ସମ୍ବାଦ',
    categoryAll: 'ସମସ୍ତ',
    errorLoad: 'ସମ୍ବାଦ ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ',
    errorLoadArticle: 'ଆର୍ଟିକ୍ଲ ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ',
    emptyTitle: 'କୌଣସି ସମ୍ବାଦ ଆର୍ଟିକ୍ଲ ନାହିଁ',
    emptySubtitle: 'ସର୍ବଶେଷ ଅଦ୍ୟତନ ପାଇଁ ପରେ ଦେଖନ୍ତୁ।',
  },
};

export default content;
