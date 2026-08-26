const finance = {
  // ── ExpensesScreen ──────────────────────────────────────────────────────────
  expensesTitle: 'Expenses',

  // Cycle financials summary card
  cycleFinancials: 'Cycle Financials',
  totalRevenue: 'Total Revenue',
  revenueFromHarvests: 'Revenue is calculated from your recorded harvest sales.',
  recordHarvestSale: 'Record a harvest sale',
  totalExpenses: 'Total Expenses',
  netProfit: 'Net Profit',
  marginPercent: 'Margin %',
  expensesByCategory: 'Expenses by Category',

  // Add-expense form
  addExpense: 'Add Expense',
  fieldAmount: 'Amount',
  placeholderAmount: '0.00',
  fieldPondId: 'Pond ID',
  placeholderPondId: 'Enter pond ID',
  fieldDate: 'Date',
  placeholderDate: 'YYYY-MM-DD',
  fieldCategory: 'Category',
  fieldNotes: 'Notes',
  placeholderNotes: 'Optional description',
  saveExpense: 'Save Expense',

  // Validation alerts
  validationError: 'Validation Error',
  validAmountRequired: 'Please enter a valid amount',
  dateRequired: 'Date is required',
  pondIdRequired: 'Pond ID is required',
  saveError: 'Failed to save expense',

  // List
  allExpenses: 'All Expenses',

  // Empty / loading states
  loadingExpenses: 'Loading expenses…',
  noExpensesTitle: 'No Expenses Yet',
  noExpensesSubtitle: 'Tap + to record your first expense for this cycle.',

  // ── TransactionsScreen ──────────────────────────────────────────────────────
  transactionsTitle: 'Transactions',
  transactionsTitleWithFarm: '{{farmName}} — Transactions',

  // Summary card
  financialSummary: 'Financial Summary',
  totalIncome: 'Total Income',
  totalExpense: 'Total Expense',

  // Filter chips
  filterAll: 'All',
  filterIncome: 'Income',
  filterExpense: 'Expense',

  // Add-transaction toggle / form
  addTransaction: 'Add Transaction',
  closeForm: 'Close Form',
  typeIncome: 'Income',
  typeExpense: 'Expense',
  fieldAmountLabel: 'Amount (₹) *',
  fieldCategoryLabel: 'Category *',
  placeholderCategory: 'e.g. Fish Sales, Feed',
  fieldDescriptionLabel: 'Description',
  placeholderDescription: 'Optional notes',
  fieldDateLabel: 'Date (YYYY-MM-DD) *',
  placeholderDateAlt: '2026-01-01',

  // Validation errors (inline)
  categoryRequired: 'Category is required.',
  validPositiveAmount: 'Enter a valid positive amount.',
  dateRequiredDot: 'Date is required.',
  saveTransactionError: 'Failed to add transaction.',

  // Loading / empty
  loadingTransactions: 'Loading transactions…',
  noTransactionsTitle: 'No Transactions',
  noTransactionsSubtitle: 'Add your first income or expense to start tracking farm finances.',
  loadError: 'Failed to load transactions.',

  // Money — artboard 3d
  moneyTitle: "Money",
  addEntry: "Add entry",
  netSoFar: "Net so far",
  whereItWent: "Where it went",
  allFarms: "All farms",
  byFarm: "By farm",
  farmInOut: "In {{income}} · Out {{expense}}",
  creditOutstanding: "Dealer credit outstanding",
  creditDue: "{{dealer}} · due {{date}}",
  creditDealers: "Across {{count}} dealers",
  creditDealers_one: "One dealer",
  recentEntries: "Recent entries",
  seeAll: "All ›",
  noEntries: "Nothing recorded for this farm yet.",
  noFarmTitle: "No farms yet",
  noFarmSub: "Add a farm to start tracking money.",
};
export default finance;
