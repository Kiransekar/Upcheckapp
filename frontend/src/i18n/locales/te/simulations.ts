const simulations = {
  // ── SimulationListScreen ──────────────────────────────────────────────────
  list: {
    title: 'సిమ్యులేషన్లు',
    statBiomass: '{{value}} kg బయోమాస్',
    statProfit: 'లాభం: {{value}}',
    statNa: 'వర్తించదు',
    emptyTitle: 'ఇంకా సిమ్యులేషన్లు లేవు',
    emptyDesc: 'తదుపరి సైకిల్‌ను సమర్థవంతంగా ప్రణాళిక వేయడానికి మీ మొదటి అంచనాను సృష్టించండి.',
    deleteTitle: 'సిమ్యులేషన్ తొలగించు',
    deleteMessage: 'ఈ సేవ్ చేసిన సిమ్యులేషన్‌ను తీసివేయాలా?',
    errorDelete: 'సిమ్యులేషన్ తొలగించడం విఫలమైంది',
  
    // artboard p4
    eyebrow: "ప్రణాళిక",
    intro: "మీరు నిజంగా అడుగుతున్న ప్రశ్నను ఎంచుకోండి. సంఖ్యలు చెరువు నుండి వస్తాయి — మీరు పరీక్షిస్తున్నది మాత్రమే మార్చండి.",
    whileRunning: "సైకిల్ నడుస్తున్నప్పుడు",
    beforeStocking: "చెరువులో నిల్వ చేయకముందు",
    saved: "సేవ్ చేసినవి",
    pickPondTitle: "ముందుగా ఒక చెరువు ఎంచుకోండి",
    pickPondBody: "ఈ ప్రశ్న ఏ చెరువు గురించో ఎంచుకోండి, దాని సంఖ్యలు వాడటానికి.",
  },

  // ── SimulationCreateScreen ────────────────────────────────────────────────
  create: {
    title: 'కొత్త సిమ్యులేషన్',
    subtitle: 'క్రియాశీల చెరువు సైకిల్‌పై what-if దృశ్యం నడపండి',
    sectionPond: 'చెరువు',
    labelPondId: 'చెరువు ID *',
    placeholderPondId: 'క్రియాశీల సైకిల్‌తో చెరువు UUID',
    sectionScenario: 'దృశ్య రకం',
    scenarioFeedChange: 'దాణా మార్పు',
    scenarioPriceChange: 'ధర మార్పు',
    scenarioStockingDensity: 'స్టాకింగ్ సాంద్రత',
    sectionVariables: 'వేరియబుళ్ళు',
    labelFeedPrice: 'దాణా ధర (kg కి)',
    labelGrowthImprovement: 'వృద్ధి మెరుగుదల (%)',
    labelSellingPrice: 'అమ్మకపు ధర (kg కి)',
    labelStockingDensity: 'స్టాకింగ్ సాంద్రత (PL/m²)',
    runSimulation: 'సిమ్యులేషన్ నడపు',
    errorPondId: 'దయచేసి చెరువు ID నమోదు చేయండి',
    errorSimFailed: 'సిమ్యులేషన్ నడపడం విఫలమైంది',
    validationTitle: 'ధృవీకరణ లోపం',
    simFailedTitle: 'సిమ్యులేషన్ విఫలమైంది',
  
    // artboard p4
    eyebrow: "సిమ్యులేషన్",
    whatYouAreChanging: "మీరు మారుస్తున్నది",
    currently: "ప్రస్తుతం {{value}}",
  },

  // ── SimulationResultsScreen ───────────────────────────────────────────────
  results: {
    title: 'సిమ్యులేషన్ ఫలితాలు',
    vsBaseline: 'బేస్‌లైన్ తో పోలిక',
    profitDifference: 'లాభ తేడా',
    sectionResults: 'సిమ్యులేషన్ ఫలితాలు',
    labelProjectedBiomass: 'అంచనా బయోమాస్',
    labelProjectedFcr: 'అంచనా FCR',
    labelTotalRevenue: 'మొత్తం ఆదాయం',
    labelTotalCost: 'మొత్తం ఖర్చు',
    sectionProfitComparison: 'లాభ పోలిక',
    labelBaselineProfit: 'బేస్‌లైన్ నికర లాభం:',
    labelSimulatedProfit: 'సిమ్యులేటెడ్ నికర లాభం:',
    labelRiskWarning: 'రిస్క్ హెచ్చరిక:',
    noData: 'సిమ్యులేషన్ డేటా కనుగొనబడలేదు.',
  
    // artboard p5
    shortTitle: "ఫలితం",
    whatItPredicts: "ఈ రన్ ఏమి చెబుతుంది",
    againstDoingNothing: "ఏమీ చేయకపోతే దానితో పోలిస్తే",
    barsNote: "బూడిద రంగు ఎలాగూ వచ్చేది. ఆకుపచ్చ మార్పు జోడించేది.",
    barsNoteLoss: "బూడిద రంగు ఎలాగూ వచ్చేది. ఎరుపు మార్పు ఖర్చు.",
    whatYouChanged: "మీరు మార్చినది",
    runOn: "{{date}} న రన్ చేయబడింది",
    keepPlan: "ఈ ప్లాన్ ఉంచు",
    runAgain: "మళ్ళీ రన్ చేయి",
  },

  // Questions — artboard p4
  q: {
    feed_change: {
      title: "చౌక మేత లాభమా?",
      desc: "మేత ధర vs FCR మరియు పెరుగుదల",
      label: "మేత ధర (₹/కిగ్రా)",
      errorValue: "పరీక్షించడానికి మేత ధర ఇవ్వండి",
    },
    price_change: {
      title: "అమ్మకపు ధర మారితే?",
      desc: "రొయ్య ధర vs ఆదాయం మరియు మార్జిన్",
      label: "అమ్మకపు ధర (₹/కిగ్రా)",
      errorValue: "పరీక్షించడానికి అమ్మకపు ధర ఇవ్వండి",
    },
    stocking_density: {
      title: "ఎంత దట్టంగా నిల్వ చేయాలి?",
      desc: "m²కి PL vs బతికే రేటు మరియు FCR",
      label: "నిల్వ సాంద్రత (PL/m²)",
      errorValue: "పరీక్షించడానికి సాంద్రత ఇవ్వండి",
    },
  },
};
export default simulations;
