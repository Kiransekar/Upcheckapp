const tasks = {
    // ── କାମ ତିଆରି ─────────────────────────────────────────────
    composeTitle: 'ନୂଆ କାମ',
    composeWithFarm: 'ନୂଆ କାମ · {{farmName}}',
    scopeLabel: 'ଏହା କାହା ପାଇଁ?',
    scopeFarm: 'ଫାର୍ମ ପାଇଁ',
    scopePersonal: 'କେବଳ ମୋ ପାଇଁ',
    personalOnlyYou: 'କେବଳ ଆପଣଙ୍କ ପାଇଁ — ଫାର୍ମରେ ଆଉ କେହି ଏହି କାମ ଦେଖିପାରିବେ ନାହିଁ।',

    fieldTitle: 'କାମ',
    fieldTitlePlaceholder: 'ଯଥା: ଏରେଟର ଯାଞ୍ଚ କରନ୍ତୁ',
    fieldNotes: 'ଟିପ୍ପଣୀ',
    fieldNotesPlaceholder: 'କାମ କରୁଥିବା ବ୍ୟକ୍ତି ଜାଣିବା ଦରକାର',

    fieldDue: 'କେତେବେଳ ସୁଦ୍ଧା',
    dueToday: 'ଆଜି',
    dueTomorrow: 'ଆସନ୍ତାକାଲି',
    dueCustom: 'ତାରିଖ ବାଛନ୍ତୁ',
    fieldDueDate: 'ନିର୍ଦ୍ଧାରିତ ତାରିଖ',
    dueOverdue: '{{count}} ଦିନ ବିଳମ୍ବ',

    fieldType: 'କେଉଁ ପ୍ରକାର କାମ',
    type_FEED: 'ଖାଦ୍ୟ ଦେବା',
    type_WATER_TEST: 'ପାଣି ପରୀକ୍ଷା',
    type_SAMPLING: 'ନମୁନା ସଂଗ୍ରହ',
    type_AERATOR_CHECK: 'ଏରେଟର ଯାଞ୍ଚ',
    type_MORTALITY_CHECK: 'ମୃତ୍ୟୁ ଯାଞ୍ଚ',
    type_HARVEST_PREP: 'ଅମଳ ପ୍ରସ୍ତୁତି',
    type_OTHER: 'ଅନ୍ୟାନ୍ୟ',

    fieldPriority: 'ପ୍ରାଥମିକତା',
    priority_low: 'କମ୍',
    priority_medium: 'ସାଧାରଣ',
    priority_high: 'ଜରୁରୀ',

    fieldFrom: 'ଠାରୁ',
    fieldTo: 'ପର୍ଯ୍ୟନ୍ତ',

    fieldPond: 'ପୋଖରୀ',
    pondAny: 'ପୁରା ଫାର୍ମ',

    fieldAssignees: 'କିଏ କରିବ',
    assignEveryone: 'ସମସ୍ତେ',
    everyoneOnFarmHint: 'ଏହି ଫାର୍ମର ସମସ୍ତେ ଏହା ଦେଖିବେ।',
    everyoneOnPondHint: 'ଏହି ପୋଖରୀରେ କାମ କରୁଥିବା ସମସ୍ତେ ଏହା ଦେଖିବେ।',
    assignedCount: '{{count}} ଜଣଙ୍କୁ ଦିଆଯାଇଛି',

    fieldRepeat: 'ପୁନରାବୃତ୍ତି',
    repeatNever: 'କେବେ ନୁହେଁ',
    repeatDaily: 'ପ୍ରତିଦିନ',
    repeatWeekly: 'ପ୍ରତି ସପ୍ତାହ',
    repeatHint: 'ଥରେ ତିଆରି କରନ୍ତୁ। ଏହା ନିଜେ ଫେରି ଆସିବ — ପୁଣି ଯୋଡ଼ିବାକୁ ପଡ଼ିବ ନାହିଁ।',

    createCta: 'କାମ ତିଆରି କରନ୍ତୁ',
    createErrorTitle: 'କାମ ତିଆରି ହୋଇପାରିଲା ନାହିଁ',
    createErrorBody: 'ବିବରଣୀ ଯାଞ୍ଚ କରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।',

    newTaskCta: 'ନୂଆ କାମ',
    newPersonalCta: 'ନିଜ ପାଇଁ କାମ',

    // ── ଧାଡ଼ି ଚିହ୍ନ ────────────────────────────────────────────
    badgeRepeating: 'ପୁନରାବୃତ୍ତ',
    badgePersonal: 'କେବଳ ଆପଣ',
    byYou: 'ଆପଣ ତିଆରି କରିଛନ୍ତି',
    assignedToYou: 'ଆପଣଙ୍କୁ ଦିଆଯାଇଛି',

    // ── ପୁନରାବୃତ୍ତ କାମ ─────────────────────────────────────────
    repeatingTitle: 'ପୁନରାବୃତ୍ତ କାମ',
    repeatingWithFarm: 'ପୁନରାବୃତ୍ତି · {{farmName}}',
    repeatingSub: 'ପ୍ରତିଦିନ ଓ ପ୍ରତି ସପ୍ତାହ ନିଜେ ତିଆରି ହେଉଥିବା କାମ',
    repeatUntil: '{{date}} ପର୍ଯ୍ୟନ୍ତ',
    repeatForever: 'କୌଣସି ଶେଷ ତାରିଖ ନାହିଁ',
    noRepeatingTitle: 'କୌଣସି ପୁନରାବୃତ୍ତ କାମ ନାହିଁ',
    noRepeatingSub: 'କୌଣସି କାମରେ “ପୁନରାବୃତ୍ତି” ଦିଅନ୍ତୁ, ତାହା ଏଠାରେ ଦେଖାଯିବ।',
    stopRepeatTitle: 'ପୁନରାବୃତ୍ତି ବନ୍ଦ କରିବେ?',
    stopRepeatBody: '“{{title}}” ଆଉ ତିଆରି ହେବ ନାହିଁ। ସରିଥିବା ଦିନଗୁଡ଼ିକ ରହିବ।',
    stopRepeatCta: 'ବନ୍ଦ କରନ୍ତୁ',
};

export default tasks;
