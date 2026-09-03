const history = {
  // Metric labels. Chemical notation (NH₃, NO₂, Ca…) and the Latin genus
  // names Vibrio / Bacillus stay untranslated: they are the vocabulary the
  // industry already uses, and localising them would make a pill LESS
  // recognisable, not more. Only the plain-English words around them move.
  waterQualityMetricAmmonia: "অ্যামোনিয়া",
  waterQualityMetricNitrite: "নাইট্রাইট",
  waterQualityMetricAlkalinity: "ক্ষারত্ব",
  chemAlkalinity: "ক্ষার",
  chemHardness: "কাঠিন্য",
  microTotalVibrio: "মোট Vibrio",
  microYellowVibrio: "হলুদ Vibrio",
  microGreenVibrio: "সবুজ Vibrio",
  microLuminescent: "দীপ্তিমান",
  planktonGreenAlgae: "সবুজ শৈবাল",
  planktonProtozoa: "প্রোটোজোয়া",
  planktonZoo: "প্রাণিপ্লবক",
  planktonGoldBrown: "সোনালি-বাদামি",
  planktonGoldGreen: "সোনালি-সবুজ",
  planktonYellowGreen: "হলুদ-সবুজ",
  planktonOther: "অন্যান্য",
  // ── Shared across all history screens ─────────────────────────────────────
  couldNotLoad: 'রেকর্ড লোড করা যায়নি',

  // ── ChemicalHistoryScreen ─────────────────────────────────────────────────
  chemicalTitle: 'রাসায়নিকের ইতিহাস',
  chemicalDeleteMsg: '{{date}}-এর রাসায়নিক লগ মুছবেন?',
  chemicalEmptyTitle: 'কোনো রাসায়নিক লগ নেই',
  chemicalEmptyText: 'এখনও কোনো রাসায়নিক ডেটা রেকর্ড করা হয়নি।',

  // ── DiseaseHistoryScreen ──────────────────────────────────────────────────
  diseaseTitle: 'রোগের ইতিহাস',
  diseaseIdLabel: 'রোগ ID: {{id}}',
  diseasePhotoCount: '{{count}}টি ছবি',
  diseaseEmptyTitle: 'কোনো রোগ লগ নেই',
  diseaseEmptyText: 'এখনও কোনো রোগের ঘটনা রেকর্ড করা হয়নি।',
  diseaseDeleteMsg: '{{date}} তারিখের রোগের রেকর্ড মুছবেন?',
  diseaseDeleteError: 'রেকর্ডটি মুছে ফেলা যায়নি। আবার চেষ্টা করুন।',

  // ── FeedHistoryScreen ─────────────────────────────────────────────────────
  feedTitle: 'খাদ্যের ইতিহাস',
  feedTotalLabel: 'মোট খাদ্য: ',
  feedTotalValue: '{{amount}} kg',
  feedTypeLabel: 'ধরন: {{type}}',
  feedMethodLabel: 'পদ্ধতি: {{method}}',
  feedEmptyTitle: 'কোনো খাদ্য রেকর্ড নেই',
  feedEmptyText: 'খাদ্য ব্যবহার ট্র্যাক করতে লগিং শুরু করুন।',

  // ── HarvestHistoryScreen ──────────────────────────────────────────────────
  harvestTitle: 'ফসলের রেকর্ড',
  harvestTotalLabel: 'মোট বায়োমাস: ',
  harvestTotalValue: '{{amount}} kg',
  harvestMetricBiomass: 'মোট বায়োমাস',
  harvestMetricAvgSize: 'গড় আকার',
  harvestBuyerLabel: 'ক্রেতা: {{name}}',
  harvestSaleLabel: 'বিক্রয়: {{amount}}',
  harvestEmptyTitle: 'এখনও কোনো ফসল নেই',
  harvestEmptyText: 'এই পুকুরে এখনও কোনো ফসলের রেকর্ড নেই।',

  // ── MicrobiologyHistoryScreen ─────────────────────────────────────────────
  microbiologyTitle: 'মাইক্রোবায়োলজির ইতিহাস',
  microbiologyDeleteMsg: '{{date}}-এর মাইক্রোবায়োলজি লগ মুছবেন?',
  microbiologyLevelCritical: 'সংকটজনক',
  microbiologyLevelWarning: 'সতর্কতা',
  microbiologyLevelSafe: 'নিরাপদ',
  microbiologyLevelNa: 'N/A',
  microbiologyEmptyTitle: 'কোনো মাইক্রোবায়োলজি লগ নেই',
  microbiologyEmptyText: 'এখনও কোনো মাইক্রোবায়োলজি ডেটা রেকর্ড করা হয়নি।',

  // ── MortalityHistoryScreen ────────────────────────────────────────────────
  mortalityTitle: 'মৃত্যুহারের ইতিহাস',
  mortalityDeleteMsg: '{{date}}-এর মৃত্যুহার রেকর্ড মুছবেন?',
  mortalityDeleteError: 'রেকর্ড মুছতে পারেনি। আবার চেষ্টা করুন।',
  mortalityTotalLabel: 'মোট মৃত্যু: ',
  mortalityEstWeight: 'আনুমানিক ওজন: {{weight}} kg',
  mortalityEmptyTitle: 'কোনো মৃত্যুহার লগ নেই',
  mortalityEmptyText: 'এখনও কোনো মৃত্যুহারের ডেটা রেকর্ড করা হয়নি।',

  // ── PlanktonHistoryScreen ─────────────────────────────────────────────────
  planktonTitle: 'প্ল্যাংকটনের ইতিহাস',
  planktonDeleteMsg: '{{date}}-এর প্ল্যাংকটন লগ মুছবেন?',
  planktonTotalLabel: 'মোট: {{total}} cells/mL',
  planktonEmptyTitle: 'কোনো প্ল্যাংকটন লগ নেই',
  planktonEmptyText: 'এখনও কোনো প্ল্যাংকটন ডেটা রেকর্ড করা হয়নি।',

  // ── SamplingHistoryScreen ─────────────────────────────────────────────────
  samplingTitle: 'নমুনার ইতিহাস',
  samplingDeleteMsg: '{{date}}-এর নমুনা রেকর্ড মুছবেন?',
  samplingDeleteError: 'রেকর্ড মুছতে পারেনি। আবার চেষ্টা করুন।',
  samplingPillSamples: 'নমুনা',
  samplingPillBiomass: 'বায়োমাস',
  samplingPillSr: 'SR',
  samplingEmptyTitle: 'কোনো নমুনার রেকর্ড নেই',
  samplingEmptyText: 'সময়ের সাথে বৃদ্ধি ট্র্যাক করতে নমুনা নেওয়া শুরু করুন।',

  // ── TreatmentHistoryScreen ────────────────────────────────────────────────
  treatmentTitle: 'চিকিৎসার ইতিহাস',
  treatmentEmptyTitle: 'কোনো চিকিৎসা লগ নেই',
  treatmentEmptyText: 'এই পুকুরে কোনো চিকিৎসার রেকর্ড নেই।',
  bannedFlagLabel: 'চিহ্নিত: {{names}}',

  // ── WaterQualityHistoryScreen ─────────────────────────────────────────────
  waterQualityTitle: 'পানির মানের ইতিহাস',
  waterQualityDeleteMsg: 'আপনি কি সত্যিই এই পানির মানের রেকর্ডটি মুছতে চান? এটি পূর্বাবস্থায় ফেরানো যাবে না।',
  waterQualityDeleteError: 'রেকর্ড মুছতে ব্যর্থ',
  waterQualityCompareTitle: 'প্যারামিটার তুলনা',
  waterQualityMetricPh: 'pH',
  waterQualityMetricDo: 'DO (mg/L)',
  waterQualityMetricTemp: 'তাপমাত্রা (°C)',
  waterQualityMetricSalinity: 'লবণাক্ততা',
  waterQualityMetricNitrate: 'নাইট্রেট',
  waterQualityMetricHardness: 'কাঠিন্য',
  waterQualityMetricTransparency: 'স্বচ্ছতা',
  weeklyChemistryTag: 'সাপ্তাহিক রসায়ন',
  waterQualityEmptyTitle: 'কোনো পানির মানের লগ নেই',
  waterQualityEmptyText: 'প্রবণতা দেখতে পানির মান রেকর্ড করা শুরু করুন।',
};
export default history;
