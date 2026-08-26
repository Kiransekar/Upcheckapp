const simulations = {
  // ── SimulationListScreen ──────────────────────────────────────────────────
  list: {
    title: 'Simulations',
    statBiomass: '{{value}} kg Biomass',
    statProfit: 'Profit: {{value}}',
    statNa: 'N/A',
    emptyTitle: 'No Simulations yet',
    emptyDesc: 'Create your first forecast to plan your next cycle effectively.',
    deleteTitle: 'Delete simulation',
    deleteMessage: 'Remove this saved simulation?',
    errorDelete: 'Failed to delete simulation',
  
    // artboard p4
    eyebrow: "Planning",
    intro: "Pick the question you are actually asking. Numbers come from the pond — you only move what you are testing.",
    whileRunning: "While the cycle is running",
    beforeStocking: "Before stocking a pond",
    saved: "Saved",
    pickPondTitle: "Pick a pond first",
    pickPondBody: "Choose the pond this question is about, so the run can use its numbers.",
  },

  // ── SimulationCreateScreen ────────────────────────────────────────────────
  create: {
    title: 'New Simulation',
    subtitle: 'Run a what-if scenario on an active pond cycle',
    sectionPond: 'Pond',
    labelPondId: 'Pond ID *',
    placeholderPondId: 'UUID of the pond with an active cycle',
    sectionScenario: 'Scenario Type',
    scenarioFeedChange: 'Feed Change',
    scenarioPriceChange: 'Price Change',
    scenarioStockingDensity: 'Stocking Density',
    sectionVariables: 'Variables',
    labelFeedPrice: 'Feed Price (per kg)',
    labelGrowthImprovement: 'Growth Improvement (%)',
    labelSellingPrice: 'Selling Price (per kg)',
    labelStockingDensity: 'Stocking Density (PL/m²)',
    runSimulation: 'Run Simulation',
    errorPondId: 'Please enter a Pond ID',
    errorSimFailed: 'Failed to run simulation',
    validationTitle: 'Validation Error',
    simFailedTitle: 'Simulation Failed',
  
    // artboard p4
    eyebrow: "Simulation",
    whatYouAreChanging: "What you are changing",
    currently: "Currently {{value}}",
  },

  // ── SimulationResultsScreen ───────────────────────────────────────────────
  results: {
    title: 'Simulation Results',
    vsBaseline: 'vs baseline',
    profitDifference: 'Profit Difference',
    sectionResults: 'Simulation Results',
    labelProjectedBiomass: 'Projected Biomass',
    labelProjectedFcr: 'Projected FCR',
    labelTotalRevenue: 'Total Revenue',
    labelTotalCost: 'Total Cost',
    sectionProfitComparison: 'Profit Comparison',
    labelBaselineProfit: 'Baseline Net Profit:',
    labelSimulatedProfit: 'Simulated Net Profit:',
    labelRiskWarning: 'Risk Warning:',
    noData: 'No simulation data found.',
  
    // artboard p5
    shortTitle: "Result",
    whatItPredicts: "What the run predicts",
    againstDoingNothing: "Against doing nothing",
    barsNote: "Grey is what you make anyway. Green is what the change adds.",
    barsNoteLoss: "Grey is what you make anyway. Red is what the change costs.",
    whatYouChanged: "What you changed",
    runOn: "Run {{date}}",
    keepPlan: "Keep this plan",
    runAgain: "Run again",
  },

  // Questions — artboard p4
  q: {
    feed_change: {
      title: "Is cheaper feed worth it?",
      desc: "Feed price against FCR and growth",
      label: "Feed price (₹/kg)",
      errorValue: "Enter a feed price to test",
    },
    price_change: {
      title: "What if the selling price moves?",
      desc: "Shrimp price against revenue and margin",
      label: "Selling price (₹/kg)",
      errorValue: "Enter a selling price to test",
    },
    stocking_density: {
      title: "How dense should I stock?",
      desc: "PL per m² against survival and FCR",
      label: "Stocking density (PL/m²)",
      errorValue: "Enter a stocking density to test",
    },
  },
};
export default simulations;
