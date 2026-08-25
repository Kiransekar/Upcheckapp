const farms = {
  // FarmsListScreen
  title: 'मेरे फार्म',
  ponds: 'तालाब',
  errorTitle: 'फार्म लोड नहीं हो सके',
  emptyTitle: 'अभी कोई फार्म नहीं',
  emptySubtitleEither: 'अपना पहला फार्म बनाएँ, या किसी और के फार्म से उनका कोड डालकर जुड़ें।',
  emptySubtitle: 'अपने तालाब और चक्र प्रबंधित करना शुरू करने के लिए पहला फार्म बनाएं।',
  addFarm: 'फार्म जोड़ें',
  workerNoFarmSubtitle: 'फार्म मालिक से आपको टीम सदस्य के रूप में जोड़ने के लिए कहें।',

  // FarmDetailScreen
  noPondsTitle: 'कोई तालाब नहीं मिला',
  noPondsSubtitle: 'चक्र ट्रैक करना शुरू करने के लिए इस फार्म में तालाब जोड़ें।',
  addPond: 'तालाब जोड़ें',
  activeCycle: 'सक्रिय चक्र',
  noActiveCycle: 'कोई सक्रिय चक्र नहीं',
  errorPondsTitle: 'तालाब लोड नहीं हो सके',

  // CreateFarmScreen
  fieldFarmName: 'फार्म का नाम',
  placeholderFarmName: 'उदा. उत्तर स्थल',
  fieldAddress: 'पता',
  placeholderAddress: 'पता या क्षेत्र',
  fieldArea: 'क्षेत्रफल (हेक्टेयर, वैकल्पिक)',
  errorFarmRequired: 'फार्म का नाम आवश्यक है',
  errorCreateFarm: 'फार्म बनाने में विफल',
  saveFarm: 'फार्म सहेजें',
  fieldLocation: 'फ़ार्म स्थान',
  detectLocation: 'मेरा स्थान पता करें',
  locating: 'स्थान प्राप्त हो रहा है…',
  locationCaptured: 'स्थान सेट · {{lat}}, {{lng}}',
  locationDeniedTitle: 'स्थान अनुमति आवश्यक',
  locationDeniedMsg: 'मौसम व ज्वार सुविधाओं के लिए अपने फ़ार्म का स्थान सेट करने हेतु अनुमति दें।',
  locationError: 'स्थान प्राप्त नहीं हो सका। पुनः प्रयास करें।',
  fieldWaterSource: 'जल स्रोत',
  water_tidal: 'ज्वारीय',
  water_river: 'नदी',
  water_borehole: 'बोरवेल',
  water_reservoir: 'जलाशय',
  water_recycled: 'पुनर्चक्रित',

  // FarmSetupScreen
  setupTitle: 'अपना फार्म सेट करें',
  createFarmTitle: 'फार्म बनाएं',
  setupLater: 'बाद में सेट करें',
  setupSubtitle: 'शुरू करने के लिए हमें अपने फार्म के बारे में थोड़ा बताएं।',
  fieldPondCount: 'तालाबों की संख्या',
  placeholderPondCount: 'e.g. 4',
  errorPondCountRequired: 'तालाबों की वैध संख्या दर्ज करें',
};
export default farms;
