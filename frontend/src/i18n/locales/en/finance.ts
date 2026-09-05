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
  // Nothing recorded is not a net of zero — see the hero in MoneyScreen.
  nothingYetTitle: "Nothing recorded yet",
  nothingYetBody: "Add what you spend and what you sell, and this becomes your profit and loss.",
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
  // A harvest sale is a read-only line — it comes from the harvest, not from a
  // transaction anyone can edit here.
  harvestSale: "Harvest sale",
  harvestSoldTo: "Sold to {{buyer}}",
  // The list is the SIX most recent entries, and cycle costs are summarised
  // rather than listed — so it will not add up to the net above. Say so.
  entriesNote: "Recent entries only. The net above also counts costs recorded against a cycle — those are summarised in \"Where it went\".",
  noFarmTitle: "No farms yet",
  noFarmSub: "Add a farm to start tracking money.",

  // Period filter. Ranges are the device's local calendar days — the farmer's
  // day, not UTC — and the week starts on Sunday, like the calendar grid.
  periodAll: "All time",
  periodToday: "Today",
  periodWeek: "This week",
  periodMonth: "This month",
  periodCustom: "Custom",
  customFrom: "From",
  customTo: "To",

  // What the totals count. Both on by default.
  includeArchived: "Count archived ponds",
  includeArchivedHint: "Money from retired ponds is still money you spent and earned.",
  includeArchivedWorth: "{{amount}} of the figures above.",
  // The entry list is farm-level and has no pond on it, so it cannot mark
  // archived rows at all. Say that, rather than let its silence be read as
  // "there is no archived money here".
  entriesArchivedNote: "Archived ponds are counted in the totals above. Entries are recorded against the farm, not a pond, so they are not marked here — use the pond list to see a retired pond's own money.",
  includeInventory: "Count inventory purchases",
  includeInventoryHint: "Stock you buy counts as an expense on the day you buy it.",
  includeInventoryOff: "Stock purchases are left out of the figures above.",
  includeInventoryWorth: "{{amount}} of the expenses above.",
  archivedTag: "Archived",

  // Pond and cycle filter
  byPond: "By pond",
  wholeFarm: "Whole farm",
  allCycles: "All cycles",
  pondCostTotal: "Costs for this pond",
  cycleCostTotal: "Costs for this cycle",
  noPondCosts: "Nothing recorded against this pond in this period.",
};
export default finance;
