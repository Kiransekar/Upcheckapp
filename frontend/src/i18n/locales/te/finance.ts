const finance = {
  // ── ExpensesScreen ──────────────────────────────────────────────────────────
  expensesTitle: 'ఖర్చులు',

  // Cycle financials summary card
  cycleFinancials: 'సైకిల్ ఆర్థిక వివరాలు',
  totalRevenue: 'మొత్తం ఆదాయం',
  revenueFromHarvests: 'ఆదాయం మీరు నమోదు చేసిన పంట అమ్మకాల నుండి లెక్కించబడుతుంది.',
  recordHarvestSale: 'పంట అమ్మకాన్ని నమోదు చేయండి',
  totalExpenses: 'మొత్తం ఖర్చులు',
  netProfit: 'నికర లాభం',
  marginPercent: 'మార్జిన్ %',
  expensesByCategory: 'వర్గం వారీ ఖర్చులు',

  // Add-expense form
  addExpense: 'ఖర్చు జోడించు',
  fieldAmount: 'మొత్తం',
  placeholderAmount: '0.00',
  fieldPondId: 'చెరువు ID',
  placeholderPondId: 'చెరువు ID నమోదు చేయండి',
  fieldDate: 'తేదీ',
  placeholderDate: 'YYYY-MM-DD',
  fieldCategory: 'వర్గం',
  fieldNotes: 'గమనికలు',
  placeholderNotes: 'ఐచ్ఛిక వివరణ',
  saveExpense: 'ఖర్చు సేవ్ చేయి',

  // Validation alerts
  validationError: 'ధృవీకరణ లోపం',
  validAmountRequired: 'దయచేసి చెల్లుబాటు అయ్యే మొత్తం నమోదు చేయండి',
  dateRequired: 'తేదీ తప్పనిసరి',
  pondIdRequired: 'చెరువు ID తప్పనిసరి',
  saveError: 'ఖర్చు సేవ్ చేయడం విఫలమైంది',

  // List
  allExpenses: 'అన్ని ఖర్చులు',

  // Empty / loading states
  loadingExpenses: 'ఖర్చులు లోడ్ అవుతున్నాయి…',
  noExpensesTitle: 'ఇంకా ఖర్చులు లేవు',
  noExpensesSubtitle: 'ఈ సైకిల్ మొదటి ఖర్చు నమోదు చేయడానికి + నొక్కండి.',

  // ── TransactionsScreen ──────────────────────────────────────────────────────
  transactionsTitle: 'లావాదేవీలు',
  transactionsTitleWithFarm: '{{farmName}} — లావాదేవీలు',

  // Summary card
  financialSummary: 'ఆర్థిక సారాంశం',
  totalIncome: 'మొత్తం ఆదాయం',
  totalExpense: 'మొత్తం ఖర్చు',

  // Filter chips
  filterAll: 'అన్నీ',
  filterIncome: 'ఆదాయం',
  filterExpense: 'ఖర్చు',

  // Add-transaction toggle / form
  addTransaction: 'లావాదేవీ జోడించు',
  closeForm: 'ఫారం మూసివేయి',
  typeIncome: 'ఆదాయం',
  typeExpense: 'ఖర్చు',
  fieldAmountLabel: 'మొత్తం (₹) *',
  fieldCategoryLabel: 'వర్గం *',
  placeholderCategory: 'ఉదా. చేప అమ్మకాలు, దాణా',
  fieldDescriptionLabel: 'వివరణ',
  placeholderDescription: 'ఐచ్ఛిక గమనికలు',
  fieldDateLabel: 'తేదీ (YYYY-MM-DD) *',
  placeholderDateAlt: '2025-01-01',

  // Validation errors (inline)
  categoryRequired: 'వర్గం తప్పనిసరి.',
  validPositiveAmount: 'చెల్లుబాటు అయ్యే ధన మొత్తం నమోదు చేయండి.',
  dateRequiredDot: 'తేదీ తప్పనిసరి.',
  saveTransactionError: 'లావాదేవీ జోడించడం విఫలమైంది.',

  // Loading / empty
  loadingTransactions: 'లావాదేవీలు లోడ్ అవుతున్నాయి…',
  noTransactionsTitle: 'లావాదేవీలు లేవు',
  noTransactionsSubtitle: 'ఫారం ఆర్థిక వ్యవహారాలు ట్రాక్ చేయడానికి మీ మొదటి ఆదాయం లేదా ఖర్చు జోడించండి.',
  loadError: 'లావాదేవీలు లోడ్ చేయడం విఫలమైంది.',

  // Money — artboard 3d
  moneyTitle: "డబ్బు",
  addEntry: "ఎంట్రీ చేర్చు",
  netSoFar: "ఇప్పటివరకు నికర",
  whereItWent: "ఎక్కడికి పోయింది",
  allFarms: "అన్ని ఫారాలు",
  byFarm: "ఫారం వారీగా",
  farmInOut: "వచ్చినది {{income}} · పోయినది {{expense}}",
  creditOutstanding: "డీలర్ అప్పు బాకీ",
  creditDue: "{{dealer}} · {{date}} న",
  creditDealers: "{{count}} డీలర్లలో",
  creditDealers_one: "ఒక డీలర్",
  recentEntries: "ఇటీవలి ఎంట్రీలు",
  seeAll: "అన్నీ ›",
  noEntries: "ఈ ఫారంకు ఇంకా ఏమీ నమోదు కాలేదు.",
  noFarmTitle: "ఇంకా ఫారాలు లేవు",
  noFarmSub: "డబ్బు ట్రాక్ చేయడానికి ఒక ఫారం చేర్చండి.",
};
export default finance;
