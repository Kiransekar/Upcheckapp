const pondSetup = {
  stepCounter: 'পুকুর {{current}} / {{total}}',
  finishLater: 'পরে সম্পূর্ণ করুন',

  sectionPond: 'পুকুরের বিবরণ',
  whyPond: 'আকার এবং আকৃতি আমাদের আপনার জন্য ক্ষেত্রফল, মজুদ ক্ষমতা এবং ডোজের পরিমাণ গণনা করতে দেয়।',
  sectionCulture: 'চাষের বিবরণ',
  whyCulture: 'প্রজাতি, মজুদের তারিখ এবং ঘনত্ব এই পুকুরের জন্য অ্যাপ প্রদত্ত প্রতিটি বৃদ্ধি, খাদ্য এবং ফসল কাটার সময়ের সুপারিশ পরিচালনা করে।',
  sectionAeration: 'বায়ুসঞ্চালন',
  whyAeration: 'ঐচ্ছিক, তবে এয়ারেশন ইঞ্জিন এটি পর্যাপ্ততা পরীক্ষা করতে এবং বিদ্যুৎ খরচ অনুমান করতে ব্যবহার করে — আপনি এটি এড়িয়ে যেতে এবং পরে যোগ করতে পারেন।',

  fieldName: 'পুকুরের নাম',
  placeholderName: 'যেমন: A1',

  fieldGeometry: 'পুকুরের আকৃতি',
  geom_rectangular: 'আয়তাকার',
  geom_circular: 'বৃত্তাকার',
  geom_raceway: 'রেসওয়ে',

  fieldDiameter: 'ব্যাস (m)',
  fieldLength: 'দৈর্ঘ্য (m)',
  fieldWidth: 'প্রস্থ (m)',
  fieldDepth: 'গভীরতা (m)',
  areaPreview: 'এলাকা: {{area}} m²',

  fieldSpecies: 'প্রজাতি',
  selectSpecies: 'প্রজাতি নির্বাচন করুন',
  fieldStrain: 'স্ট্রেন / লাইন',
  selectStrain: 'স্ট্রেন নির্বাচন করুন',
  fieldHatchery: 'বীজের উৎস (হ্যাচারি)',
  selectHatchery: 'হ্যাচারি নির্বাচন করুন',

  fieldDensity: 'মজুদ ঘনত্ব (PL/m²)',
  placeholderDensity: 'যেমন: 40',
  densityHint: 'প্রতি বর্গমিটারে মজুদকৃত পোস্ট-লার্ভা',

  fieldStartDate: 'চাষ শুরুর তারিখ',
  docHelper: 'আজ চাষের {{day}} দিন',

  fieldAeratorCount: 'অ্যারেটরের সংখ্যা',
  fieldHpPerAerator: 'প্রতি অ্যারেটর HP',
  totalHp: 'মোট স্থাপিত: {{hp}} HP',

  cropSuffix: 'ফসল ১',
  saveAndNext: 'সংরক্ষণ করে এগিয়ে যান',
  finishSetup: 'সেটআপ সম্পূর্ণ করুন',

  // Validation
  errName: 'একটি অক্ষরসংখ্যার পুকুরের নাম লিখুন',
  errDiameter: 'ব্যাস অবশ্যই 1–400 m হতে হবে',
  errLength: 'দৈর্ঘ্য অবশ্যই 1–500 m হতে হবে',
  errWidth: 'প্রস্থ অবশ্যই 1–500 m হতে হবে',
  errDepth: 'গভীরতা অবশ্যই 0.5–5.0 m হতে হবে',
  errArea: 'পুকুরের এলাকা 10 থেকে 50,000 m²-এর মধ্যে হতে হবে',
  errSpecies: 'একটি প্রজাতি নির্বাচন করুন',
  errStrain: 'একটি স্ট্রেন নির্বাচন করুন',
  errHatchery: 'একটি হ্যাচারি নির্বাচন করুন',
  errDensity: 'একটি সঠিক মজুদ ঘনত্ব লিখুন',
  errAerator: 'একটি সঠিক সংখ্যা লিখুন',
  errHp: 'প্রতি অ্যারেটর HP লিখুন',
  errSave: 'এই পুকুরটি সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।',

  // Pond naming, step 2 of 2 (artboard 06)
  stepPondsTitle: "আপনার পুকুর",
  namePattern: "নামের ধরন",
  prefixPlaceholder: "উপসর্গ",
  namesLabel: "নামসমূহ",
  pondsToCreate: "যেসব পুকুর তৈরি হবে",

  pondNameLabel: "পুকুরের নাম",


  pondNamePlaceholder: "যেমন উত্তরের পুকুর",


  errPondName: "প্রতিটি পুকুরের একটি নাম দিন",


  moreDetails: "আরও তথ্য যোগ করুন (ঐচ্ছিক)",


  moreDetailsHint: "এটি বন্ধ রাখলে আমরা নির্দিষ্ট আকারহীন মাটির পুকুর ধরে নেব। পুকুরের পাতা জানাবে যে সেগুলি নিশ্চিত নয়।",
  areaPlaceholder: "আয়তন m²",
  areaOptionalNote: "আয়তন এখন বাধ্যতামূলক নয়। পুকুরে পোনা ছাড়ার সময় যোগ করতে পারবেন।",
  createFarmCta: "খামার তৈরি করুন",
  errPrefix: "১–৪টি অক্ষর বা সংখ্যা ব্যবহার করুন",
  errPondsPartial: "খামার তৈরি হয়েছে, তবে {{count}}টি পুকুর যোগ করা যায়নি। খামারের স্ক্রিন থেকে যোগ করুন।",
};
export default pondSetup;
