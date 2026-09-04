const inventory = {
  // ── InventoryListScreen ─────────────────────────────────────────────────────
  title: 'ଇନ୍‌ଭେଣ୍ଟୋରି',
  errorTitle: 'ଇନ୍‌ଭେଣ୍ଟୋରି ଲୋଡ ହୋଇ ପାରିଲା ନାହିଁ',

  // Category filter tabs — the same five the backend validates
  catAll: 'ସବୁ',
  catFeed: 'ଖାଦ୍ୟ',
  catChemicals: 'ରାସାୟନିକ',
  catEquipment: 'ଯନ୍ତ୍ରପାତି',
  catMedicine: 'ଔଷଧ',
  catOther: 'ଅନ୍ୟ',

  // Stock status badges
  outOfStock: 'ଷ୍ଟକ ଶେଷ',
  lowStock: 'ସ୍ୱଳ୍ପ ଷ୍ଟକ',
  inStock: 'ଷ୍ଟକ ଉପଲବ୍ଧ',

  // Item footer
  minLabel: 'ସର୍ବନିମ୍ନ:',
  lowStockCount: '{{count}}ଟି ଆଇଟମର ଷ୍ଟକ କମ',
  farmFallback: 'ଫାର୍ମ',

  // Empty state
  emptyTitle: 'ଇନ୍‌ଭେଣ୍ଟୋରି ଆଇଟମ ନାହିଁ',
  emptySubtitle: 'ଆପଣଙ୍କ ଖାଦ୍ୟ, ରାସାୟନିକ ଓ ଯନ୍ତ୍ରପାତି ଷ୍ଟକ ଟ୍ରାକ ଆରମ୍ଭ କରନ୍ତୁ।',

  // ── InventoryFormScreen (create AND edit) ───────────────────────────────────
  addItem: 'ଆଇଟମ ଯୋଡ଼ନ୍ତୁ',
  editItem: 'ଆଇଟମ ସଂପାଦନ କରନ୍ତୁ',
  fieldName: 'ଆଇଟମର ନାମ',
  namePlaceholder: 'ଯେପରି ଷ୍ଟାର୍ଟର ଖାଦ୍ୟ',
  fieldCategory: 'ବର୍ଗ',
  fieldIcon: 'ଚିହ୍ନ',
  fieldQuantity: 'ପରିମାଣ',
  fieldUnit: 'ୟୁନିଟ',
  unitPlaceholder: 'ୟୁନିଟ ବାଛନ୍ତୁ',
  fieldReorderLevel: 'ପୁନଃ ଅର୍ଡର ସ୍ତର',
  reorderHint: 'ଷ୍ଟକ ଏହି ସ୍ତରକୁ ଆସିଲେ ମୋତେ ସତର୍କ କରନ୍ତୁ',
  fieldUnitPrice: 'ୟୁନିଟ ମୂଲ୍ୟ (₹)',
  fieldSupplier: 'ଯୋଗାଣକାରୀ',
  supplierPlaceholder: 'ଐଚ୍ଛିକ',
  notesPlaceholder: 'ଏହି ଆଇଟମ ବିଷୟରେ ମନେ ରଖିବା ଯୋଗ୍ୟ କିଛି',
  addExpiry: 'ମିଆଦ ଶେଷ ତାରିଖ ଯୋଡ଼ନ୍ତୁ',
  clearExpiry: 'ମିଆଦ ଶେଷ ତାରିଖ ହଟାନ୍ତୁ',
  nameRequired: 'ଆଇଟମର ନାମ ଆବଶ୍ୟକ।',
  noFarmSelected: 'ଇନ୍‌ଭେଣ୍ଟୋରି ଯୋଡ଼ିବା ପୂର୍ବରୁ ଏକ ଫାର୍ମ ବାଛନ୍ତୁ।',
  negativeNotAllowed: '{{field}} ଋଣାତ୍ମକ ହୋଇପାରିବ ନାହିଁ।',
  saveFailed: 'ଆଇଟମ ସେଭ କରିବା ବିଫଳ।',
  noPermission: 'ଏହି ଫାର୍ମର ଇନ୍‌ଭେଣ୍ଟୋରି ବଦଳାଇବାର ଅନୁମତି ଆପଣଙ୍କର ନାହିଁ।',

  // Icon picker
  pickIcon: 'ଏକ ଚିହ୍ନ ବାଛନ୍ତୁ',
  searchIcons: 'ଚିହ୍ନ ଖୋଜନ୍ତୁ',
  noIconsMatch: 'ଏହି ଖୋଜ ସହ କୌଣସି ଚିହ୍ନ ମେଳ ଖାଏ ନାହିଁ।',
  iconFromCategory: 'ବର୍ଗ ଅନୁଯାୟୀ',
  clearIcon: 'ଚିହ୍ନ ହଟାନ୍ତୁ',
  iconGroupFeed: 'ଖାଦ୍ୟ',
  iconGroupChemicals: 'ରାସାୟନିକ',
  iconGroupMedicine: 'ଔଷଧ',
  iconGroupEquipment: 'ଯନ୍ତ୍ରପାତି',
  iconGroupTools: 'ଉପକରଣ',
  iconGroupPackaging: 'ପ୍ୟାକିଂ',
  iconGroupSafety: 'ସୁରକ୍ଷା',
  iconGroupMisc: 'ଅନ୍ୟ',

  // ── InventoryDetailScreen ───────────────────────────────────────────────────
  // Header fallback
  inventoryItemFallback: 'ଇନ୍‌ଭେଣ୍ଟୋରି ଆଇଟମ',

  // Error state
  itemNotFound: 'ଆଇଟମ ମିଳିଲା ନାହିଁ',
  loadItemError: 'ଇନ୍‌ଭେଣ୍ଟୋରି ଆଇଟମ ଲୋଡ ବିଫଳ',

  // Stock card
  currentStock: 'ବର୍ତ୍ତମାନ ଷ୍ଟକ',
  minimumThreshold: 'ସର୍ବନିମ୍ନ ସୀମା: {{count}} {{unit}}',

  // Info card labels
  labelCategory: 'ବର୍ଗ',
  labelUnit: 'ୟୁନିଟ',
  labelExpiryDate: 'ମିଆଦ ଶେଷ ତାରିଖ',
  labelLastAdjustment: 'ଶେଷ ସଂଶୋଧନ',
  labelNotes: 'ଟୀକା',

  // Adjust stock
  adjustStock: 'ଷ୍ଟକ ସଂଶୋଧନ',
  adjustStockChoose: 'ଏକ ବିକଳ୍ପ ବାଛନ୍ତୁ',
  addStock: 'ଷ୍ଟକ ଯୋଡ଼ନ୍ତୁ',
  reduceStock: 'ଷ୍ଟକ କମ',
  reasonPlaceholder: 'କାରଣ (ଐଚ୍ଛିକ)',
  validAmountRequired: '0 ଠାରୁ ଅଧିକ ଏକ ବୈଧ ପରିମାଣ ଦିଅନ୍ତୁ।',
  adjustFailed: 'ଷ୍ଟକ ସଂଶୋଧନ ବିଫଳ।',

  // Delete
  deleteItem: 'ଆଇଟମ ଡିଲିଟ କରନ୍ତୁ',
  deleteConfirm: '"{{name}}" ଡିଲିଟ କରିବେ? ଏହା ଫେରାଇ ହେବ ନାହିଁ।',
  deleteFailed: 'ଆଇଟମ ଡିଲିଟ ବିଫଳ।',

  // ── Feed log → stock link ───────────────────────────────────────────────────
  feedFromStock: 'ଷ୍ଟକରୁ ନିଅନ୍ତୁ',
  remainingStock: '{{quantity}} {{unit}} ବଳକା',
  selectStockPlaceholder: 'ଷ୍ଟକରୁ କାଟନ୍ତୁ ନାହିଁ',

  // ── ShopScreen ──────────────────────────────────────────────────────────────
  shopTitle: 'ଦୋକାନ',
  shopErrorTitle: 'ଉତ୍ପାଦ ଲୋଡ ହୋଇ ପାରିଲା ନାହିଁ',

  // Category chip — dynamic key derived from API, static "All"
  catAllShop: 'ସବୁ',

  // Stock badges
  shopOutOfStock: 'ଷ୍ଟକ ଶେଷ',
  shopUnavailable: 'ଉପଲବ୍ଧ ନାହିଁ',
  shopStockCount: 'ଷ୍ଟକ: {{count}}',

  // Empty state
  shopEmptyTitle: 'ଉତ୍ପାଦ ନାହିଁ',
  shopEmptySubtitle: 'ଏହି ବର୍ଗରେ ଏବେ କୌଣସି ଉତ୍ପାଦ ଉପଲବ୍ଧ ନାହିଁ।',

  // ── FeedProductsScreen ──────────────────────────────────────────────────────
  feedProductsTitle: 'ଖାଦ୍ୟ ଉତ୍ପାଦ',
  feedErrorTitle: 'ଖାଦ୍ୟ ଉତ୍ପାଦ ଲୋଡ ହୋଇ ପାରିଲା ନାହିଁ',

  // Protein badge
  proteinLabel: 'ପ୍ରୋଟିନ',

  // Empty state
  feedEmptyTitle: 'ଖାଦ୍ୟ ଉତ୍ପାଦ ନାହିଁ',
  feedEmptySubtitle: 'ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ଖାଦ୍ୟ ଉତ୍ପାଦ ରେକର୍ଡ ଉପଲବ୍ଧ ନାହିଁ।',
};
export default inventory;
