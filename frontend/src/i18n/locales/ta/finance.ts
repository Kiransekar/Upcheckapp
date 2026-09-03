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

  // Empty / loading states
  loadingExpenses: 'செலவுகளை ஏற்றுகிறது…',
  noExpensesTitle: 'செலவுகள் இன்னும் இல்லை',
  noExpensesSubtitle: 'இந்த சுழற்சியின் முதல் செலவை பதிவு செய்ய + ஐ தட்டுக.',

  // ── TransactionsScreen ──────────────────────────────────────────────────────
  transactionsTitle: 'பரிவர்த்தனைகள்',
  transactionsTitleWithFarm: '{{farmName}} — பரிவர்த்தனைகள்',

  // Summary card
  financialSummary: 'நிதி சுருக்கம்',
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
  creditDue: "{{dealer}} · {{date}} அன்று",
  creditDealers: "{{count}} வியாபாரிகளிடம்",
  creditDealers_one: "ஒரு வியாபாரி",
  recentEntries: "சமீபத்திய பதிவுகள்",
  seeAll: "அனைத்தும் ›",
  noEntries: "இந்தப் பண்ணைக்கு இன்னும் எதுவும் பதிவாகவில்லை.",
  harvestSale: "அறுவடை விற்பனை",
  harvestSoldTo: "{{buyer}}-க்கு விற்கப்பட்டது",
  entriesNote: "சமீபத்திய பதிவுகள் மட்டும். மேலே உள்ள நிகரத்தில் சுழற்சியில் பதிந்த செலவுகளும் அடங்கும் — அவை \"எங்கே சென்றது\" பகுதியில் உள்ளன.",
  noFarmTitle: "இன்னும் பண்ணை இல்லை",
  noFarmSub: "பணத்தைக் கண்காணிக்க ஒரு பண்ணையைச் சேர்க்கவும்.",
};
export default finance;
