const finance = {
  // ── ExpensesScreen ──────────────────────────────────────────────────────────
  expensesTitle: 'ব্যয়',

  // Cycle financials summary card
  cycleFinancials: 'চক্রের আর্থিক তথ্য',
  totalRevenue: 'মোট রাজস্ব',
  revenueFromHarvests: 'রাজস্ব আপনার রেকর্ড করা ফসল বিক্রয় থেকে গণনা করা হয়।',
  recordHarvestSale: 'ফসল বিক্রয় রেকর্ড করুন',
  totalExpenses: 'মোট ব্যয়',
  netProfit: 'নিট মুনাফা',
  marginPercent: 'মার্জিন %',
  expensesByCategory: 'বিভাগ অনুযায়ী ব্যয়',

  // Add-expense form
  addExpense: 'ব্যয় যোগ করুন',
  fieldAmount: 'পরিমাণ',
  placeholderAmount: '0.00',
  fieldPondId: 'পুকুর ID',
  placeholderPondId: 'পুকুর ID লিখুন',
  fieldDate: 'তারিখ',
  placeholderDate: 'YYYY-MM-DD',
  fieldCategory: 'বিভাগ',
  fieldNotes: 'নোট',
  placeholderNotes: 'ঐচ্ছিক বিবরণ',
  saveExpense: 'ব্যয় সংরক্ষণ করুন',

  // Validation alerts
  validationError: 'যাচাইকরণ ত্রুটি',
  validAmountRequired: 'সঠিক পরিমাণ লিখুন',
  dateRequired: 'তারিখ আবশ্যক',
  pondIdRequired: 'পুকুর ID আবশ্যক',
  saveError: 'ব্যয় সংরক্ষণ ব্যর্থ',

  // List
  allExpenses: 'সমস্ত ব্যয়',

  // Empty / loading states
  loadingExpenses: 'ব্যয় লোড হচ্ছে…',
  noExpensesTitle: 'এখনও কোনো ব্যয় নেই',
  noExpensesSubtitle: 'এই চক্রের প্রথম ব্যয় রেকর্ড করতে + ট্যাপ করুন।',

  // ── TransactionsScreen ──────────────────────────────────────────────────────
  transactionsTitle: 'লেনদেন',
  transactionsTitleWithFarm: '{{farmName}} — লেনদেন',

  // Summary card
  financialSummary: 'আর্থিক সারসংক্ষেপ',
  totalIncome: 'মোট আয়',
  totalExpense: 'মোট ব্যয়',

  // Filter chips
  filterAll: 'সব',
  filterIncome: 'আয়',
  filterExpense: 'ব্যয়',

  // Add-transaction toggle / form
  addTransaction: 'লেনদেন যোগ করুন',
  closeForm: 'ফর্ম বন্ধ করুন',
  typeIncome: 'আয়',
  typeExpense: 'ব্যয়',
  fieldAmountLabel: 'পরিমাণ (₹) *',
  fieldCategoryLabel: 'বিভাগ *',
  placeholderCategory: 'যেমন: মাছ বিক্রয়, খাদ্য',
  fieldDescriptionLabel: 'বিবরণ',
  placeholderDescription: 'ঐচ্ছিক নোট',
  fieldDateLabel: 'তারিখ (YYYY-MM-DD) *',
  placeholderDateAlt: '2025-01-01',

  // Validation errors (inline)
  categoryRequired: 'বিভাগ আবশ্যক।',
  validPositiveAmount: 'সঠিক ধনাত্মক পরিমাণ লিখুন।',
  dateRequiredDot: 'তারিখ আবশ্যক।',
  saveTransactionError: 'লেনদেন যোগ করতে ব্যর্থ।',

  // Loading / empty
  loadingTransactions: 'লেনদেন লোড হচ্ছে…',
  noTransactionsTitle: 'কোনো লেনদেন নেই',
  noTransactionsSubtitle: 'খামারের আর্থিক ট্র্যাকিং শুরু করতে আপনার প্রথম আয় বা ব্যয় যোগ করুন।',
  loadError: 'লেনদেন লোড করতে ব্যর্থ।',

  // Money — artboard 3d
  moneyTitle: "টাকা",
  addEntry: "এন্ট্রি যোগ করুন",
  netSoFar: "এ পর্যন্ত নিট",
  whereItWent: "কোথায় গেল",
  creditOutstanding: "ডিলার বাকি",
  creditDue: "{{dealer}} · {{date}} তারিখে",
  creditDealers: "{{count}} জন ডিলারের কাছে",
  creditDealers_one: "একজন ডিলার",
  recentEntries: "সাম্প্রতিক এন্ট্রি",
  seeAll: "সব ›",
  noEntries: "এই খামারের জন্য এখনও কিছু নথিভুক্ত হয়নি।",
  noFarmTitle: "কোনো খামার নির্বাচিত নয়",
  noFarmSub: "টাকা দেখতে একটি খামার বেছে নিন।",
};
export default finance;
