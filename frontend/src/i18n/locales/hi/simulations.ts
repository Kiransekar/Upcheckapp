const simulations = {
  // ── SimulationListScreen ──────────────────────────────────────────────────
  list: {
    title: 'सिमुलेशन',
    statBiomass: '{{value}} kg जैव भार',
    statProfit: 'लाभ: {{value}}',
    statNa: 'N/A',
    emptyTitle: 'अभी कोई सिमुलेशन नहीं',
    emptyDesc: 'अगले चक्र की प्रभावी योजना बनाने के लिए पहला पूर्वानुमान बनाएं।',
    deleteTitle: 'सिमुलेशन हटाएं',
    deleteMessage: 'यह सहेजा गया सिमुलेशन हटाएं?',
    errorDelete: 'सिमुलेशन हटाने में विफल',
  
    // artboard p4
    eyebrow: "योजना",
    intro: "वही सवाल चुनें जो आप सच में पूछ रहे हैं। संख्याएँ तालाब से आती हैं — आप सिर्फ़ वही बदलते हैं जो जाँच रहे हैं।",
    whileRunning: "साइकल चलने के दौरान",
    beforeStocking: "तालाब स्टॉक करने से पहले",
    saved: "सहेजे गए",
    pickPondTitle: "पहले एक तालाब चुनें",
    pickPondBody: "वह तालाब चुनें जिसके बारे में यह सवाल है, ताकि उसकी संख्याएँ इस्तेमाल हो सकें।",
  },

  // ── SimulationCreateScreen ────────────────────────────────────────────────
  create: {
    title: 'नया सिमुलेशन',
    subtitle: 'सक्रिय तालाब चक्र पर what-if परिदृश्य चलाएं',
    sectionPond: 'तालाब',
    labelPondId: 'तालाब ID *',
    placeholderPondId: 'सक्रिय चक्र वाले तालाब का UUID',
    sectionScenario: 'परिदृश्य प्रकार',
    scenarioFeedChange: 'आहार परिवर्तन',
    scenarioPriceChange: 'मूल्य परिवर्तन',
    scenarioStockingDensity: 'स्टॉकिंग घनत्व',
    sectionVariables: 'चर',
    labelFeedPrice: 'आहार मूल्य (प्रति kg)',
    labelGrowthImprovement: 'वृद्धि सुधार (%)',
    labelSellingPrice: 'बिक्री मूल्य (प्रति kg)',
    labelStockingDensity: 'स्टॉकिंग घनत्व (PL/m²)',
    runSimulation: 'सिमुलेशन चलाएं',
    errorPondId: 'कृपया तालाब ID दर्ज करें',
    errorSimFailed: 'सिमुलेशन चलाने में विफल',
    validationTitle: 'सत्यापन त्रुटि',
    simFailedTitle: 'सिमुलेशन विफल',
  
    // artboard p4
    eyebrow: "सिमुलेशन",
    whatYouAreChanging: "आप क्या बदल रहे हैं",
    currently: "अभी {{value}}",
  },

  // ── SimulationResultsScreen ───────────────────────────────────────────────
  results: {
    title: 'सिमुलेशन परिणाम',
    vsBaseline: 'आधार रेखा बनाम',
    profitDifference: 'लाभ अंतर',
    sectionResults: 'सिमुलेशन परिणाम',
    labelProjectedBiomass: 'प्रक्षेपित जैव भार',
    labelProjectedFcr: 'प्रक्षेपित FCR',
    labelTotalRevenue: 'कुल राजस्व',
    labelTotalCost: 'कुल लागत',
    sectionProfitComparison: 'लाभ तुलना',
    labelBaselineProfit: 'आधार रेखा शुद्ध लाभ:',
    labelSimulatedProfit: 'सिमुलेटेड शुद्ध लाभ:',
    labelRiskWarning: 'जोखिम चेतावनी:',
    noData: 'कोई सिमुलेशन डेटा नहीं मिला।',
  
    // artboard p5
    shortTitle: "नतीजा",
    whatItPredicts: "यह रन क्या बताता है",
    againstDoingNothing: "कुछ न करने की तुलना में",
    barsNote: "स्लेटी वह है जो आप वैसे भी कमाते हैं। हरा वह है जो बदलाव जोड़ता है।",
    barsNoteLoss: "स्लेटी वह है जो आप वैसे भी कमाते हैं। लाल वह है जो बदलाव का खर्च है।",
    whatYouChanged: "आपने क्या बदला",
    runOn: "{{date}} को चलाया",
    keepPlan: "यह योजना रखें",
    runAgain: "फिर चलाएँ",
  },

  // Questions — artboard p4
  q: {
    feed_change: {
      title: "क्या सस्ता फ़ीड फ़ायदेमंद है?",
      desc: "फ़ीड की कीमत बनाम FCR और वृद्धि",
      label: "फ़ीड कीमत (₹/किग्रा)",
      errorValue: "जाँचने के लिए फ़ीड कीमत डालें",
    },
    price_change: {
      title: "अगर बिक्री कीमत बदले तो?",
      desc: "झींगे की कीमत बनाम आमदनी और मार्जिन",
      label: "बिक्री कीमत (₹/किग्रा)",
      errorValue: "जाँचने के लिए बिक्री कीमत डालें",
    },
    stocking_density: {
      title: "कितनी घनी स्टॉकिंग करूँ?",
      desc: "PL प्रति m² बनाम उत्तरजीविता और FCR",
      label: "स्टॉकिंग घनत्व (PL/m²)",
      errorValue: "जाँचने के लिए घनत्व डालें",
    },
  },
};
export default simulations;
