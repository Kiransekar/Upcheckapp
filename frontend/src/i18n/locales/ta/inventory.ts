const inventory = {
  // ── InventoryListScreen ─────────────────────────────────────────────────────
  title: 'சரக்கு பட்டியல்',
  errorTitle: 'சரக்கு பட்டியலை ஏற்ற முடியவில்லை',

  // Category filter tabs — the same five the backend validates
  catAll: 'அனைத்தும்',
  catFeed: 'தீவனம்',
  catChemicals: 'இரசாயனங்கள்',
  catEquipment: 'உபகரணங்கள்',
  catMedicine: 'மருந்து',
  catOther: 'மற்றவை',

  // Stock status badges
  outOfStock: 'இருப்பு இல்லை',
  lowStock: 'குறைந்த இருப்பு',
  inStock: 'இருப்பு உள்ளது',

  // Item footer
  minLabel: 'குறைந்தபட்சம்:',
  lowStockCount: '{{count}} பொருட்களின் இருப்பு குறைவு',
  farmFallback: 'பண்ணை',

  // Empty state
  emptyTitle: 'சரக்கு பட்டியல் உருப்படிகள் இல்லை',
  emptySubtitle: 'உங்கள் தீவனம், இரசாயனங்கள் மற்றும் உபகரண இருப்பை கண்காணிக்கத் தொடங்குங்கள்.',

  // ── InventoryFormScreen (create AND edit) ───────────────────────────────────
  addItem: 'உருப்படி சேர்',
  editItem: 'உருப்படியை திருத்து',
  fieldName: 'உருப்படியின் பெயர்',
  namePlaceholder: 'உதா. ஸ்டார்ட்டர் தீவனம்',
  fieldCategory: 'வகை',
  fieldIcon: 'சின்னம்',
  fieldQuantity: 'அளவு',
  fieldUnit: 'அலகு',
  unitPlaceholder: 'அலகைத் தேர்ந்தெடு',
  fieldReorderLevel: 'மறு ஆர்டர் அளவு',
  reorderHint: 'இருப்பு இந்த அளவுக்கு வரும்போது என்னை எச்சரிக்கவும்',
  fieldUnitPrice: 'ஓர் அலகு விலை (₹)',
  fieldSupplier: 'சப்ளையர்',
  supplierPlaceholder: 'விருப்பத்தேர்வு',
  notesPlaceholder: 'இந்த உருப்படி பற்றி நினைவில் வைக்க வேண்டியது',
  addExpiry: 'காலாவதி தேதியைச் சேர்',
  clearExpiry: 'காலாவதி தேதியை நீக்கு',
  nameRequired: 'உருப்படியின் பெயர் தேவை.',
  noFarmSelected: 'சரக்கு சேர்ப்பதற்கு முன் ஒரு பண்ணையைத் தேர்ந்தெடுக்கவும்.',
  negativeNotAllowed: '{{field}} எதிர்மறையாக இருக்க முடியாது.',
  saveFailed: 'உருப்படியை சேமிக்க முடியவில்லை.',
  noPermission: 'இந்தப் பண்ணையின் சரக்கை மாற்ற உங்களுக்கு அனுமதி இல்லை.',
  pairedFarms: "எந்தப் பண்ணைக்கு",
  unpairedTitle: "எந்தப் பண்ணையுடனும் இணைக்கப்படவில்லை",
  unpairedWarning: "நீங்கள் இணைக்கும் வரை இது எந்தப் பண்ணையின் பட்டியலிலும் தோன்றாது. பரிந்துரைக்கப்படவில்லை.",

  // Icon picker
  pickIcon: 'ஒரு சின்னத்தைத் தேர்ந்தெடு',
  searchIcons: 'சின்னங்களைத் தேடு',
  noIconsMatch: 'இந்தத் தேடலுக்கு சின்னம் எதுவும் பொருந்தவில்லை.',
  iconFromCategory: 'வகையிலிருந்து',
  clearIcon: 'சின்னத்தை நீக்கு',
  iconGroupFeed: 'தீவனம்',
  iconGroupChemicals: 'இரசாயனங்கள்',
  iconGroupMedicine: 'மருந்து',
  iconGroupEquipment: 'உபகரணங்கள்',
  iconGroupTools: 'கருவிகள்',
  iconGroupPackaging: 'பொதி',
  iconGroupSafety: 'பாதுகாப்பு',
  iconGroupMisc: 'மற்றவை',

  // ── InventoryDetailScreen ───────────────────────────────────────────────────
  // Header fallback
  inventoryItemFallback: 'சரக்கு உருப்படி',

  // Error state
  itemNotFound: 'உருப்படி கிடைக்கவில்லை',
  loadItemError: 'சரக்கு உருப்படியை ஏற்ற முடியவில்லை',

  // Stock card
  currentStock: 'தற்போதைய இருப்பு',
  minimumThreshold: 'குறைந்தபட்ச வரம்பு: {{count}} {{unit}}',

  // Info card labels
  labelCategory: 'வகை',
  labelUnit: 'அலகு',
  labelExpiryDate: 'காலாவதி தேதி',
  labelLastAdjustment: 'கடைசி சரிசெய்வு',
  labelNotes: 'குறிப்புகள்',

  // Adjust stock
  adjustStock: 'இருப்பை சரிசெய்',
  adjustStockChoose: 'ஒரு செயலை தேர்ந்தெடு',
  addStock: 'இருப்பு சேர்',
  reduceStock: 'இருப்பு குறை',
  reasonPlaceholder: 'காரணம் (விருப்பத்தேர்வு)',
  validAmountRequired: '0 ஐ விட அதிகமான சரியான அளவை உள்ளிடவும்.',
  adjustFailed: 'இருப்பை சரிசெய்ய முடியவில்லை.',

  // Delete
  deleteItem: 'உருப்படியை நீக்கு',
  deleteConfirm: '"{{name}}" நீக்கவா? இதை மீட்க முடியாது.',
  deleteFailed: 'உருப்படியை நீக்க முடியவில்லை.',

  // ── Feed log → stock link ───────────────────────────────────────────────────
  feedFromStock: 'இருப்பிலிருந்து எடு',
  remainingStock: '{{quantity}} {{unit}} மீதம்',
  selectStockPlaceholder: 'இருப்பிலிருந்து கழிக்க வேண்டாம்',

  // ── ShopScreen ──────────────────────────────────────────────────────────────
  shopTitle: 'கடை',
  shopErrorTitle: 'பொருட்களை ஏற்ற முடியவில்லை',

  // Category chip — dynamic key derived from API, static "All"
  catAllShop: 'அனைத்தும்',

  // Stock badges
  shopOutOfStock: 'இருப்பு இல்லை',
  shopUnavailable: 'கிடைக்கவில்லை',
  shopStockCount: 'இருப்பு: {{count}}',

  // Empty state
  shopEmptyTitle: 'பொருட்கள் இல்லை',
  shopEmptySubtitle: 'இப்போது இந்த வகையில் பொருட்கள் எதுவும் கிடைக்கவில்லை.',

  // ── FeedProductsScreen ──────────────────────────────────────────────────────
  feedProductsTitle: 'தீவன பொருட்கள்',
  feedErrorTitle: 'தீவன பொருட்களை ஏற்ற முடியவில்லை',

  // Protein badge
  proteinLabel: 'புரதம்',

  // Empty state
  feedEmptyTitle: 'தீவன பொருட்கள் இல்லை',
  feedEmptySubtitle: 'தீவன பொருள் பதிவுகள் இன்னும் கிடைக்கவில்லை.',
};
export default inventory;
