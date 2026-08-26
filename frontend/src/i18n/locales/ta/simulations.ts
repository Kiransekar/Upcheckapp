const simulations = {
  // ── SimulationListScreen ──────────────────────────────────────────────────
  list: {
    title: 'உருவகப்படுத்தல்கள்',
    statBiomass: '{{value}} kg உயிரி நிறை',
    statProfit: 'லாபம்: {{value}}',
    statNa: 'பொருந்தாது',
    emptyTitle: 'உருவகப்படுத்தல்கள் இன்னும் இல்லை',
    emptyDesc: 'அடுத்த சுழற்சியை திட்டமிட உங்கள் முதல் முன்கணிப்பை உருவாக்கவும்.',
    deleteTitle: 'உருவகப்படுத்தலை நீக்கு',
    deleteMessage: 'இந்த சேமிக்கப்பட்ட உருவகப்படுத்தலை நீக்கவா?',
    errorDelete: 'உருவகப்படுத்தலை நீக்க முடியவில்லை',
  
    // artboard p4
    eyebrow: "திட்டமிடல்",
    intro: "நீங்கள் உண்மையில் கேட்கும் கேள்வியைத் தேர்வு செய்யுங்கள். எண்கள் குளத்திலிருந்து வரும் — நீங்கள் சோதிப்பதை மட்டும் மாற்றுங்கள்.",
    whileRunning: "சுழற்சி நடக்கும்போது",
    beforeStocking: "குளத்தில் இருப்பு வைப்பதற்கு முன்",
    saved: "சேமித்தவை",
    pickPondTitle: "முதலில் ஒரு குளத்தைத் தேர்வு செய்",
    pickPondBody: "இந்தக் கேள்வி எந்தக் குளம் பற்றியது என்று தேர்வு செய்யுங்கள்.",
  },

  // ── SimulationCreateScreen ────────────────────────────────────────────────
  create: {
    title: 'புதிய உருவகப்படுத்தல்',
    subtitle: 'செயலில் உள்ள குளச் சுழற்சியில் "என்னாகும்" காட்சியை இயக்கு',
    sectionPond: 'குளம்',
    labelPondId: 'குளம் ID *',
    placeholderPondId: 'செயலில் உள்ள சுழற்சியுடன் குளத்தின் UUID',
    sectionScenario: 'காட்சி வகை',
    scenarioFeedChange: 'தீவன மாற்றம்',
    scenarioPriceChange: 'விலை மாற்றம்',
    scenarioStockingDensity: 'கையிருப்பு அடர்த்தி',
    sectionVariables: 'மாறிகள்',
    labelFeedPrice: 'தீவன விலை (kg-க்கு)',
    labelGrowthImprovement: 'வளர்ச்சி மேம்பாடு (%)',
    labelSellingPrice: 'விற்பனை விலை (kg-க்கு)',
    labelStockingDensity: 'கையிருப்பு அடர்த்தி (PL/m²)',
    runSimulation: 'உருவகப்படுத்தல் இயக்கு',
    errorPondId: 'குளம் ID உள்ளிடவும்',
    errorSimFailed: 'உருவகப்படுத்தலை இயக்க முடியவில்லை',
    validationTitle: 'சரிபார்ப்பு பிழை',
    simFailedTitle: 'உருவகப்படுத்தல் தோல்வியடைந்தது',
  
    // artboard p4
    eyebrow: "உருவகப்படுத்தல்",
    whatYouAreChanging: "நீங்கள் மாற்றுவது",
    currently: "தற்போது {{value}}",
  },

  // ── SimulationResultsScreen ───────────────────────────────────────────────
  results: {
    title: 'உருவகப்படுத்தல் முடிவுகள்',
    vsBaseline: 'அடிப்படையுடன் ஒப்பிடு',
    profitDifference: 'லாப வேறுபாடு',
    sectionResults: 'உருவகப்படுத்தல் முடிவுகள்',
    labelProjectedBiomass: 'கணிக்கப்பட்ட உயிரி நிறை',
    labelProjectedFcr: 'கணிக்கப்பட்ட FCR',
    labelTotalRevenue: 'மொத்த வருவாய்',
    labelTotalCost: 'மொத்த செலவு',
    sectionProfitComparison: 'லாப ஒப்பீடு',
    labelBaselineProfit: 'அடிப்படை நிகர லாபம்:',
    labelSimulatedProfit: 'உருவகப்படுத்தல் நிகர லாபம்:',
    labelRiskWarning: 'அபாய எச்சரிக்கை:',
    noData: 'உருவகப்படுத்தல் தரவு எதுவும் இல்லை.',
  
    // artboard p5
    shortTitle: "முடிவு",
    whatItPredicts: "இந்த ஓட்டம் என்ன சொல்கிறது",
    againstDoingNothing: "எதுவும் செய்யாததுடன் ஒப்பிட்டு",
    barsNote: "சாம்பல் என்பது எப்படியும் கிடைப்பது. பச்சை என்பது மாற்றம் சேர்ப்பது.",
    barsNoteLoss: "சாம்பல் என்பது எப்படியும் கிடைப்பது. சிவப்பு என்பது மாற்றத்தின் இழப்பு.",
    whatYouChanged: "நீங்கள் மாற்றியது",
    runOn: "{{date}} அன்று இயக்கப்பட்டது",
    keepPlan: "இந்தத் திட்டத்தை வைத்திரு",
    runAgain: "மீண்டும் இயக்கு",
  },

  // Questions — artboard p4
  q: {
    feed_change: {
      title: "மலிவான தீவனம் லாபமா?",
      desc: "தீவன விலை vs FCR மற்றும் வளர்ச்சி",
      label: "தீவன விலை (₹/கிகி)",
      errorValue: "சோதிக்க தீவன விலையை உள்ளிடவும்",
    },
    price_change: {
      title: "விற்பனை விலை மாறினால்?",
      desc: "இறால் விலை vs வருவாய் மற்றும் லாபம்",
      label: "விற்பனை விலை (₹/கிகி)",
      errorValue: "சோதிக்க விற்பனை விலையை உள்ளிடவும்",
    },
    stocking_density: {
      title: "எவ்வளவு அடர்த்தியாக இருப்பு வைக்க?",
      desc: "ஒரு m²க்கு PL vs உயிர்பிழைப்பு மற்றும் FCR",
      label: "இருப்பு அடர்த்தி (PL/m²)",
      errorValue: "சோதிக்க அடர்த்தியை உள்ளிடவும்",
    },
  },
};
export default simulations;
