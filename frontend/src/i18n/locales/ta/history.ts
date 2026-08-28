const history = {
  // Metric labels. Chemical notation (NH₃, NO₂, Ca…) and the Latin genus
  // names Vibrio / Bacillus stay untranslated: they are the vocabulary the
  // industry already uses, and localising them would make a pill LESS
  // recognisable, not more. Only the plain-English words around them move.
  waterQualityMetricAmmonia: "அம்மோனியா",
  waterQualityMetricNitrite: "நைட்ரைட்",
  waterQualityMetricAlkalinity: "கார நிலை",
  chemAlkalinity: "காரம்",
  chemHardness: "கடினம்",
  microTotalVibrio: "மொத்த Vibrio",
  microYellowVibrio: "மஞ்சள் Vibrio",
  microGreenVibrio: "பச்சை Vibrio",
  microLuminescent: "ஒளிரும்",
  planktonGreenAlgae: "பச்சைப் பாசி",
  planktonProtozoa: "புரோட்டோசோவா",
  planktonZoo: "விலங்குத் திட்டு",
  planktonGoldBrown: "பொன்-பழுப்பு",
  planktonGoldGreen: "பொன்-பச்சை",
  planktonYellowGreen: "மஞ்சள்-பச்சை",
  planktonOther: "மற்றவை",
  // ── Shared across all history screens ─────────────────────────────────────
  couldNotLoad: 'பதிவுகளை ஏற்ற முடியவில்லை',

  // ── ChemicalHistoryScreen ─────────────────────────────────────────────────
  chemicalTitle: 'இரசாயன வரலாறு',
  chemicalDeleteMsg: '{{date}} தேதி இரசாயன பதிவை நீக்கவா?',
  chemicalEmptyTitle: 'இரசாயன பதிவுகள் இல்லை',
  chemicalEmptyText: 'இன்னும் இரசாயன தரவு பதிவு செய்யப்படவில்லை.',

  // ── DiseaseHistoryScreen ──────────────────────────────────────────────────
  diseaseTitle: 'நோய் வரலாறு',
  diseaseIdLabel: 'நோய் ID: {{id}}',
  diseasePhotoCount: '{{count}} புகைப்படம்(கள்)',
  diseaseEmptyTitle: 'நோய் பதிவுகள் இல்லை',
  diseaseEmptyText: 'இன்னும் நோய் நிகழ்வுகள் பதிவு செய்யப்படவில்லை.',
  diseaseDeleteMsg: '{{date}} தேதியின் நோய் பதிவை நீக்கவா?',
  diseaseDeleteError: 'பதிவை நீக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',

  // ── FeedHistoryScreen ─────────────────────────────────────────────────────
  feedTitle: 'தீவன வரலாறு',
  feedTotalLabel: 'மொத்த தீவனம்: ',
  feedTotalValue: '{{amount}} kg',
  feedTypeLabel: 'வகை: {{type}}',
  feedMethodLabel: 'முறை: {{method}}',
  feedEmptyTitle: 'தீவன பதிவுகள் இல்லை',
  feedEmptyText: 'நுகர்வை கண்காணிக்க தீவன பதிவு தொடங்குங்கள்.',

  // ── HarvestHistoryScreen ──────────────────────────────────────────────────
  harvestTitle: 'அறுவடை பதிவுகள்',
  harvestTotalLabel: 'மொத்த உயிரி நிறை: ',
  harvestTotalValue: '{{amount}} kg',
  harvestMetricBiomass: 'மொத்த உயிரி நிறை',
  harvestMetricAvgSize: 'சராசரி அளவு',
  harvestBuyerLabel: 'வாங்குபவர்: {{name}}',
  harvestSaleLabel: 'விற்பனை: {{amount}}',
  harvestEmptyTitle: 'அறுவடைகள் இன்னும் இல்லை',
  harvestEmptyText: 'இந்த குளம் எந்த அறுவடையும் பதிவு செய்யவில்லை.',

  // ── MicrobiologyHistoryScreen ─────────────────────────────────────────────
  microbiologyTitle: 'நுண்ணுயிரியல் வரலாறு',
  microbiologyDeleteMsg: '{{date}} தேதி நுண்ணுயிரியல் பதிவை நீக்கவா?',
  microbiologyLevelCritical: 'அவசரம்',
  microbiologyLevelWarning: 'எச்சரிக்கை',
  microbiologyLevelSafe: 'பாதுகாப்பான',
  microbiologyLevelNa: 'பொருந்தாது',
  microbiologyEmptyTitle: 'நுண்ணுயிரியல் பதிவுகள் இல்லை',
  microbiologyEmptyText: 'இன்னும் நுண்ணுயிரியல் தரவு பதிவு செய்யப்படவில்லை.',

  // ── MortalityHistoryScreen ────────────────────────────────────────────────
  mortalityTitle: 'இறப்பு வரலாறு',
  mortalityDeleteMsg: '{{date}} தேதி இறப்பு பதிவை நீக்கவா?',
  mortalityDeleteError: 'பதிவை நீக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
  mortalityTotalLabel: 'மொத்த இறப்பு: ',
  mortalityEstWeight: 'மதிப்பிடப்பட்ட எடை: {{weight}} kg',
  mortalityEmptyTitle: 'இறப்பு பதிவுகள் இல்லை',
  mortalityEmptyText: 'இன்னும் இறப்பு தரவு பதிவு செய்யப்படவில்லை.',

  // ── PlanktonHistoryScreen ─────────────────────────────────────────────────
  planktonTitle: 'பிளாங்க்டன் வரலாறு',
  planktonDeleteMsg: '{{date}} தேதி பிளாங்க்டன் பதிவை நீக்கவா?',
  planktonTotalLabel: 'மொத்தம்: {{total}} cells/mL',
  planktonEmptyTitle: 'பிளாங்க்டன் பதிவுகள் இல்லை',
  planktonEmptyText: 'இன்னும் பிளாங்க்டன் தரவு பதிவு செய்யப்படவில்லை.',

  // ── SamplingHistoryScreen ─────────────────────────────────────────────────
  samplingTitle: 'மாதிரி சேகரிப்பு வரலாறு',
  samplingDeleteMsg: '{{date}} தேதி மாதிரி பதிவை நீக்கவா?',
  samplingDeleteError: 'பதிவை நீக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
  samplingPillSamples: 'மாதிரிகள்',
  samplingPillBiomass: 'உயிரி நிறை',
  samplingPillSr: 'SR',
  samplingEmptyTitle: 'மாதிரி பதிவுகள் இல்லை',
  samplingEmptyText: 'காலப்போக்கில் வளர்ச்சியை கண்காணிக்க மாதிரி சேகரிப்பை தொடங்குங்கள்.',

  // ── TreatmentHistoryScreen ────────────────────────────────────────────────
  treatmentTitle: 'சிகிச்சை வரலாறு',
  treatmentEmptyTitle: 'சிகிச்சை பதிவுகள் இல்லை',
  treatmentEmptyText: 'இந்த குளத்தில் பதிவு செய்யப்பட்ட சிகிச்சைகள் இல்லை.',
  bannedFlagLabel: 'குறியிடப்பட்டது: {{names}}',

  // ── WaterQualityHistoryScreen ─────────────────────────────────────────────
  waterQualityTitle: 'நீர் தர வரலாறு',
  waterQualityDeleteMsg: 'இந்த நீர் தர பதிவை நீக்க விரும்புகிறீர்களா? இதை மாற்ற முடியாது.',
  waterQualityDeleteError: 'பதிவை நீக்கத் தோல்வியடைந்தது',
  waterQualityCompareTitle: 'அளவுருக்களை ஒப்பிடு',
  waterQualityMetricPh: 'pH',
  waterQualityMetricDo: 'DO (mg/L)',
  waterQualityMetricTemp: 'வெப்பநிலை (°C)',
  waterQualityMetricSalinity: 'உப்புத்தன்மை',
  waterQualityEmptyTitle: 'நீர் தர பதிவுகள் இல்லை',
  waterQualityEmptyText: 'போக்குகளை பார்க்க நீர் தரம் பதிவு செய்யத் தொடங்குங்கள்.',
};
export default history;
