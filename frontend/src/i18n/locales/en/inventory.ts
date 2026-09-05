const inventory = {
  // ── InventoryListScreen ─────────────────────────────────────────────────────
  title: 'Inventory',
  errorTitle: "Couldn't Load Inventory",

  // Category filter tabs — the same five the backend validates
  catAll: 'All',
  catFeed: 'Feed',
  catChemicals: 'Chemicals',
  catEquipment: 'Equipment',
  catMedicine: 'Medicine',
  catOther: 'Other',

  // Stock status badges
  outOfStock: 'Out of Stock',
  lowStock: 'Low Stock',
  inStock: 'In Stock',

  // Item footer
  minLabel: 'Min:',
  lowStockCount: '{{count}} items low on stock',
  farmFallback: 'Farm',

  // Empty state
  emptyTitle: 'No Inventory Items',
  emptySubtitle: 'Start tracking your feed, chemicals, and equipment stock.',

  // ── InventoryFormScreen (create AND edit) ───────────────────────────────────
  addItem: 'Add Item',
  editItem: 'Edit Item',
  fieldName: 'Item name',
  namePlaceholder: 'e.g. Starter feed',
  fieldCategory: 'Category',
  fieldIcon: 'Icon',
  fieldQuantity: 'Quantity',
  fieldUnit: 'Unit',
  unitPlaceholder: 'Choose a unit',
  fieldReorderLevel: 'Reorder level',
  reorderHint: 'Warn me when stock falls to this level',
  fieldUnitPrice: 'Unit price (₹)',
  fieldSupplier: 'Supplier',
  supplierPlaceholder: 'Optional',
  notesPlaceholder: 'Anything worth remembering about this item',
  addExpiry: 'Add expiry date',
  clearExpiry: 'Remove expiry date',
  nameRequired: 'Item name is required.',
  noFarmSelected: 'Select a farm before adding inventory.',
  negativeNotAllowed: '{{field}} cannot be negative.',
  saveFailed: 'Failed to save the item.',
  noPermission: 'You do not have permission to change inventory on this farm.',
  pairedFarms: "Stocked for",
  unpairedTitle: "Not stocked for any farm",
  unpairedWarning: "This item will not appear in any farm's inventory until you pair it. Not recommended.",

  // Icon picker
  pickIcon: 'Pick an icon',
  searchIcons: 'Search icons',
  noIconsMatch: 'No icons match that search.',
  iconFromCategory: 'From category',
  clearIcon: 'Clear icon',
  iconGroupFeed: 'Feed',
  iconGroupChemicals: 'Chemicals',
  iconGroupMedicine: 'Medicine',
  iconGroupEquipment: 'Equipment',
  iconGroupTools: 'Tools',
  iconGroupPackaging: 'Packaging',
  iconGroupSafety: 'Safety',
  iconGroupMisc: 'Other',

  // ── InventoryDetailScreen ───────────────────────────────────────────────────
  // Header fallback
  inventoryItemFallback: 'Inventory Item',

  // Error state
  itemNotFound: 'Item not found',
  loadItemError: 'Failed to load inventory item',

  // Stock card
  currentStock: 'Current Stock',
  minimumThreshold: 'Minimum threshold: {{count}} {{unit}}',

  // Info card labels
  labelCategory: 'Category',
  labelUnit: 'Unit',
  labelExpiryDate: 'Expires On',
  labelLastAdjustment: 'Last adjustment',
  labelNotes: 'Notes',
  movementHistory: 'Stock history',
  movementNoReason: 'No reason given',

  // Adjust stock
  adjustStock: 'Adjust Stock',
  adjustStockChoose: 'Choose an action',
  addStock: 'Add Stock',
  reduceStock: 'Reduce Stock',
  reasonPlaceholder: 'Optional reason',
  validAmountRequired: 'Enter a valid quantity greater than 0.',
  adjustFailed: 'Failed to adjust stock.',

  // ── Purchase (stock in → one linked expense) ────────────────────────────────
  purchaseCostHint: 'Leave blank if you already own this stock. Fill it in and an expense is recorded for you.',
  fieldTotalCost: 'Total cost',
  billToFarm: 'Paid by which farm?',
  billToFarmRequired: 'Choose which farm paid for this stock.',
  purchaseRecorded: 'Added {{quantity}} {{unit}} and recorded {{amount}} as an expense for {{farm}}.',
  purchaseSection: 'Purchases',
  movementToPond: 'to {{pond}}',

  // Delete
  deleteItem: 'Delete item',
  deleteConfirm: 'Delete "{{name}}"? This cannot be undone.',
  deleteFailed: 'Failed to delete the item.',

  // ── Feed log → stock link ───────────────────────────────────────────────────
  feedFromStock: 'Take from stock',
  remainingStock: '{{quantity}} {{unit}} left',
  selectStockPlaceholder: "Don't deduct from stock",

  // ── ShopScreen ──────────────────────────────────────────────────────────────
  shopTitle: 'Shop',
  shopErrorTitle: "Couldn't Load Products",

  // Category chip — dynamic key derived from API, static "All"
  catAllShop: 'All',

  // Stock badges
  shopOutOfStock: 'Out of Stock',
  shopUnavailable: 'Unavailable',
  shopStockCount: 'Stock: {{count}}',

  // Empty state
  shopEmptyTitle: 'No Products',
  shopEmptySubtitle: 'No products are available in this category right now.',

  // ── FeedProductsScreen ──────────────────────────────────────────────────────
  feedProductsTitle: 'Feed Products',
  feedErrorTitle: "Couldn't Load Feed Products",

  // Protein badge
  proteinLabel: 'Protein',

  // Empty state
  feedEmptyTitle: 'No Feed Products',
  feedEmptySubtitle: 'No feed product records are available yet.',
};
export default inventory;
