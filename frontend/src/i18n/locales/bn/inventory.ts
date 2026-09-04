const inventory = {
  // ── InventoryListScreen ─────────────────────────────────────────────────────
  title: 'ইনভেন্টরি',
  errorTitle: 'ইনভেন্টরি লোড করা যায়নি',

  // Category filter tabs — the same five the backend validates
  catAll: 'সব',
  catFeed: 'খাদ্য',
  catChemicals: 'রাসায়নিক',
  catEquipment: 'সরঞ্জাম',
  catMedicine: 'ওষুধ',
  catOther: 'অন্যান্য',

  // Stock status badges
  outOfStock: 'স্টক শেষ',
  lowStock: 'কম স্টক',
  inStock: 'স্টক আছে',

  // Item footer
  minLabel: 'সর্বনিম্ন:',
  lowStockCount: '{{count}}টি আইটেমের স্টক কম',
  farmFallback: 'খামার',

  // Empty state
  emptyTitle: 'কোনো ইনভেন্টরি আইটেম নেই',
  emptySubtitle: 'আপনার খাদ্য, রাসায়নিক ও সরঞ্জামের স্টক ট্র্যাক শুরু করুন।',

  // ── InventoryFormScreen (create AND edit) ───────────────────────────────────
  addItem: 'আইটেম যোগ করুন',
  editItem: 'আইটেম সম্পাদনা করুন',
  fieldName: 'আইটেমের নাম',
  namePlaceholder: 'যেমন স্টার্টার ফিড',
  fieldCategory: 'বিভাগ',
  fieldIcon: 'আইকন',
  fieldQuantity: 'পরিমাণ',
  fieldUnit: 'একক',
  unitPlaceholder: 'একক বেছে নিন',
  fieldReorderLevel: 'পুনরায় অর্ডারের মাত্রা',
  reorderHint: 'স্টক এই মাত্রায় নামলে আমাকে সতর্ক করুন',
  fieldUnitPrice: 'একক মূল্য (₹)',
  fieldSupplier: 'সরবরাহকারী',
  supplierPlaceholder: 'ঐচ্ছিক',
  notesPlaceholder: 'এই আইটেম সম্পর্কে মনে রাখার মতো কিছু',
  addExpiry: 'মেয়াদ শেষের তারিখ যোগ করুন',
  clearExpiry: 'মেয়াদ শেষের তারিখ সরান',
  nameRequired: 'আইটেমের নাম আবশ্যক।',
  noFarmSelected: 'ইনভেন্টরি যোগ করার আগে একটি খামার বেছে নিন।',
  negativeNotAllowed: '{{field}} ঋণাত্মক হতে পারে না।',
  saveFailed: 'আইটেম সংরক্ষণ করা যায়নি।',
  noPermission: 'এই খামারের ইনভেন্টরি বদলানোর অনুমতি আপনার নেই।',

  // Icon picker
  pickIcon: 'একটি আইকন বেছে নিন',
  searchIcons: 'আইকন খুঁজুন',
  noIconsMatch: 'এই খোঁজের সঙ্গে কোনো আইকন মেলেনি।',
  iconFromCategory: 'বিভাগ অনুযায়ী',
  clearIcon: 'আইকন সরান',
  iconGroupFeed: 'খাদ্য',
  iconGroupChemicals: 'রাসায়নিক',
  iconGroupMedicine: 'ওষুধ',
  iconGroupEquipment: 'সরঞ্জাম',
  iconGroupTools: 'যন্ত্রপাতি',
  iconGroupPackaging: 'প্যাকিং',
  iconGroupSafety: 'নিরাপত্তা',
  iconGroupMisc: 'অন্যান্য',

  // ── InventoryDetailScreen ───────────────────────────────────────────────────
  // Header fallback
  inventoryItemFallback: 'ইনভেন্টরি আইটেম',

  // Error state
  itemNotFound: 'আইটেম পাওয়া যায়নি',
  loadItemError: 'ইনভেন্টরি আইটেম লোড করতে ব্যর্থ',

  // Stock card
  currentStock: 'বর্তমান স্টক',
  minimumThreshold: 'সর্বনিম্ন সীমা: {{count}} {{unit}}',

  // Info card labels
  labelCategory: 'বিভাগ',
  labelUnit: 'একক',
  labelExpiryDate: 'মেয়াদ শেষ',
  labelLastAdjustment: 'সর্বশেষ সমন্বয়',
  labelNotes: 'নোট',

  // Adjust stock
  adjustStock: 'স্টক সামঞ্জস্য করুন',
  adjustStockChoose: 'একটি ক্রিয়া বেছে নিন',
  addStock: 'স্টক যোগ করুন',
  reduceStock: 'স্টক কমান',
  reasonPlaceholder: 'কারণ (ঐচ্ছিক)',
  validAmountRequired: '০-এর বেশি একটি বৈধ পরিমাণ দিন।',
  adjustFailed: 'স্টক সামঞ্জস্য করা যায়নি।',

  // Delete
  deleteItem: 'আইটেম মুছুন',
  deleteConfirm: '"{{name}}" মুছবেন? এটি ফেরানো যাবে না।',
  deleteFailed: 'আইটেম মোছা যায়নি।',

  // ── Feed log → stock link ───────────────────────────────────────────────────
  feedFromStock: 'স্টক থেকে নিন',
  remainingStock: '{{quantity}} {{unit}} বাকি',
  selectStockPlaceholder: 'স্টক থেকে বাদ দেবেন না',

  // ── ShopScreen ──────────────────────────────────────────────────────────────
  shopTitle: 'শপ',
  shopErrorTitle: 'পণ্য লোড করা যায়নি',

  // Category chip — dynamic key derived from API, static "All"
  catAllShop: 'সব',

  // Stock badges
  shopOutOfStock: 'স্টক শেষ',
  shopUnavailable: 'অনুপলব্ধ',
  shopStockCount: 'স্টক: {{count}}',

  // Empty state
  shopEmptyTitle: 'কোনো পণ্য নেই',
  shopEmptySubtitle: 'এই বিভাগে এখন কোনো পণ্য পাওয়া যাচ্ছে না।',

  // ── FeedProductsScreen ──────────────────────────────────────────────────────
  feedProductsTitle: 'খাদ্য পণ্য',
  feedErrorTitle: 'খাদ্য পণ্য লোড করা যায়নি',

  // Protein badge
  proteinLabel: 'প্রোটিন',

  // Empty state
  feedEmptyTitle: 'কোনো খাদ্য পণ্য নেই',
  feedEmptySubtitle: 'এখনও কোনো খাদ্য পণ্যের রেকর্ড পাওয়া যায়নি।',
};
export default inventory;
