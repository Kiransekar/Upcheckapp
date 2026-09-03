const history = {
  // Metric labels. Chemical notation (NH₃, NO₂, Ca…) and the Latin genus
  // names Vibrio / Bacillus stay untranslated: they are the vocabulary the
  // industry already uses, and localising them would make a pill LESS
  // recognisable, not more. Only the plain-English words around them move.
  waterQualityMetricAmmonia: "అమ్మోనియా",
  waterQualityMetricNitrite: "నైట్రైట్",
  waterQualityMetricAlkalinity: "క్షారత",
  chemAlkalinity: "క్షారం",
  chemHardness: "కాఠిన్యం",
  microTotalVibrio: "మొత్తం Vibrio",
  microYellowVibrio: "పసుపు Vibrio",
  microGreenVibrio: "ఆకుపచ్చ Vibrio",
  microLuminescent: "మెరిసే",
  planktonGreenAlgae: "ఆకుపచ్చ నాచు",
  planktonProtozoa: "ప్రోటోజోవా",
  planktonZoo: "జంతుప్లవకం",
  planktonGoldBrown: "బంగారు-గోధుమ",
  planktonGoldGreen: "బంగారు-ఆకుపచ్చ",
  planktonYellowGreen: "పసుపు-ఆకుపచ్చ",
  planktonOther: "ఇతర",
  // ── Shared across all history screens ─────────────────────────────────────
  couldNotLoad: 'రికార్డులు లోడ్ కాలేదు',

  // ── ChemicalHistoryScreen ─────────────────────────────────────────────────
  chemicalTitle: 'రసాయన చరిత్ర',
  chemicalDeleteMsg: '{{date}} నాటి రసాయన లాగ్ తొలగించాలా?',
  chemicalEmptyTitle: 'రసాయన లాగ్లు లేవు',
  chemicalEmptyText: 'ఇంకా రసాయన డేటా నమోదు కాలేదు.',

  // ── DiseaseHistoryScreen ──────────────────────────────────────────────────
  diseaseTitle: 'వ్యాధి చరిత్ర',
  diseaseIdLabel: 'వ్యాధి ID: {{id}}',
  diseasePhotoCount: '{{count}} ఫోటో(లు)',
  diseaseEmptyTitle: 'వ్యాధి లాగ్లు లేవు',
  diseaseEmptyText: 'ఇంకా వ్యాధి సంఘటనలు నమోదు కాలేదు.',
  diseaseDeleteMsg: '{{date}} నాటి వ్యాధి రికార్డును తొలగించాలా?',
  diseaseDeleteError: 'రికార్డును తొలగించలేకపోయాం. దయచేసి మళ్లీ ప్రయత్నించండి.',

  // ── FeedHistoryScreen ─────────────────────────────────────────────────────
  feedTitle: 'దాణా చరిత్ర',
  feedTotalLabel: 'మొత్తం దాణా: ',
  feedTotalValue: '{{amount}} kg',
  feedTypeLabel: 'రకం: {{type}}',
  feedMethodLabel: 'పద్ధతి: {{method}}',
  feedEmptyTitle: 'దాణా రికార్డులు లేవు',
  feedEmptyText: 'వినియోగాన్ని ట్రాక్ చేయడానికి దాణా నమోదు ప్రారంభించండి.',

  // ── HarvestHistoryScreen ──────────────────────────────────────────────────
  harvestTitle: 'పంట రికార్డులు',
  harvestTotalLabel: 'మొత్తం బయోమాస్: ',
  harvestTotalValue: '{{amount}} kg',
  harvestMetricBiomass: 'మొత్తం బయోమాస్',
  harvestMetricAvgSize: 'సగటు పరిమాణం',
  harvestBuyerLabel: 'కొనుగోలుదారు: {{name}}',
  harvestSaleLabel: 'అమ్మకం: {{amount}}',
  harvestEmptyTitle: 'ఇంకా పంటలు లేవు',
  harvestEmptyText: 'ఈ చెరువులో ఇంకా పంటలు నమోదు కాలేదు.',

  // ── MicrobiologyHistoryScreen ─────────────────────────────────────────────
  microbiologyTitle: 'సూక్ష్మజీవశాస్త్ర చరిత్ర',
  microbiologyDeleteMsg: '{{date}} నాటి సూక్ష్మజీవశాస్త్ర లాగ్ తొలగించాలా?',
  microbiologyLevelCritical: 'క్రిటికల్',
  microbiologyLevelWarning: 'హెచ్చరిక',
  microbiologyLevelSafe: 'సురక్షితం',
  microbiologyLevelNa: 'వర్తించదు',
  microbiologyEmptyTitle: 'సూక్ష్మజీవశాస్త్ర లాగ్లు లేవు',
  microbiologyEmptyText: 'ఇంకా సూక్ష్మజీవశాస్త్ర డేటా నమోదు కాలేదు.',

  // ── MortalityHistoryScreen ────────────────────────────────────────────────
  mortalityTitle: 'మరణాల చరిత్ర',
  mortalityDeleteMsg: '{{date}} నాటి మరణాల రికార్డు తొలగించాలా?',
  mortalityDeleteError: 'రికార్డు తొలగించడం సాధ్యపడలేదు. దయచేసి మళ్ళీ ప్రయత్నించండి.',
  mortalityTotalLabel: 'మొత్తం మరణాలు: ',
  mortalityEstWeight: 'అంచనా బరువు: {{weight}} kg',
  mortalityEmptyTitle: 'మరణాలు నమోదు కాలేదు',
  mortalityEmptyText: 'ఇంకా మరణాల డేటా నమోదు కాలేదు.',

  // ── PlanktonHistoryScreen ─────────────────────────────────────────────────
  planktonTitle: 'ప్లాంక్టన్ చరిత్ర',
  planktonDeleteMsg: '{{date}} నాటి ప్లాంక్టన్ లాగ్ తొలగించాలా?',
  planktonTotalLabel: 'మొత్తం: {{total}} cells/mL',
  planktonEmptyTitle: 'ప్లాంక్టన్ లాగ్లు లేవు',
  planktonEmptyText: 'ఇంకా ప్లాంక్టన్ డేటా నమోదు కాలేదు.',

  // ── SamplingHistoryScreen ─────────────────────────────────────────────────
  samplingTitle: 'శాంపిలింగ్ చరిత్ర',
  samplingDeleteMsg: '{{date}} నాటి శాంపిలింగ్ రికార్డు తొలగించాలా?',
  samplingDeleteError: 'రికార్డు తొలగించడం సాధ్యపడలేదు. దయచేసి మళ్ళీ ప్రయత్నించండి.',
  samplingPillSamples: 'శాంపిళ్ళు',
  samplingPillBiomass: 'బయోమాస్',
  samplingPillSr: 'SR',
  samplingEmptyTitle: 'శాంపిలింగ్ రికార్డులు లేవు',
  samplingEmptyText: 'కాలక్రమేణా వృద్ధిని ట్రాక్ చేయడానికి శాంపిలింగ్ ప్రారంభించండి.',

  // ── TreatmentHistoryScreen ────────────────────────────────────────────────
  treatmentTitle: 'చికిత్స చరిత్ర',
  treatmentEmptyTitle: 'చికిత్సలు నమోదు కాలేదు',
  treatmentEmptyText: 'ఈ చెరువులో నమోదు చేసిన చికిత్సలు లేవు.',
  bannedFlagLabel: 'ఫ్లాగ్ చేయబడింది: {{names}}',

  // ── WaterQualityHistoryScreen ─────────────────────────────────────────────
  waterQualityTitle: 'నీటి నాణ్యత చరిత్ర',
  waterQualityDeleteMsg: 'మీరు నిజంగా ఈ నీటి నాణ్యత రికార్డు తొలగించాలనుకుంటున్నారా? ఈ చర్యను రద్దు చేయడం సాధ్యం కాదు.',
  waterQualityDeleteError: 'రికార్డు తొలగించడం విఫలమైంది',
  waterQualityCompareTitle: 'పారామీటర్లు పోల్చండి',
  waterQualityMetricPh: 'pH',
  waterQualityMetricDo: 'DO (mg/L)',
  waterQualityMetricTemp: 'ఉష్ణో. (°C)',
  waterQualityMetricSalinity: 'లవణీయత',
  waterQualityMetricNitrate: 'నైట్రేట్',
  waterQualityMetricHardness: 'కాఠిన్యం',
  waterQualityMetricTransparency: 'పారదర్శకత',
  weeklyChemistryTag: 'వారపు రసాయన పరీక్ష',
  waterQualityEmptyTitle: 'నీటి నాణ్యత లాగ్లు లేవు',
  waterQualityEmptyText: 'ధోరణులు చూడటానికి నీటి నాణ్యత నమోదు ప్రారంభించండి.',
};
export default history;
