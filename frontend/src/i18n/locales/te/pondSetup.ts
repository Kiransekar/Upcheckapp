const pondSetup = {
  stepCounter: 'చెరువు {{current}} / {{total}}',
  finishLater: 'తర్వాత పూర్తి చేయండి',

  sectionPond: 'చెరువు వివరాలు',
  whyPond: 'ఆకారం మరియు పరిమాణం మాకు మీ కోసం విస్తీర్ణం, నిల్వ సామర్థ్యం మరియు మోతాదు మొత్తాలను లెక్కించడానికి అనుమతిస్తాయి.',
  sectionCulture: 'సాగు వివరాలు',
  whyCulture: 'జాతి, నిల్వ తేదీ మరియు సాంద్రత ఈ చెరువు కోసం యాప్ ఇచ్చే ప్రతి పెరుగుదల, దాణా మరియు పంట-కోత-సమయ సిఫార్సును నడిపిస్తాయి.',
  sectionAeration: 'గాలింపు',
  whyAeration: 'ఐచ్ఛికం, కానీ ఏరేషన్ ఇంజిన్ దీన్ని సమర్ధతను తనిఖీ చేయడానికి మరియు విద్యుత్ ఖర్చును అంచనా వేయడానికి ఉపయోగిస్తుంది — మీరు దీన్ని దాటవేసి తర్వాత జోడించవచ్చు.',

  fieldName: 'చెరువు పేరు',
  placeholderName: 'ఉదా. A1',

  fieldGeometry: 'చెరువు ఆకారం',
  geom_rectangular: 'దీర్ఘచతురస్రం',
  geom_circular: 'వృత్తాకారం',
  geom_raceway: 'రేస్‌వే',

  fieldDiameter: 'వ్యాసం (m)',
  fieldLength: 'పొడవు (m)',
  fieldWidth: 'వెడల్పు (m)',
  fieldDepth: 'లోతు (m)',
  areaPreview: 'వైశాల్యం: {{area}} m²',

  fieldSpecies: 'జాతి',
  selectSpecies: 'జాతిని ఎంచుకోండి',
  fieldStrain: 'స్ట్రెయిన్ / లైన్',
  selectStrain: 'స్ట్రెయిన్ ఎంచుకోండి',
  fieldHatchery: 'విత్తనం మూలం (హ్యాచరీ)',
  selectHatchery: 'హ్యాచరీని ఎంచుకోండి',

  fieldDensity: 'నిల్వ సాంద్రత (PL/m²)',
  placeholderDensity: 'ఉదా. 40',
  densityHint: 'చదరపు మీటర్‌కు నిల్వ చేసిన పోస్ట్-లార్వా',

  fieldStartDate: 'సాగు ప్రారంభం',
  docHelper: 'ఈరోజు సాగులో {{day}}వ రోజు',

  fieldAeratorCount: 'ఏరేటర్ల సంఖ్య',
  fieldHpPerAerator: 'ఒక్కో ఏరేటర్‌కు HP',
  totalHp: 'మొత్తం అమర్చినది: {{hp}} HP',

  cropSuffix: 'పంట 1',
  saveAndNext: 'సేవ్ చేసి కొనసాగండి',
  finishSetup: 'సెటప్ పూర్తి చేయండి',

  // Validation
  errName: 'అక్షరాంక చెరువు పేరు నమోదు చేయండి',
  errDiameter: 'వ్యాసం 1–400 m మధ్య ఉండాలి',
  errLength: 'పొడవు 1–500 m మధ్య ఉండాలి',
  errWidth: 'వెడల్పు 1–500 m మధ్య ఉండాలి',
  errDepth: 'లోతు 0.5–5.0 m మధ్య ఉండాలి',
  errArea: 'చెరువు వైశాల్యం 10 నుండి 50,000 m² మధ్య ఉండాలి',
  errSpecies: 'జాతిని ఎంచుకోండి',
  errStrain: 'స్ట్రెయిన్ ఎంచుకోండి',
  errHatchery: 'హ్యాచరీని ఎంచుకోండి',
  errDensity: 'చెల్లుబాటు అయ్యే నిల్వ సాంద్రత నమోదు చేయండి',
  errAerator: 'చెల్లుబాటు అయ్యే సంఖ్య నమోదు చేయండి',
  errHp: 'ఒక్కో ఏరేటర్‌కు HP నమోదు చేయండి',
  errSave: 'ఈ చెరువును సేవ్ చేయలేకపోయాం. దయచేసి మళ్ళీ ప్రయత్నించండి.',

  // Pond naming, step 2 of 2 (artboard 06)
  stepPondsTitle: "మీ చెరువులు",
  namePattern: "పేరు నమూనా",
  prefixPlaceholder: "ఉపసర్గ",
  namesLabel: "పేర్లు",
  pondsToCreate: "సృష్టించాల్సిన చెరువులు",

  pondNameLabel: "చెరువు పేరు",


  pondNamePlaceholder: "ఉదా. ఉత్తరపు చెరువు",


  errPondName: "ప్రతి చెరువుకు ఒక పేరు ఇవ్వండి",


  moreDetails: "మరిన్ని వివరాలు జోడించండి (ఐచ్ఛికం)",


  moreDetailsHint: "దీన్ని మూసి ఉంచితే, నిర్దిష్ట ఆకారం లేని మట్టి చెరువుగా భావిస్తాం. అవి ధృవీకరించబడలేదని చెరువు పేజీ చెబుతుంది.",
  areaPlaceholder: "విస్తీర్ణం m²",
  areaOptionalNote: "విస్తీర్ణం ఇప్పుడు తప్పనిసరి కాదు. చెరువులో పిల్లలు వేసేటప్పుడు జోడించవచ్చు.",
  createFarmCta: "ఫారమ్ సృష్టించండి",
  errPrefix: "1–4 అక్షరాలు లేదా అంకెలు ఉపయోగించండి",
  errPondsPartial: "ఫారమ్ సృష్టించబడింది, కానీ {{count}} చెరువులను జోడించలేకపోయాము. ఫారమ్ స్క్రీన్ నుండి జోడించండి.",
};
export default pondSetup;
