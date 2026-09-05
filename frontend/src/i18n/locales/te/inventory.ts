const inventory = {
  // ── InventoryListScreen ─────────────────────────────────────────────────────
  title: 'ఇన్వెంటరీ',
  errorTitle: 'ఇన్వెంటరీ లోడ్ కాలేదు',

  // Category filter tabs — the same five the backend validates
  catAll: 'అన్నీ',
  catFeed: 'దాణా',
  catChemicals: 'రసాయనాలు',
  catEquipment: 'పరికరాలు',
  catMedicine: 'మందు',
  catOther: 'ఇతర',

  // Stock status badges
  outOfStock: 'స్టాక్ అయిపోయింది',
  lowStock: 'తక్కువ స్టాక్',
  inStock: 'స్టాక్ ఉంది',

  // Item footer
  minLabel: 'కనీసం:',
  lowStockCount: '{{count}} వస్తువుల స్టాక్ తక్కువగా ఉంది',
  farmFallback: 'ఫారం',

  // Empty state
  emptyTitle: 'ఇన్వెంటరీ అంశాలు లేవు',
  emptySubtitle: 'మీ దాణా, రసాయనాలు మరియు పరికరాల స్టాక్ ట్రాక్ చేయడం ప్రారంభించండి.',

  // ── InventoryFormScreen (create AND edit) ───────────────────────────────────
  addItem: 'అంశం జోడించు',
  editItem: 'అంశాన్ని సవరించు',
  fieldName: 'అంశం పేరు',
  namePlaceholder: 'ఉదా. స్టార్టర్ దాణా',
  fieldCategory: 'వర్గం',
  fieldIcon: 'చిహ్నం',
  fieldQuantity: 'పరిమాణం',
  fieldUnit: 'యూనిట్',
  unitPlaceholder: 'యూనిట్ ఎంచుకోండి',
  fieldReorderLevel: 'రీఆర్డర్ స్థాయి',
  reorderHint: 'స్టాక్ ఈ స్థాయికి తగ్గినప్పుడు నన్ను హెచ్చరించండి',
  fieldUnitPrice: 'యూనిట్ ధర (₹)',
  fieldSupplier: 'సరఫరాదారు',
  supplierPlaceholder: 'ఐచ్ఛికం',
  notesPlaceholder: 'ఈ అంశం గురించి గుర్తుంచుకోవలసినది',
  addExpiry: 'గడువు తేదీ జోడించు',
  clearExpiry: 'గడువు తేదీ తొలగించు',
  nameRequired: 'అంశం పేరు తప్పనిసరి.',
  noFarmSelected: 'ఇన్వెంటరీ జోడించే ముందు ఒక ఫారం ఎంచుకోండి.',
  negativeNotAllowed: '{{field}} రుణాత్మకంగా ఉండకూడదు.',
  saveFailed: 'అంశాన్ని సేవ్ చేయడం విఫలమైంది.',
  noPermission: 'ఈ ఫారం ఇన్వెంటరీని మార్చే అనుమతి మీకు లేదు.',
  pairedFarms: "ఏ వ్యవసాయ క్షేత్రానికి",
  unpairedTitle: "ఏ క్షేత్రంతోనూ జతచేయలేదు",
  unpairedWarning: "మీరు జతచేసే వరకు ఇది ఏ క్షేత్రం జాబితాలోనూ కనిపించదు. సిఫారసు చేయబడలేదు.",

  // Icon picker
  pickIcon: 'ఒక చిహ్నాన్ని ఎంచుకోండి',
  searchIcons: 'చిహ్నాలను వెతకండి',
  noIconsMatch: 'ఈ శోధనకు ఏ చిహ్నమూ సరిపోలలేదు.',
  iconFromCategory: 'వర్గం నుండి',
  clearIcon: 'చిహ్నాన్ని తొలగించు',
  iconGroupFeed: 'దాణా',
  iconGroupChemicals: 'రసాయనాలు',
  iconGroupMedicine: 'మందు',
  iconGroupEquipment: 'పరికరాలు',
  iconGroupTools: 'సాధనాలు',
  iconGroupPackaging: 'ప్యాకింగ్',
  iconGroupSafety: 'భద్రత',
  iconGroupMisc: 'ఇతర',

  // ── InventoryDetailScreen ───────────────────────────────────────────────────
  // Header fallback
  inventoryItemFallback: 'ఇన్వెంటరీ అంశం',

  // Error state
  itemNotFound: 'అంశం కనుగొనబడలేదు',
  loadItemError: 'ఇన్వెంటరీ అంశం లోడ్ చేయడం విఫలమైంది',

  // Stock card
  currentStock: 'ప్రస్తుత స్టాక్',
  minimumThreshold: 'కనీస పరిమితి: {{count}} {{unit}}',

  // Info card labels
  labelCategory: 'వర్గం',
  labelUnit: 'యూనిట్',
  labelExpiryDate: 'గడువు తేదీ',
  labelLastAdjustment: 'చివరి సర్దుబాటు',
  labelNotes: 'గమనికలు',
  movementHistory: 'స్టాక్ చరిత్ర',
  movementNoReason: 'కారణం ఇవ్వలేదు',

  // Adjust stock
  adjustStock: 'స్టాక్ సర్దుబాటు చేయి',
  adjustStockChoose: 'చర్య ఎంచుకోండి',
  addStock: 'స్టాక్ జోడించు',
  reduceStock: 'స్టాక్ తగ్గించు',
  reasonPlaceholder: 'కారణం (ఐచ్ఛికం)',
  validAmountRequired: '0 కంటే ఎక్కువ చెల్లుబాటు అయ్యే పరిమాణాన్ని నమోదు చేయండి.',
  adjustFailed: 'స్టాక్ సర్దుబాటు విఫలమైంది.',

  // ── కొనుగోలు (స్టాక్ వచ్చింది → ఒక అనుసంధాన ఖర్చు) ──────────────────────
  purchaseCostHint: 'ఈ స్టాక్ ఇప్పటికే మీదైతే ఖాళీగా వదిలేయండి. నింపితే ఖర్చు దానంతట అదే నమోదవుతుంది.',
  fieldTotalCost: 'మొత్తం ఖర్చు',
  billToFarm: 'ఏ ఫారం డబ్బు చెల్లించింది?',
  billToFarmRequired: 'ఈ స్టాక్‌కు ఏ ఫారం చెల్లించిందో ఎంచుకోండి.',
  purchaseRecorded: '{{quantity}} {{unit}} జోడించబడింది; {{farm}} కోసం {{amount}} ఖర్చుగా నమోదైంది.',
  purchaseSection: 'కొనుగోళ్లు',
  movementToPond: '{{pond}} చెరువుకు',

  // Delete
  deleteItem: 'అంశాన్ని తొలగించు',
  deleteConfirm: '"{{name}}" తొలగించాలా? దీన్ని తిరిగి పొందలేరు.',
  deleteFailed: 'అంశాన్ని తొలగించడం విఫలమైంది.',

  // ── Feed log → stock link ───────────────────────────────────────────────────
  feedFromStock: 'స్టాక్ నుండి తీసుకో',
  remainingStock: '{{quantity}} {{unit}} మిగిలింది',
  selectStockPlaceholder: 'స్టాక్ నుండి తీసివేయవద్దు',

  // ── ShopScreen ──────────────────────────────────────────────────────────────
  shopTitle: 'దుకాణం',
  shopErrorTitle: 'ఉత్పత్తులు లోడ్ కాలేదు',

  // Category chip — dynamic key derived from API, static "All"
  catAllShop: 'అన్నీ',

  // Stock badges
  shopOutOfStock: 'స్టాక్ అయిపోయింది',
  shopUnavailable: 'అందుబాటులో లేదు',
  shopStockCount: 'స్టాక్: {{count}}',

  // Empty state
  shopEmptyTitle: 'ఉత్పత్తులు లేవు',
  shopEmptySubtitle: 'ఈ వర్గంలో ఇప్పుడు ఉత్పత్తులు అందుబాటులో లేవు.',

  // ── FeedProductsScreen ──────────────────────────────────────────────────────
  feedProductsTitle: 'దాణా ఉత్పత్తులు',
  feedErrorTitle: 'దాణా ఉత్పత్తులు లోడ్ కాలేదు',

  // Protein badge
  proteinLabel: 'ప్రోటీన్',

  // Empty state
  feedEmptyTitle: 'దాణా ఉత్పత్తులు లేవు',
  feedEmptySubtitle: 'ఇంకా దాణా ఉత్పత్తి రికార్డులు అందుబాటులో లేవు.',
};
export default inventory;
