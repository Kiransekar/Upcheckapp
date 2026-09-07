const finance = {
  // ── ExpensesScreen ──────────────────────────────────────────────────────────
  expensesTitle: 'खर्च',

  // Cycle financials summary card
  cycleFinancials: 'चक्र वित्तीय',
  totalRevenue: 'कुल राजस्व',
  revenueFromHarvests: 'राजस्व आपकी दर्ज की गई फसल बिक्री से गणना किया जाता है।',
  recordHarvestSale: 'फसल बिक्री दर्ज करें',
  totalExpenses: 'कुल खर्च',
  netProfit: 'शुद्ध लाभ',
  marginPercent: 'मार्जिन %',
  expensesByCategory: 'श्रेणी अनुसार खर्च',

  // Add-expense form
  addExpense: 'खर्च जोड़ें',
  fieldAmount: 'राशि',
  placeholderAmount: '0.00',
  fieldPondId: 'तालाब ID',
  placeholderPondId: 'तालाब ID दर्ज करें',
  fieldDate: 'तारीख',
  placeholderDate: 'YYYY-MM-DD',
  fieldCategory: 'श्रेणी',
  fieldNotes: 'नोट्स',
  placeholderNotes: 'वैकल्पिक विवरण',
  saveExpense: 'खर्च सहेजें',

  // Validation alerts
  validationError: 'सत्यापन त्रुटि',
  validAmountRequired: 'कृपया वैध राशि दर्ज करें',
  dateRequired: 'तारीख आवश्यक है',
  pondIdRequired: 'तालाब ID आवश्यक है',
  saveError: 'खर्च सहेजने में विफल',

  // List
  allExpenses: 'सभी खर्च',

  // Empty / loading states
  loadingExpenses: 'खर्च लोड हो रहे हैं…',
  noExpensesTitle: 'अभी कोई खर्च नहीं',
  noExpensesSubtitle: 'इस चक्र का पहला खर्च दर्ज करने के लिए + टैप करें।',

  // ── TransactionsScreen ──────────────────────────────────────────────────────
  transactionsTitle: 'लेनदेन',
  transactionsTitleWithFarm: '{{farmName}} — लेनदेन',

  // Summary card
  financialSummary: 'वित्तीय सारांश',
  ledgerOnlyNote: "केवल यहाँ दर्ज प्रविष्टियाँ, पूरे समय की। पैसा टैब में तालाब के खर्च और फसल बिक्री भी गिनी जाती है।",
  totalIncome: 'कुल आय',
  totalExpense: 'कुल खर्च',

  // Filter chips
  filterAll: 'सभी',
  filterIncome: 'आय',
  filterExpense: 'खर्च',

  // Add-transaction toggle / form
  addTransaction: 'लेनदेन जोड़ें',
  closeForm: 'फॉर्म बंद करें',
  typeIncome: 'आय',
  typeExpense: 'खर्च',
  fieldAmountLabel: 'राशि (₹) *',
  fieldCategoryLabel: 'श्रेणी *',
  placeholderCategory: 'उदा. मछली बिक्री, आहार',
  fieldDescriptionLabel: 'विवरण',
  placeholderDescription: 'वैकल्पिक नोट्स',
  fieldDateLabel: 'तारीख (YYYY-MM-DD) *',
  placeholderDateAlt: '2025-01-01',

  // Validation errors (inline)
  categoryRequired: 'श्रेणी आवश्यक है।',
  validPositiveAmount: 'वैध धनात्मक राशि दर्ज करें।',
  dateRequiredDot: 'तारीख आवश्यक है।',
  saveTransactionError: 'लेनदेन जोड़ने में विफल।',

  // Loading / empty
  loadingTransactions: 'लेनदेन लोड हो रहे हैं…',
  noTransactionsTitle: 'कोई लेनदेन नहीं',
  noTransactionsSubtitle: 'फार्म वित्त ट्रैक करना शुरू करने के लिए पहली आय या खर्च जोड़ें।',
  loadError: 'लेनदेन लोड करने में विफल।',

  // Money — artboard 3d
  moneyTitle: "पैसा",
  addEntry: "एंट्री जोड़ें",
  netSoFar: "अब तक शुद्ध",
  // Nothing recorded is not a net of zero — see the hero in MoneyScreen.
  nothingYetTitle: "अभी कुछ दर्ज नहीं",
  nothingYetBody: "आप जो खर्च और बिक्री करते हैं वह दर्ज करें, यही आपका लाभ-हानि बन जाएगा।",
  whereItWent: "कहाँ गया",
  allFarms: "सभी फ़ार्म",
  byFarm: "फ़ार्म के अनुसार",
  farmInOut: "आया {{income}} · गया {{expense}}",
  creditOutstanding: "डीलर उधार बाकी",
  creditAllFarmsNote: "सभी खेत, सभी तारीखें — डीलर उधार ऊपर के चिप्स से नहीं छँटता।",
  creditDue: "{{dealer}} · देय {{date}}",
  creditDealers: "{{count}} डीलरों में",
  creditDealers_one: "एक डीलर",
  recentEntries: "हाल की एंट्रियाँ",
  seeAll: "सभी ›",
  noEntries: "इस फ़ार्म के लिए अभी कुछ दर्ज नहीं।",
  harvestSale: "फसल बिक्री",
  harvestSoldTo: "{{buyer}} को बेचा",
  entriesNote: "केवल हाल की छह एंट्रियाँ। तालाब के खर्च और फ़सल की बिक्री भी यहीं दिखती हैं; पूरे समय का जोड़ \"कहाँ गया\" में है।",
  noFarmTitle: "अभी कोई फ़ार्म नहीं",
  noFarmSub: "पैसा ट्रैक करने के लिए एक फ़ार्म जोड़ें।",

  periodAll: "पूरा समय",
  periodToday: "आज",
  periodWeek: "इस सप्ताह",
  periodMonth: "इस महीने",
  periodCustom: "चुनें",
  customFrom: "से",
  customTo: "तक",

  includeArchived: "संग्रहित तालाब गिनें",
  includeArchivedHint: "बंद किए गए तालाबों का पैसा भी आपका खर्च और आय है।",
  includeArchivedWorth: "ऊपर के आँकड़ों में से {{amount}}।",
  entriesArchivedNote: "ऊपर के कुल में संग्रहित तालाब भी गिने गए हैं। तालाब के अपने खर्च सूची में संग्रहित के रूप में चिह्नित हैं; फ़ार्म पर दर्ज एंट्री का कोई तालाब नहीं होता, इसलिए उस पर निशान नहीं।",
  includeInventory: "स्टॉक खरीद गिनें",
  includeInventoryHint: "खरीदा गया स्टॉक उसी दिन खर्च में गिना जाता है।",
  includeInventoryOff: "ऊपर के आँकड़ों में स्टॉक खरीद शामिल नहीं है।",
  includeInventoryWorth: "ऊपर के खर्च में से {{amount}}।",
  archivedTag: "संग्रहित",

  byPond: "तालाब के अनुसार",
  wholeFarm: "पूरा फ़ार्म",
  fieldPondLabel: "तालाब (वैकल्पिक)",
  allCycles: "सभी चक्र",
  pondCostTotal: "इस तालाब का खर्च",
  cycleCostTotal: "इस चक्र का खर्च",
  noPondCosts: "इस अवधि में इस तालाब के लिए कुछ दर्ज नहीं।",
};
export default finance;
