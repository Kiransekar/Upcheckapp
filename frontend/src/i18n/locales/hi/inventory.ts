const inventory = {
  // ── InventoryListScreen ─────────────────────────────────────────────────────
  title: 'इन्वेंटरी',
  errorTitle: 'इन्वेंटरी लोड नहीं हो सकी',

  // Category filter tabs — the same five the backend validates
  catAll: 'सभी',
  catFeed: 'आहार',
  catChemicals: 'रसायन',
  catEquipment: 'उपकरण',
  catMedicine: 'दवा',
  catOther: 'अन्य',

  // Stock status badges
  outOfStock: 'स्टॉक समाप्त',
  lowStock: 'कम स्टॉक',
  inStock: 'स्टॉक में है',

  // Item footer
  minLabel: 'न्यूनतम:',
  lowStockCount: '{{count}} वस्तुओं का स्टॉक कम है',
  farmFallback: 'फार्म',

  // Empty state
  emptyTitle: 'कोई इन्वेंटरी आइटम नहीं',
  emptySubtitle: 'अपने आहार, रसायन और उपकरण स्टॉक ट्रैक करना शुरू करें।',

  // ── InventoryFormScreen (create AND edit) ───────────────────────────────────
  addItem: 'आइटम जोड़ें',
  editItem: 'आइटम संपादित करें',
  fieldName: 'आइटम का नाम',
  namePlaceholder: 'जैसे स्टार्टर फ़ीड',
  fieldCategory: 'श्रेणी',
  fieldIcon: 'चिह्न',
  fieldQuantity: 'मात्रा',
  fieldUnit: 'इकाई',
  unitPlaceholder: 'इकाई चुनें',
  fieldReorderLevel: 'पुनःऑर्डर स्तर',
  reorderHint: 'स्टॉक इस स्तर तक आने पर मुझे चेतावनी दें',
  fieldUnitPrice: 'प्रति इकाई मूल्य (₹)',
  fieldSupplier: 'आपूर्तिकर्ता',
  supplierPlaceholder: 'वैकल्पिक',
  notesPlaceholder: 'इस आइटम के बारे में याद रखने योग्य बात',
  addExpiry: 'समाप्ति तिथि जोड़ें',
  clearExpiry: 'समाप्ति तिथि हटाएं',
  nameRequired: 'आइटम का नाम आवश्यक है।',
  noFarmSelected: 'इन्वेंटरी जोड़ने से पहले एक फार्म चुनें।',
  negativeNotAllowed: '{{field}} ऋणात्मक नहीं हो सकता।',
  saveFailed: 'आइटम सहेजने में विफल।',
  noPermission: 'इस फार्म की इन्वेंटरी बदलने की अनुमति आपके पास नहीं है।',
  pairedFarms: "किन खेतों के लिए",
  unpairedTitle: "किसी खेत से नहीं जुड़ा",
  unpairedWarning: "जब तक आप इसे किसी खेत से नहीं जोड़ेंगे, यह किसी भी खेत की सूची में नहीं दिखेगा। सुझाव नहीं दिया जाता।",

  // Icon picker
  pickIcon: 'एक चिह्न चुनें',
  searchIcons: 'चिह्न खोजें',
  noIconsMatch: 'इस खोज से कोई चिह्न मेल नहीं खाता।',
  iconFromCategory: 'श्रेणी के अनुसार',
  clearIcon: 'चिह्न हटाएं',
  iconGroupFeed: 'आहार',
  iconGroupChemicals: 'रसायन',
  iconGroupMedicine: 'दवा',
  iconGroupEquipment: 'उपकरण',
  iconGroupTools: 'औज़ार',
  iconGroupPackaging: 'पैकिंग',
  iconGroupSafety: 'सुरक्षा',
  iconGroupMisc: 'अन्य',

  // ── InventoryDetailScreen ───────────────────────────────────────────────────
  // Header fallback
  inventoryItemFallback: 'इन्वेंटरी आइटम',

  // Error state
  itemNotFound: 'आइटम नहीं मिला',
  loadItemError: 'इन्वेंटरी आइटम लोड करने में विफल',

  // Stock card
  currentStock: 'वर्तमान स्टॉक',
  minimumThreshold: 'न्यूनतम सीमा: {{count}} {{unit}}',

  // Info card labels
  labelCategory: 'श्रेणी',
  labelUnit: 'इकाई',
  labelExpiryDate: 'समाप्ति तिथि',
  labelLastAdjustment: 'अंतिम समायोजन',
  labelNotes: 'नोट्स',
  movementHistory: 'स्टॉक इतिहास',
  movementNoReason: 'कोई कारण नहीं दिया गया',

  // Adjust stock
  adjustStock: 'स्टॉक समायोजित करें',
  adjustStockChoose: 'एक क्रिया चुनें',
  addStock: 'स्टॉक जोड़ें',
  reduceStock: 'स्टॉक घटाएं',
  reasonPlaceholder: 'कारण (वैकल्पिक)',
  validAmountRequired: '0 से अधिक वैध मात्रा दर्ज करें।',
  adjustFailed: 'स्टॉक समायोजित करने में विफल।',

  // ── खरीद (स्टॉक आया → एक जुड़ा हुआ खर्च) ────────────────────────────────────
  purchaseCostHint: 'यदि यह स्टॉक पहले से आपका है तो खाली छोड़ें। भरने पर खर्च अपने आप दर्ज हो जाएगा।',
  fieldTotalCost: 'कुल लागत',
  billToFarm: 'किस फ़ार्म ने भुगतान किया?',
  billToFarmRequired: 'चुनें कि इस स्टॉक का भुगतान किस फ़ार्म ने किया।',
  purchaseRecorded: '{{quantity}} {{unit}} जोड़ा गया और {{farm}} के लिए {{amount}} का खर्च दर्ज किया गया।',
  purchaseSection: 'खरीद',
  movementToPond: '{{pond}} के लिए',

  // Delete
  deleteItem: 'आइटम हटाएं',
  deleteConfirm: '"{{name}}" हटाएं? यह वापस नहीं किया जा सकता।',
  deleteFailed: 'आइटम हटाने में विफल।',

  // ── Feed log → stock link ───────────────────────────────────────────────────
  feedFromStock: 'स्टॉक से लें',
  remainingStock: '{{quantity}} {{unit}} शेष',
  selectStockPlaceholder: 'स्टॉक से न घटाएं',

  // ── ShopScreen ──────────────────────────────────────────────────────────────
  shopTitle: 'दुकान',
  shopErrorTitle: 'उत्पाद लोड नहीं हो सके',

  // Category chip — dynamic key derived from API, static "All"
  catAllShop: 'सभी',

  // Stock badges
  shopOutOfStock: 'स्टॉक समाप्त',
  shopUnavailable: 'अनुपलब्ध',
  shopStockCount: 'स्टॉक: {{count}}',

  // Empty state
  shopEmptyTitle: 'कोई उत्पाद नहीं',
  shopEmptySubtitle: 'इस श्रेणी में अभी कोई उत्पाद उपलब्ध नहीं है।',

  // ── FeedProductsScreen ──────────────────────────────────────────────────────
  feedProductsTitle: 'आहार उत्पाद',
  feedErrorTitle: 'आहार उत्पाद लोड नहीं हो सके',

  // Protein badge
  proteinLabel: 'प्रोटीन',

  // Empty state
  feedEmptyTitle: 'कोई आहार उत्पाद नहीं',
  feedEmptySubtitle: 'अभी कोई आहार उत्पाद रिकॉर्ड उपलब्ध नहीं है।',
};
export default inventory;
