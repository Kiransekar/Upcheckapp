const finance = {
  // ── ExpensesScreen ──────────────────────────────────────────────────────────
  expensesTitle: 'செலவுகள்',

  // Cycle financials summary card
  cycleFinancials: 'சுழற்சி நிதி விவரம்',
  totalRevenue: 'மொத்த வருவாய்',
  revenueFromHarvests: 'வருவாய் நீங்கள் பதிவு செய்த அறுவடை விற்பனையிலிருந்து கணக்கிடப்படுகிறது.',
  recordHarvestSale: 'அறுவடை விற்பனையைப் பதிவு செய்',
  totalExpenses: 'மொத்த செலவுகள்',
  netProfit: 'நிகர லாபம்',
  marginPercent: 'லாப விகிதம் %',
  expensesByCategory: 'வகை வாரியான செலவுகள்',

  // Add-expense form
  addExpense: 'செலவு சேர்',
  fieldAmount: 'தொகை',
  placeholderAmount: '0.00',
  fieldPondId: 'குளம் ID',
  placeholderPondId: 'குளம் ID உள்ளிடுக',
  fieldDate: 'தேதி',
  placeholderDate: 'YYYY-MM-DD',
  fieldCategory: 'வகை',
  fieldNotes: 'குறிப்புகள்',
  placeholderNotes: 'விருப்பத்தேர்வு விவரம்',
  saveExpense: 'செலவை சேமி',

  // Validation alerts
  validationError: 'சரிபார்ப்பு பிழை',
  validAmountRequired: 'சரியான தொகையை உள்ளிடவும்',
  dateRequired: 'தேதி தேவை',
  pondIdRequired: 'குளம் ID தேவை',
  saveError: 'செலவை சேமிக்க முடியவில்லை',

  // List
  allExpenses: 'அனைத்து செலவுகளும்',
  // Marks a cycle-expense row that actually lives in the `transactions`
  // table — typed on the farm Money screen and tagged to this pond. It is
  // read-only here: the edit/delete endpoints on this tab do not own it.
  fromFarmMoney: 'பண்ணை பணத்திலிருந்து',
  fromPondExpenses: 'குள செலவிலிருந்து',

  // Empty / loading states
  loadingExpenses: 'செலவுகளை ஏற்றுகிறது…',
  noExpensesTitle: 'செலவுகள் இன்னும் இல்லை',
  noExpensesSubtitle: 'இந்த சுழற்சியின் முதல் செலவை பதிவு செய்ய + ஐ தட்டுக.',

  // ── TransactionsScreen ──────────────────────────────────────────────────────
  transactionsTitle: 'பரிவர்த்தனைகள்',
  transactionsTitleWithFarm: '{{farmName}} — பரிவர்த்தனைகள்',

  // Summary card
  financialSummary: 'நிதி சுருக்கம்',
  ledgerOnlyNote: "இங்கே பதிவு செய்த உள்ளீடுகள் மட்டும், மொத்த காலத்திற்கும். பணம் தாவலில் குளச் செலவுகளும் அறுவடை விற்பனையும் சேர்க்கப்படும்.",
  totalIncome: 'மொத்த வருமானம்',
  totalExpense: 'மொத்த செலவு',

  // Filter chips
  filterAll: 'அனைத்தும்',
  filterIncome: 'வருமானம்',
  filterExpense: 'செலவு',

  // Add-transaction toggle / form
  addTransaction: 'பரிவர்த்தனை சேர்',
  closeForm: 'படிவம் மூடு',
  typeIncome: 'வருமானம்',
  typeExpense: 'செலவு',
  fieldAmountLabel: 'தொகை (₹) *',
  fieldCategoryLabel: 'வகை *',
  placeholderCategory: 'எ.கா. மீன் விற்பனை, தீவனம்',
  fieldDescriptionLabel: 'விவரிப்பு',
  placeholderDescription: 'விருப்பத்தேர்வு குறிப்புகள்',
  fieldDateLabel: 'தேதி (YYYY-MM-DD) *',
  placeholderDateAlt: '2025-01-01',

  // Validation errors (inline)
  categoryRequired: 'வகை தேவை.',
  validPositiveAmount: 'சரியான நேர்மறை தொகையை உள்ளிடுக.',
  dateRequiredDot: 'தேதி தேவை.',
  saveTransactionError: 'பரிவர்த்தனை சேர்க்க முடியவில்லை.',

  // Loading / empty
  loadingTransactions: 'பரிவர்த்தனைகளை ஏற்றுகிறது…',
  noTransactionsTitle: 'பரிவர்த்தனைகள் இல்லை',
  noTransactionsSubtitle: 'பண்ணை நிதியை கண்காணிக்கத் தொடங்க முதல் வருமானம் அல்லது செலவை சேர்க்கவும்.',
  loadError: 'பரிவர்த்தனைகளை ஏற்ற முடியவில்லை.',

  // Money — artboard 3d
  moneyTitle: "பணம்",
  addEntry: "பதிவு சேர்",
  netSoFar: "இதுவரை நிகர",
  // Nothing recorded is not a net of zero — see the hero in MoneyScreen.
  nothingYetTitle: "இன்னும் எதுவும் பதிவாகவில்லை",
  nothingYetBody: "நீங்கள் செலவழிப்பதையும் விற்பதையும் பதிவு செய்யுங்கள், அதுவே உங்கள் லாப-நஷ்டமாகும்.",
  whereItWent: "எங்கே சென்றது",
  allFarms: "அனைத்துப் பண்ணைகள்",
  byFarm: "பண்ணை வாரியாக",
  farmInOut: "வரவு {{income}} · செலவு {{expense}}",
  creditOutstanding: "வியாபாரி கடன் நிலுவை",
  creditAllFarmsNote: "அனைத்து பண்ணைகள், அனைத்து தேதிகள் — வியாபாரி கடன் மேலே உள்ள சிப்களால் வடிகட்டப்படாது.",
  creditDue: "{{dealer}} · {{date}} அன்று",
  creditDealers: "{{count}} வியாபாரிகளிடம்",
  creditDealers_one: "ஒரு வியாபாரி",
  recentEntries: "சமீபத்திய பதிவுகள்",
  seeAll: "அனைத்தும் ›",
  noEntries: "இந்தப் பண்ணைக்கு இன்னும் எதுவும் பதிவாகவில்லை.",
  harvestSale: "அறுவடை விற்பனை",
  harvestSoldTo: "{{buyer}}-க்கு விற்கப்பட்டது",
  entriesNote: "சமீபத்திய ஆறு பதிவுகள் மட்டும். குளச் செலவுகளும் அறுவடை விற்பனையும் இங்கேயே தெரியும்; முழுக் காலத்தின் கூட்டுத்தொகை \"எங்கே சென்றது\" பகுதியில் உள்ளது.",
  noFarmTitle: "இன்னும் பண்ணை இல்லை",
  noFarmSub: "பணத்தைக் கண்காணிக்க ஒரு பண்ணையைச் சேர்க்கவும்.",

  periodAll: "எல்லா காலமும்",
  periodToday: "இன்று",
  periodWeek: "இந்த வாரம்",
  periodMonth: "இந்த மாதம்",
  periodCustom: "தேர்வு",
  customFrom: "இருந்து",
  customTo: "வரை",

  includeArchived: "காப்பக குளங்களைச் சேர்",
  includeArchivedHint: "மூடப்பட்ட குளங்களின் பணமும் உங்கள் செலவும் வருமானமும் தான்.",
  includeArchivedWorth: "மேலே உள்ள கணக்கில் {{amount}}.",
  entriesArchivedNote: "மேலே உள்ள மொத்தத்தில் காப்பக குளங்களும் சேர்ந்துள்ளன. குளத்தின் சொந்தச் செலவுகள் பட்டியலில் காப்பகம் எனக் குறிக்கப்பட்டுள்ளன; பண்ணையின் பெயரில் எழுதப்பட்ட பதிவுக்குக் குளம் இல்லை, எனவே குறி இல்லை.",
  includeInventory: "இருப்பு வாங்கியதைச் சேர்",
  includeInventoryHint: "வாங்கிய இருப்பு அந்த நாளின் செலவாகக் கணக்கிடப்படும்.",
  includeInventoryOff: "மேலே உள்ள கணக்கில் இருப்பு வாங்கியது சேர்க்கப்படவில்லை.",
  includeInventoryWorth: "மேலே உள்ள செலவில் {{amount}}.",
  archivedTag: "காப்பகம்",

  byPond: "குளம் வாரியாக",
  wholeFarm: "முழு பண்ணை",
  fieldPondLabel: "குளம் (விருப்பத்திற்குரியது)",
  allCycles: "எல்லா சுழற்சிகளும்",
  pondCostTotal: "இந்தக் குளத்தின் செலவு",
  cycleCostTotal: "இந்தச் சுழற்சியின் செலவு",
  noPondCosts: "இந்தக் காலத்தில் இந்தக் குளத்திற்கு எதுவும் பதிவாகவில்லை.",
};
export default finance;
