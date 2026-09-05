const history = {
  // Metric labels. Chemical notation (NH₃, NO₂, Ca…) and the Latin genus
  // names Vibrio / Bacillus stay untranslated: they are the vocabulary the
  // industry already uses, and localising them would make a pill LESS
  // recognisable, not more. Only the plain-English words around them move.
  waterQualityMetricAmmonia: "अमोनिया",
  waterQualityMetricNitrite: "नाइट्राइट",
  waterQualityMetricAlkalinity: "क्षारीयता",
  chemAlkalinity: "क्षार",
  chemHardness: "कठोरता",
  microTotalVibrio: "कुल Vibrio",
  microYellowVibrio: "पीला Vibrio",
  microGreenVibrio: "हरा Vibrio",
  microLuminescent: "चमकीला",
  planktonGreenAlgae: "हरी काई",
  planktonProtozoa: "प्रोटोज़ोआ",
  planktonZoo: "ज़ूप्लवक",
  planktonGoldBrown: "सुनहरा-भूरा",
  planktonGoldGreen: "सुनहरा-हरा",
  planktonYellowGreen: "पीला-हरा",
  planktonOther: "अन्य",
  // ── Shared across all history screens ─────────────────────────────────────
  couldNotLoad: 'रिकॉर्ड लोड नहीं हो सके',

  // ── ChemicalHistoryScreen ─────────────────────────────────────────────────
  chemicalTitle: 'रासायनिक इतिहास',
  chemicalDeleteMsg: '{{date}} का रासायनिक लॉग हटाएं?',
  chemicalEmptyTitle: 'कोई रासायनिक लॉग नहीं',
  chemicalEmptyText: 'अभी कोई रासायनिक डेटा दर्ज नहीं किया गया है।',

  // ── DiseaseHistoryScreen ──────────────────────────────────────────────────
  diseaseTitle: 'रोग इतिहास',
  diseaseIdLabel: 'रोग ID: {{id}}',
  diseasePhotoCount: '{{count}} फोटो',
  diseaseEmptyTitle: 'कोई रोग लॉग नहीं',
  diseaseEmptyText: 'अभी कोई रोग घटना दर्ज नहीं की गई है।',
  diseaseDeleteMsg: '{{date}} का रोग रिकॉर्ड हटाएं?',
  diseaseDeleteError: 'रिकॉर्ड हटाया नहीं जा सका। कृपया पुनः प्रयास करें।',

  // ── FeedHistoryScreen ─────────────────────────────────────────────────────
  feedTitle: 'आहार इतिहास',
  feedTotalLabel: 'कुल आहार: ',
  feedTotalValue: '{{amount}} kg',
  feedTypeLabel: 'प्रकार: {{type}}',
  feedMethodLabel: 'विधि: {{method}}',
  feedEmptyTitle: 'कोई आहार रिकॉर्ड नहीं',
  feedEmptyText: 'खपत ट्रैक करने के लिए आहार लॉग करना शुरू करें।',

  // ── HarvestHistoryScreen ──────────────────────────────────────────────────
  harvestTitle: 'कटाई रिकॉर्ड',
  harvestTotalLabel: 'कुल जैव भार: ',
  harvestTotalValue: '{{amount}} kg',
  harvestMetricBiomass: 'कुल जैव भार',
  harvestMetricAvgSize: 'औसत आकार',
  harvestBuyerLabel: 'खरीदार: {{name}}',
  harvestSaleLabel: 'बिक्री: {{amount}}',
  harvestEmptyTitle: 'अभी कोई कटाई नहीं',
  harvestEmptyText: 'इस तालाब में अभी कोई कटाई दर्ज नहीं हुई है।',

  // ── MicrobiologyHistoryScreen ─────────────────────────────────────────────
  microbiologyTitle: 'सूक्ष्मजीव विज्ञान इतिहास',
  microbiologyDeleteMsg: '{{date}} का सूक्ष्मजीव लॉग हटाएं?',
  microbiologyLevelCritical: 'गंभीर',
  microbiologyLevelWarning: 'चेतावनी',
  microbiologyLevelSafe: 'सुरक्षित',
  microbiologyLevelNa: 'N/A',
  microbiologyEmptyTitle: 'कोई सूक्ष्मजीव लॉग नहीं',
  microbiologyEmptyText: 'अभी कोई सूक्ष्मजीव डेटा दर्ज नहीं किया गया है।',

  // ── MortalityHistoryScreen ────────────────────────────────────────────────
  mortalityTitle: 'मृत्यु इतिहास',
  mortalityDeleteMsg: '{{date}} का मृत्यु रिकॉर्ड हटाएं?',
  mortalityDeleteError: 'रिकॉर्ड हटाया नहीं जा सका। कृपया पुनः प्रयास करें।',
  mortalityTotalLabel: 'कुल मृत्यु: ',
  mortalityEstWeight: 'अनु. वजन: {{weight}} kg',
  mortalityEmptyTitle: 'कोई मृत्यु दर्ज नहीं',
  mortalityEmptyText: 'अभी कोई मृत्यु डेटा दर्ज नहीं किया गया है।',

  // ── PlanktonHistoryScreen ─────────────────────────────────────────────────
  planktonTitle: 'प्लैंकटन इतिहास',
  planktonDeleteMsg: '{{date}} का प्लैंकटन लॉग हटाएं?',
  planktonTotalLabel: 'कुल: {{total}} cells/mL',
  planktonEmptyTitle: 'कोई प्लैंकटन लॉग नहीं',
  planktonEmptyText: 'अभी कोई प्लैंकटन डेटा दर्ज नहीं किया गया है।',

  // ── SamplingHistoryScreen ─────────────────────────────────────────────────
  samplingTitle: 'नमूनाकरण इतिहास',
  samplingDeleteMsg: '{{date}} का नमूनाकरण रिकॉर्ड हटाएं?',
  samplingDeleteError: 'रिकॉर्ड हटाया नहीं जा सका। कृपया पुनः प्रयास करें।',
  samplingPillSamples: 'नमूने',
  samplingPillBiomass: 'जैव भार',
  samplingPillSr: 'SR',
  samplingEmptyTitle: 'कोई नमूनाकरण रिकॉर्ड नहीं',
  samplingEmptyText: 'समय के साथ वृद्धि ट्रैक करने के लिए नमूनाकरण शुरू करें।',

  // ── TreatmentHistoryScreen ────────────────────────────────────────────────
  treatmentTitle: 'उपचार इतिहास',
  treatmentEmptyTitle: 'कोई उपचार दर्ज नहीं',
  treatmentEmptyText: 'इस तालाब में कोई उपचार रिकॉर्ड नहीं है।',
  bannedFlagLabel: 'चिह्नित: {{names}}',

  // ── WaterQualityHistoryScreen ─────────────────────────────────────────────
  waterQualityTitle: 'जल गुणवत्ता इतिहास',
  waterQualityDeleteMsg: 'क्या आप वाकई यह जल गुणवत्ता रिकॉर्ड हटाना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती।',
  waterQualityDeleteError: 'रिकॉर्ड हटाने में विफल',
  waterQualityCompareTitle: 'मानक तुलना करें',
  waterQualityMetricPh: 'pH',
  waterQualityMetricDo: 'DO (mg/L)',
  waterQualityMetricTemp: 'तापमान (°C)',
  waterQualityMetricSalinity: 'लवणता',
  waterQualityMetricNitrate: 'नाइट्रेट',
  waterQualityMetricHardness: 'कठोरता',
  waterQualityMetricTransparency: 'पारदर्शिता',
  weeklyChemistryTag: 'साप्ताहिक रसायन',
  weeklyChemistryTitle: 'साप्ताहिक रसायन',
  weeklyChemistryEmptyTitle: 'अभी कोई रसायन जाँच नहीं',
  weeklyChemistryEmptyText: 'टेस्ट-किट रीडिंग दर्ज करें, हर पैरामीटर का रुझान यहाँ दिखेगा।',
  weeklyChemistryLogAction: 'जाँच दर्ज करें',
  weeklyChemistryNeedsMore: 'रुझान बनाने के लिए कम से कम दो जाँच चाहिए।',
  weeklyChemistryEntries: 'सभी जाँचें',
  waterQualityEmptyTitle: 'कोई जल गुणवत्ता लॉग नहीं',
  waterQualityEmptyText: 'रुझान देखने के लिए जल गुणवत्ता दर्ज करना शुरू करें।',
};
export default history;
