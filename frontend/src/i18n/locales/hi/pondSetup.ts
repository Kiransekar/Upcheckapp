const pondSetup = {
  stepCounter: 'तालाब {{current}} / {{total}}',
  finishLater: 'बाद में पूरा करें',

  sectionPond: 'तालाब विवरण',
  whyPond: 'आकार और आकार हमें आपके लिए क्षेत्रफल, स्टॉकिंग क्षमता और खुराक की मात्रा की गणना करने देते हैं।',
  sectionCulture: 'संवर्धन विवरण',
  whyCulture: 'प्रजाति, स्टॉकिंग तिथि और घनत्व इस तालाब के लिए ऐप द्वारा दी गई हर वृद्धि, आहार और फसल-कटाई-समय की सिफारिश को संचालित करते हैं।',
  sectionAeration: 'वायुयन',
  whyAeration: 'वैकल्पिक, लेकिन एरेशन इंजन इसका उपयोग पर्याप्तता जांचने और बिजली लागत का अनुमान लगाने के लिए करता है — आप इसे छोड़ सकते हैं और बाद में जोड़ सकते हैं।',

  fieldName: 'तालाब का नाम',
  placeholderName: 'e.g. A1',

  fieldGeometry: 'तालाब का आकार',
  geom_rectangular: 'आयताकार',
  geom_circular: 'गोलाकार',
  geom_raceway: 'रेसवे',

  fieldDiameter: 'व्यास (m)',
  fieldLength: 'लंबाई (m)',
  fieldWidth: 'चौड़ाई (m)',
  fieldDepth: 'गहराई (m)',
  areaPreview: 'क्षेत्रफल: {{area}} m²',

  fieldSpecies: 'प्रजाति',
  selectSpecies: 'प्रजाति चुनें',
  fieldStrain: 'स्ट्रेन / लाइन',
  selectStrain: 'स्ट्रेन चुनें',
  fieldHatchery: 'बीज का स्रोत (हैचरी)',
  selectHatchery: 'हैचरी चुनें',

  fieldDensity: 'स्टॉकिंग घनत्व (PL/m²)',
  placeholderDensity: 'e.g. 40',
  densityHint: 'प्रति वर्ग मीटर स्टॉक किए गए पोस्ट-लार्वा',

  fieldStartDate: 'संवर्धन की शुरुआत',
  docHelper: 'आज संवर्धन का दिन {{day}}',

  fieldAeratorCount: 'एयरेटर की संख्या',
  fieldHpPerAerator: 'प्रति एयरेटर HP',
  totalHp: 'कुल स्थापित: {{hp}} HP',

  cropSuffix: 'फसल 1',
  saveAndNext: 'सहेजें और जारी रखें',
  finishSetup: 'सेटअप पूरा करें',

  // Validation
  errName: 'अल्फ़ान्यूमेरिक तालाब नाम दर्ज करें',
  errDiameter: 'व्यास 1–400 m के बीच होना चाहिए',
  errLength: 'लंबाई 1–500 m के बीच होनी चाहिए',
  errWidth: 'चौड़ाई 1–500 m के बीच होनी चाहिए',
  errDepth: 'गहराई 0.5–5.0 m के बीच होनी चाहिए',
  errArea: 'तालाब क्षेत्रफल 10 और 50,000 m² के बीच होना चाहिए',
  errSpecies: 'एक प्रजाति चुनें',
  errStrain: 'एक स्ट्रेन चुनें',
  errHatchery: 'एक हैचरी चुनें',
  errDensity: 'वैध स्टॉकिंग घनत्व दर्ज करें',
  errAerator: 'वैध संख्या दर्ज करें',
  errHp: 'प्रति एयरेटर HP दर्ज करें',
  errSave: 'यह तालाब सहेजा नहीं जा सका। कृपया पुनः प्रयास करें।',

  // Pond naming, step 2 of 2 (artboard 06)
  stepPondsTitle: "आपके तालाब",
  namePattern: "नाम का पैटर्न",
  prefixPlaceholder: "उपसर्ग",
  namesLabel: "नाम",
  pondsToCreate: "बनाए जाने वाले तालाब",

  pondNameLabel: "तालाब का नाम",


  pondNamePlaceholder: "जैसे उत्तरी तालाब",


  errPondName: "हर तालाब को एक नाम दें",


  moreDetails: "और जानकारी जोड़ें (वैकल्पिक)",


  moreDetailsHint: "इसे बंद रखेंगे तो हम बिना निश्चित आकार का मिट्टी का तालाब मान लेंगे। तालाब पेज बताएगा कि ये पुष्ट नहीं हैं।",
  areaPlaceholder: "क्षेत्रफल m²",
  areaOptionalNote: "क्षेत्रफल अभी ज़रूरी नहीं। तालाब में बीज डालते समय जोड़ सकते हैं।",
  createFarmCta: "फ़ार्म बनाएँ",
  errPrefix: "1–4 अक्षर या अंक इस्तेमाल करें",
  errPondsPartial: "फ़ार्म बन गया, पर {{count}} तालाब नहीं जुड़ सके। उन्हें फ़ार्म स्क्रीन से जोड़ें।",
};
export default pondSetup;
