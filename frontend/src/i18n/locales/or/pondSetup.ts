const pondSetup = {
  stepCounter: '{{total}} ମଧ୍ୟରୁ ପୋଖରୀ {{current}}',
  finishLater: 'ପରେ ସମାପ୍ତ କରନ୍ତୁ',

  sectionPond: 'ପୋଖରୀ ବିବରଣୀ',
  whyPond: 'ଆକାର ଏବଂ ଆକୃତି ଆମକୁ ଆପଣଙ୍କ ପାଇଁ କ୍ଷେତ୍ରଫଳ, ଷ୍ଟକିଂ କ୍ଷମତା ଏବଂ ମାତ୍ରା ଗଣନା କରିବାକୁ ଦିଏ।',
  sectionCulture: 'ଚାଷ ବିବରଣୀ',
  whyCulture: 'ପ୍ରଜାତି, ଷ୍ଟକିଂ ତାରିଖ ଏବଂ ଘନତା ଏହି ପୋଖରୀ ପାଇଁ ଆପ୍ ଦେଉଥିବା ପ୍ରତ୍ୟେକ ବୃଦ୍ଧି, ଖାଦ୍ୟ ଏବଂ ଅମଳ-ସମୟ ସୁପାରିଶକୁ ଚଳାଏ।',
  sectionAeration: 'ବାୟୁଚଳନ',
  whyAeration: 'ଇଚ୍ଛାଧୀନ, କିନ୍ତୁ ବାୟୁ ଚଳାଚଳ ଇଞ୍ଜିନ୍ ଏହାକୁ ପର୍ଯ୍ୟାପ୍ତତା ଯାଞ୍ଚ କରିବାକୁ ଏବଂ ବିଦ୍ୟୁତ ଖର୍ଚ୍ଚ ଆକଳନ କରିବାକୁ ବ୍ୟବହାର କରେ — ଆପଣ ଏହାକୁ ଛାଡ଼ି ପରେ ଯୋଡ଼ିପାରିବେ।',

  fieldName: 'ପୋଖରୀ ନାମ',
  placeholderName: 'e.g. A1',

  fieldGeometry: 'ପୋଖରୀ ଆକୃତି',
  geom_rectangular: 'ଆୟତାକାର',
  geom_circular: 'ବୃତ୍ତାକାର',
  geom_raceway: 'ରେସୱେ',

  fieldDiameter: 'ବ୍ୟାସ (m)',
  fieldLength: 'ଲମ୍ବ (m)',
  fieldWidth: 'ଓସାର (m)',
  fieldDepth: 'ଗଭୀରତା (m)',
  areaPreview: 'କ୍ଷେତ୍ରଫଳ: {{area}} m²',

  fieldSpecies: 'ପ୍ରଜାତି',
  selectSpecies: 'ପ୍ରଜାତି ବାଛନ୍ତୁ',
  fieldStrain: 'ଷ୍ଟ୍ରେନ / ଲାଇନ',
  selectStrain: 'ଷ୍ଟ୍ରେନ ବାଛନ୍ତୁ',
  fieldHatchery: 'ବିହନ ଉତ୍ସ (ହ୍ୟାଚରି)',
  selectHatchery: 'ହ୍ୟାଚରି ବାଛନ୍ତୁ',

  fieldDensity: 'ମହଜୁଦ ଘନତା (PL/m²)',
  placeholderDensity: 'e.g. 40',
  densityHint: 'ପ୍ରତି ବର୍ଗ ମିଟରରେ ମହଜୁଦ ପୋଷ୍ଟ-ଲାର୍ଭା',

  fieldStartDate: 'ଚାଷ ଆରମ୍ଭ',
  docHelper: 'ଆଜି ଚାଷର {{day}} ଦିନ',

  fieldAeratorCount: 'ଏରେଟର ସଂଖ୍ୟା',
  fieldHpPerAerator: 'ପ୍ରତି ଏରେଟର HP',
  totalHp: 'ମୋଟ ସ୍ଥାପିତ: {{hp}} HP',

  cropSuffix: 'ଫସଲ 1',
  saveAndNext: 'ସଞ୍ଚୟ କରି ଜାରି ରଖନ୍ତୁ',
  finishSetup: 'ସେଟଅପ ସମାପ୍ତ କରନ୍ତୁ',

  // Validation
  errName: 'ଏକ ଅକ୍ଷରାଙ୍କୀୟ ପୋଖରୀ ନାମ ଦିଅନ୍ତୁ',
  errDiameter: 'ବ୍ୟାସ 1–400 m ମଧ୍ୟରେ ହେବା ଆବଶ୍ୟକ',
  errLength: 'ଲମ୍ବ 1–500 m ମଧ୍ୟରେ ହେବା ଆବଶ୍ୟକ',
  errWidth: 'ଓସାର 1–500 m ମଧ୍ୟରେ ହେବା ଆବଶ୍ୟକ',
  errDepth: 'ଗଭୀରତା 0.5–5.0 m ମଧ୍ୟରେ ହେବା ଆବଶ୍ୟକ',
  errArea: 'ପୋଖରୀ କ୍ଷେତ୍ରଫଳ 10 ରୁ 50,000 m² ମଧ୍ୟରେ ହେବା ଆବଶ୍ୟକ',
  errSpecies: 'ଏକ ପ୍ରଜାତି ବାଛନ୍ତୁ',
  errStrain: 'ଏକ ଷ୍ଟ୍ରେନ ବାଛନ୍ତୁ',
  errHatchery: 'ଏକ ହ୍ୟାଚରି ବାଛନ୍ତୁ',
  errDensity: 'ଏକ ବୈଧ ମହଜୁଦ ଘନତା ଦିଅନ୍ତୁ',
  errAerator: 'ଏକ ବୈଧ ସଂଖ୍ୟା ଦିଅନ୍ତୁ',
  errHp: 'ପ୍ରତି ଏରେଟର HP ଦିଅନ୍ତୁ',
  errSave: 'ଏହି ପୋଖରୀ ସଞ୍ଚୟ ହୋଇ ପାରିଲା ନାହିଁ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।',

  // Pond naming, step 2 of 2 (artboard 06)
  stepPondsTitle: "ଆପଣଙ୍କ ପୋଖରୀ",
  namePattern: "ନାମ ଢାଞ୍ଚା",
  prefixPlaceholder: "ଉପସର୍ଗ",
  namesLabel: "ନାମଗୁଡ଼ିକ",
  pondsToCreate: "ତିଆରି ହେବାକୁ ଥିବା ପୋଖରୀ",
  areaPlaceholder: "କ୍ଷେତ୍ରଫଳ m²",
  areaOptionalNote: "କ୍ଷେତ୍ରଫଳ ବର୍ତ୍ତମାନ ବାଧ୍ୟତାମୂଳକ ନୁହେଁ। ପୋଖରୀରେ ପୋଣା ଛାଡ଼ିବା ସମୟରେ ଯୋଡ଼ିପାରିବେ।",
  createFarmCta: "ଫାର୍ମ ତିଆରି କରନ୍ତୁ",
  errPrefix: "୧–୪ଟି ଅକ୍ଷର କିମ୍ବା ସଂଖ୍ୟା ବ୍ୟବହାର କରନ୍ତୁ",
  errPondsPartial: "ଫାର୍ମ ତିଆରି ହେଲା, କିନ୍ତୁ {{count}}ଟି ପୋଖରୀ ଯୋଡ଼ି ହେଲାନାହିଁ। ଫାର୍ମ ସ୍କ୍ରିନରୁ ଯୋଡ଼ନ୍ତୁ।",
};
export default pondSetup;
