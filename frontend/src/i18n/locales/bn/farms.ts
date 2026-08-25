const farms = {
  // FarmsListScreen
  title: 'আমার খামার',
  ponds: 'পুকুর',
  errorTitle: 'খামার লোড করা যায়নি',
  emptyTitle: 'এখনও কোনো খামার নেই',
  emptySubtitleEither: 'আপনার প্রথম খামার তৈরি করুন, বা অন্যের কোড দিয়ে তাঁদের খামারে যোগ দিন।',
  emptySubtitle: 'পুকুর ও চক্র পরিচালনা শুরু করতে আপনার প্রথম খামার তৈরি করুন।',
  addFarm: 'খামার যোগ করুন',
  workerNoFarmSubtitle: 'আপনাকে দলের সদস্য হিসেবে যোগ করতে খামারের মালিককে বলুন।',

  // FarmDetailScreen
  noPondsTitle: 'কোনো পুকুর পাওয়া যায়নি',
  noPondsSubtitle: 'চক্র ট্র্যাকিং শুরু করতে এই খামারে পুকুর যোগ করুন।',
  addPond: 'পুকুর যোগ করুন',
  activeCycle: 'সক্রিয় চক্র',
  noActiveCycle: 'কোনো সক্রিয় চক্র নেই',
  errorPondsTitle: 'পুকুর লোড করা যায়নি',

  // CreateFarmScreen
  fieldFarmName: 'খামারের নাম',
  placeholderFarmName: 'যেমন: উত্তর সাইট',
  fieldAddress: 'ঠিকানা',
  placeholderAddress: 'ঠিকানা বা অঞ্চল',
  fieldArea: 'এলাকা (হেক্টর, ঐচ্ছিক)',
  errorFarmRequired: 'খামারের নাম আবশ্যক',
  errorCreateFarm: 'খামার তৈরিতে ব্যর্থ',
  saveFarm: 'খামার সংরক্ষণ করুন',
  fieldLocation: 'খামারের অবস্থান',
  detectLocation: 'আমার অবস্থান শনাক্ত করুন',
  locating: 'অবস্থান পাওয়া হচ্ছে…',
  locationCaptured: 'অবস্থান সেট · {{lat}}, {{lng}}',
  locationDeniedTitle: 'অবস্থান অনুমতি প্রয়োজন',
  locationDeniedMsg: 'আবহাওয়া ও জোয়ার ফিচারের জন্য আপনার খামারের অবস্থান সেট করতে অনুমতি দিন।',
  locationError: 'আপনার অবস্থান পাওয়া যায়নি। আবার চেষ্টা করুন।',
  fieldWaterSource: 'জলের উৎস',
  water_tidal: 'জোয়ার',
  water_river: 'নদী',
  water_borehole: 'নলকূপ',
  water_reservoir: 'জলাধার',
  water_recycled: 'পুনর্ব্যবহৃত',

  // FarmSetupScreen
  setupTitle: 'আপনার খামার সেট করুন',
  createFarmTitle: 'খামার তৈরি করুন',
  setupLater: 'পরে সেট করুন',
  setupSubtitle: 'শুরু করতে আপনার খামার সম্পর্কে কিছু বলুন।',
  fieldPondCount: 'পুকুরের সংখ্যা',
  placeholderPondCount: 'যেমন: 4',
  errorPondCountRequired: 'একটি সঠিক পুকুরের সংখ্যা লিখুন',
};
export default farms;
