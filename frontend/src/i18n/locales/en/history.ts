const history = {
  // Metric labels. Chemical notation (NH₃, NO₂, Ca…) and the Latin genus
  // names Vibrio / Bacillus stay untranslated: they are the vocabulary the
  // industry already uses, and localising them would make a pill LESS
  // recognisable, not more. Only the plain-English words around them move.
  waterQualityMetricAmmonia: "Ammonia",
  waterQualityMetricNitrite: "Nitrite",
  waterQualityMetricAlkalinity: "Alkalinity",
  chemAlkalinity: "Alk",
  chemHardness: "Hard",
  microTotalVibrio: "Total Vibrio",
  microYellowVibrio: "Yellow Vibrio",
  microGreenVibrio: "Green Vibrio",
  microLuminescent: "Luminescent",
  planktonGreenAlgae: "Green algae",
  planktonProtozoa: "Protozoa",
  planktonZoo: "Zooplankton",
  planktonGoldBrown: "Gold-brown",
  planktonGoldGreen: "Gold-green",
  planktonYellowGreen: "Yellow-green",
  planktonOther: "Other",
  // ── Shared across all history screens ─────────────────────────────────────
  couldNotLoad: "Couldn't Load Records",

  // ── ChemicalHistoryScreen ─────────────────────────────────────────────────
  chemicalTitle: 'Chemical History',
  chemicalDeleteMsg: 'Delete chemical log for {{date}}?',
  chemicalEmptyTitle: 'No Chemical Logs',
  chemicalEmptyText: 'No chemical data recorded yet.',

  // ── DiseaseHistoryScreen ──────────────────────────────────────────────────
  diseaseTitle: 'Disease History',
  diseaseIdLabel: 'Disease ID: {{id}}',
  diseasePhotoCount: '{{count}} photo(s)',
  diseaseEmptyTitle: 'No Disease Logs',
  diseaseEmptyText: 'No disease events recorded yet.',
  diseaseDeleteMsg: 'Delete the disease record from {{date}}?',
  diseaseDeleteError: 'Could not delete the record. Please try again.',

  // ── FeedHistoryScreen ─────────────────────────────────────────────────────
  feedTitle: 'Feed History',
  feedTotalLabel: 'Total Feed: ',
  feedTotalValue: '{{amount}} kg',
  feedTypeLabel: 'Type: {{type}}',
  feedMethodLabel: 'Method: {{method}}',
  feedEmptyTitle: 'No Feed Records',
  feedEmptyText: 'Start logging feed to track consumption.',

  // ── HarvestHistoryScreen ──────────────────────────────────────────────────
  harvestTitle: 'Harvest Records',
  harvestTotalLabel: 'Total Biomass: ',
  harvestTotalValue: '{{amount}} kg',
  harvestMetricBiomass: 'Total Biomass',
  harvestMetricAvgSize: 'Avg Size',
  harvestBuyerLabel: 'Buyer: {{name}}',
  harvestSaleLabel: 'Sale: {{amount}}',
  harvestEmptyTitle: 'No Harvests Yet',
  harvestEmptyText: 'This pond has not recorded any harvests.',

  // ── MicrobiologyHistoryScreen ─────────────────────────────────────────────
  microbiologyTitle: 'Microbiology History',
  microbiologyDeleteMsg: 'Delete microbiology log for {{date}}?',
  microbiologyLevelCritical: 'Critical',
  microbiologyLevelWarning: 'Warning',
  microbiologyLevelSafe: 'Safe',
  microbiologyLevelNa: 'N/A',
  microbiologyEmptyTitle: 'No Microbiology Logs',
  microbiologyEmptyText: 'No microbiology data recorded yet.',

  // ── MortalityHistoryScreen ────────────────────────────────────────────────
  mortalityTitle: 'Mortality History',
  mortalityDeleteMsg: 'Delete mortality record from {{date}}?',
  mortalityDeleteError: 'Could not delete the record. Please try again.',
  mortalityTotalLabel: 'Total Mortality: ',
  mortalityEstWeight: 'Est. Weight: {{weight}} kg',
  mortalityEmptyTitle: 'No Mortality Logged',
  mortalityEmptyText: 'No mortality data recorded yet.',

  // ── PlanktonHistoryScreen ─────────────────────────────────────────────────
  planktonTitle: 'Plankton History',
  planktonDeleteMsg: 'Delete plankton log for {{date}}?',
  planktonTotalLabel: 'Total: {{total}} cells/mL',
  planktonEmptyTitle: 'No Plankton Logs',
  planktonEmptyText: 'No plankton data recorded yet.',

  // ── SamplingHistoryScreen ─────────────────────────────────────────────────
  samplingTitle: 'Sampling History',
  samplingDeleteMsg: 'Delete sampling record from {{date}}?',
  samplingDeleteError: 'Could not delete the record. Please try again.',
  samplingPillSamples: 'Samples',
  samplingPillBiomass: 'Biomass',
  samplingPillSr: 'SR',
  samplingEmptyTitle: 'No Sampling Records',
  samplingEmptyText: 'Start sampling to track growth over time.',

  // ── TreatmentHistoryScreen ────────────────────────────────────────────────
  treatmentTitle: 'Treatment History',
  treatmentEmptyTitle: 'No Treatments Logged',
  treatmentEmptyText: 'This pond has no recorded treatments.',
  bannedFlagLabel: 'Flagged: {{names}}',

  // ── WaterQualityHistoryScreen ─────────────────────────────────────────────
  waterQualityTitle: 'Water Quality History',
  waterQualityDeleteMsg: 'Are you sure you want to delete this water quality record? This cannot be undone.',
  waterQualityDeleteError: 'Failed to delete record',
  waterQualityCompareTitle: 'Compare Parameters',
  waterQualityMetricPh: 'pH',
  waterQualityMetricDo: 'DO (mg/L)',
  waterQualityMetricTemp: 'Temp (°C)',
  waterQualityMetricSalinity: 'Salinity',
  waterQualityMetricNitrate: 'Nitrate',
  waterQualityMetricHardness: 'Hardness',
  waterQualityMetricTransparency: 'Transparency',
  weeklyChemistryTag: 'Weekly chemistry',
  weeklyChemistryTitle: 'Weekly Chemistry',
  weeklyChemistryEmptyTitle: 'No chemistry tests yet',
  weeklyChemistryEmptyText: 'Log a test-kit reading and the trend for each parameter appears here.',
  weeklyChemistryLogAction: 'Log a test',
  weeklyChemistryNeedsMore: 'Two tests are needed before a trend can be drawn.',
  weeklyChemistryEntries: 'All tests',
  waterQualityEmptyTitle: 'No Water Quality Logs',
  waterQualityEmptyText: 'Start recording water quality to see trends.',
};
export default history;
