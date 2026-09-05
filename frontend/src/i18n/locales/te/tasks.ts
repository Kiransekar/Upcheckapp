const tasks = {
    // ── పని సృష్టి ────────────────────────────────────────────
    composeTitle: 'కొత్త పని',
    composeWithFarm: 'కొత్త పని · {{farmName}}',
    scopeLabel: 'ఇది ఎవరి కోసం?',
    scopeFarm: 'ఫారం కోసం',
    scopePersonal: 'నా కోసం మాత్రమే',
    personalOnlyYou: 'మీ కోసం మాత్రమే — ఫారంలో ఇంకెవరూ ఈ పనిని చూడలేరు.',

    fieldTitle: 'పని',
    fieldTitlePlaceholder: 'ఉదా. ఏరేటర్‌ను తనిఖీ చేయండి',
    fieldNotes: 'గమనికలు',
    fieldNotesPlaceholder: 'చేసే వ్యక్తికి తెలియాల్సినవి',

    fieldDue: 'ఎప్పటిలోగా',
    dueToday: 'ఈ రోజు',
    dueTomorrow: 'రేపు',
    dueCustom: 'తేదీ ఎంచుకోండి',
    fieldDueDate: 'గడువు తేదీ',
    dueOverdue: '{{count}} రోజులు ఆలస్యం',

    fieldType: 'ఏ రకమైన పని',
    type_FEED: 'మేత వేయడం',
    type_WATER_TEST: 'నీటి పరీక్ష',
    type_SAMPLING: 'నమూనా సేకరణ',
    type_AERATOR_CHECK: 'ఏరేటర్ తనిఖీ',
    type_MORTALITY_CHECK: 'మరణాల తనిఖీ',
    type_HARVEST_PREP: 'పంట సిద్ధత',
    type_OTHER: 'ఇతరం',

    fieldPriority: 'ప్రాధాన్యత',
    priority_low: 'తక్కువ',
    priority_medium: 'సాధారణం',
    priority_high: 'అత్యవసరం',

    fieldFrom: 'నుండి',
    fieldTo: 'వరకు',

    fieldPond: 'చెరువు',
    pondAny: 'మొత్తం ఫారం',

    fieldAssignees: 'ఎవరు చేస్తారు',
    assignEveryone: 'అందరూ',
    everyoneOnFarmHint: 'ఈ ఫారంలోని అందరూ దీన్ని చూస్తారు.',
    everyoneOnPondHint: 'ఈ చెరువులో పని చేసే అందరూ దీన్ని చూస్తారు.',
    assignedCount: '{{count}} మందికి కేటాయించారు',

    fieldRepeat: 'పునరావృతం',
    repeatNever: 'ఎప్పుడూ కాదు',
    repeatDaily: 'ప్రతిరోజూ',
    repeatWeekly: 'ప్రతి వారం',
    repeatHint: 'ఒకసారి సృష్టించండి. అది దానంతట అదే తిరిగి వస్తుంది — మళ్లీ చేర్చనవసరం లేదు.',

    createCta: 'పని సృష్టించు',
    createErrorTitle: 'పనిని సృష్టించలేకపోయాం',
    createErrorBody: 'వివరాలు సరిచూసి మళ్లీ ప్రయత్నించండి.',

    newTaskCta: 'కొత్త పని',
    newPersonalCta: 'నా కోసం పని',

    // ── వరుస గుర్తులు ─────────────────────────────────────────
    badgeRepeating: 'పునరావృతం',
    badgePersonal: 'మీకు మాత్రమే',
    byYou: 'మీరు సృష్టించారు',
    assignedToYou: 'మీకు కేటాయించారు',

    // ── పునరావృత పనులు ────────────────────────────────────────
    repeatingTitle: 'పునరావృత పనులు',
    repeatingWithFarm: 'పునరావృతం · {{farmName}}',
    repeatingSub: 'ప్రతిరోజూ, ప్రతి వారం తానే సృష్టించుకునే పని',
    repeatUntil: '{{date}} వరకు',
    repeatForever: 'ముగింపు తేదీ లేదు',
    noRepeatingTitle: 'పునరావృత పనులు లేవు',
    noRepeatingSub: 'ఒక పనికి “పునరావృతం” పెడితే అది ఇక్కడ కనిపిస్తుంది.',
    stopRepeatTitle: 'పునరావృతం ఆపాలా?',
    stopRepeatBody: '“{{title}}” ఇక సృష్టించబడదు. పూర్తయిన రోజులు అలాగే ఉంటాయి.',
    stopRepeatCta: 'ఆపు',
};

export default tasks;
