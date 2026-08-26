const simulations = {
  // ── SimulationListScreen ──────────────────────────────────────────────────
  list: {
    title: 'ସିମୁଲେସନ',
    statBiomass: '{{value}} kg ବାୟୋମାସ',
    statProfit: 'ଲାଭ: {{value}}',
    statNa: 'N/A',
    emptyTitle: 'ଏପର୍ଯ୍ୟନ୍ତ ସିମୁଲେସନ ନାହିଁ',
    emptyDesc: 'ପରବର୍ତ୍ତୀ ଚକ୍ର ଯୋଜନା ଦୃଢ଼ ଭାବେ ପ୍ରଥମ ପୂର୍ବାନୁମାନ ତୈରି କରନ୍ତୁ।',
    deleteTitle: 'ସିମୁଲେସନ ଡିଲିଟ',
    deleteMessage: 'ଏହି ସଞ୍ଚିତ ସିମୁଲେସନ ସରାଇ ଦିଅ?',
    errorDelete: 'ସିମୁଲେସନ ଡିଲିଟ ବିଫଳ',
  
    // artboard p4
    eyebrow: "ଯୋଜନା",
    intro: "ଆପଣ ପ୍ରକୃତରେ ପଚାରୁଥିବା ପ୍ରଶ୍ନଟି ବାଛନ୍ତୁ। ସଂଖ୍ୟା ପୋଖରୀରୁ ଆସେ — ଆପଣ କେବଳ ପରୀକ୍ଷା କରୁଥିବା ଜିନିଷ ବଦଳାନ୍ତି।",
    whileRunning: "ଚକ୍ର ଚାଲିଥିବା ସମୟରେ",
    beforeStocking: "ପୋଖରୀରେ ମହଜୁଦ କରିବା ପୂର୍ବରୁ",
    saved: "ସଞ୍ଚିତ",
    pickPondTitle: "ପ୍ରଥମେ ଏକ ପୋଖରୀ ବାଛନ୍ତୁ",
    pickPondBody: "ଏହି ପ୍ରଶ୍ନ କେଉଁ ପୋଖରୀ ବିଷୟରେ ତାହା ବାଛନ୍ତୁ।",
  },

  // ── SimulationCreateScreen ────────────────────────────────────────────────
  create: {
    title: 'ନୂଆ ସିମୁଲେସନ',
    subtitle: 'ଏକ ସଚ୍ଛଳ ପୋଖରୀ ଚକ୍ରରେ what-if ପରିସ୍ଥିତି ଚଲାନ୍ତୁ',
    sectionPond: 'ପୋଖରୀ',
    labelPondId: 'ପୋଖରୀ ID *',
    placeholderPondId: 'ସଚ୍ଛଳ ଚକ୍ର ଥିବା ପୋଖରୀ UUID',
    sectionScenario: 'ପରିସ୍ଥିତି ପ୍ରକାର',
    scenarioFeedChange: 'ଖାଦ୍ୟ ପରିବର୍ତ୍ତନ',
    scenarioPriceChange: 'ମୂଲ୍ୟ ପରିବର୍ତ୍ତନ',
    scenarioStockingDensity: 'ଷ୍ଟକ ଘନତ୍ୱ',
    sectionVariables: 'ଚଳ',
    labelFeedPrice: 'ଖାଦ୍ୟ ମୂଲ୍ୟ (ପ୍ରତି kg)',
    labelGrowthImprovement: 'ବୃଦ୍ଧି ଉନ୍ନତି (%)',
    labelSellingPrice: 'ବିକ୍ରୟ ମୂଲ୍ୟ (ପ୍ରତି kg)',
    labelStockingDensity: 'ଷ୍ଟକ ଘନତ୍ୱ (PL/m²)',
    runSimulation: 'ସିମୁଲେସନ ଚଲାନ୍ତୁ',
    errorPondId: 'ପୋଖରୀ ID ଦିଅନ୍ତୁ',
    errorSimFailed: 'ସିମୁଲେସନ ଚଲାଇ ହୋଇ ପାରିଲା ନାହିଁ',
    validationTitle: 'ଯୋଗ୍ୟତା ତ୍ରୁଟି',
    simFailedTitle: 'ସିମୁଲେସନ ବିଫଳ',
  
    // artboard p4
    eyebrow: "ସିମୁଲେସନ",
    whatYouAreChanging: "ଆପଣ ଯାହା ବଦଳାଉଛନ୍ତି",
    currently: "ବର୍ତ୍ତମାନ {{value}}",
  },

  // ── SimulationResultsScreen ───────────────────────────────────────────────
  results: {
    title: 'ସିମୁଲେସନ ଫଳାଫଳ',
    vsBaseline: 'ଆଧାର ରେଖା ତୁଳନାରେ',
    profitDifference: 'ଲାଭ ପ୍ରଭେଦ',
    sectionResults: 'ସିମୁଲେସନ ଫଳାଫଳ',
    labelProjectedBiomass: 'ଅଭିକ୍ଷିପ୍ତ ବାୟୋମାସ',
    labelProjectedFcr: 'ଅଭିକ୍ଷିପ୍ତ FCR',
    labelTotalRevenue: 'ମୋଟ ଆୟ',
    labelTotalCost: 'ମୋଟ ଖର୍ଚ',
    sectionProfitComparison: 'ଲାଭ ତୁଳନା',
    labelBaselineProfit: 'ଆଧାର ରେଖା ନିଟ ଲାଭ:',
    labelSimulatedProfit: 'ସିମୁଲେଟ ନିଟ ଲାଭ:',
    labelRiskWarning: 'ଝୁଁକି ସଂଘଟନ:',
    noData: 'ସିମୁଲେସନ ଡାଟା ମିଳିଲା ନାହିଁ।',
  
    // artboard p5
    shortTitle: "ଫଳାଫଳ",
    whatItPredicts: "ଏହି ରନ କ'ଣ କହୁଛି",
    againstDoingNothing: "କିଛି ନକରିବା ତୁଳନାରେ",
    barsNote: "ଧୂସର ଯାହା ଆପଣ ଏମିତି ବି ପାଆନ୍ତି। ସବୁଜ ଯାହା ପରିବର୍ତ୍ତନ ଯୋଡ଼େ।",
    barsNoteLoss: "ଧୂସର ଯାହା ଆପଣ ଏମିତି ବି ପାଆନ୍ତି। ନାଲି ଯାହା ପରିବର୍ତ୍ତନର ଖର୍ଚ୍ଚ।",
    whatYouChanged: "ଆପଣ ଯାହା ବଦଳାଇଛନ୍ତି",
    runOn: "{{date}} ରେ ଚଲାଯାଇଛି",
    keepPlan: "ଏହି ଯୋଜନା ରଖନ୍ତୁ",
    runAgain: "ପୁଣି ଚଲାନ୍ତୁ",
  },

  // Questions — artboard p4
  q: {
    feed_change: {
      title: "ଶସ୍ତା ଖାଦ୍ୟ କ'ଣ ଲାଭଜନକ?",
      desc: "ଖାଦ୍ୟ ଦାମ vs FCR ଏବଂ ବୃଦ୍ଧି",
      label: "ଖାଦ୍ୟ ଦାମ (₹/କିଗ୍ରା)",
      errorValue: "ପରୀକ୍ଷା ପାଇଁ ଖାଦ୍ୟ ଦାମ ଦିଅନ୍ତୁ",
    },
    price_change: {
      title: "ବିକ୍ରୟ ଦାମ ବଦଳିଲେ?",
      desc: "ଚିଙ୍ଗୁଡ଼ି ଦାମ vs ଆୟ ଏବଂ ମାର୍ଜିନ",
      label: "ବିକ୍ରୟ ଦାମ (₹/କିଗ୍ରା)",
      errorValue: "ପରୀକ୍ଷା ପାଇଁ ବିକ୍ରୟ ଦାମ ଦିଅନ୍ତୁ",
    },
    stocking_density: {
      title: "କେତେ ଘନ ମହଜୁଦ କରିବି?",
      desc: "ପ୍ରତି m² PL vs ବଞ୍ଚିବା ଏବଂ FCR",
      label: "ମହଜୁଦ ଘନତ୍ୱ (PL/m²)",
      errorValue: "ପରୀକ୍ଷା ପାଇଁ ଘନତ୍ୱ ଦିଅନ୍ତୁ",
    },
  },
};
export default simulations;
