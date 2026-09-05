const tasks = {
    // ── कार्य बनाना ───────────────────────────────────────────
    composeTitle: 'नया काम',
    composeWithFarm: 'नया काम · {{farmName}}',
    scopeLabel: 'यह किसके लिए है?',
    scopeFarm: 'फ़ार्म के लिए',
    scopePersonal: 'सिर्फ़ मेरे लिए',
    personalOnlyYou: 'सिर्फ़ आपके लिए — फ़ार्म पर कोई और यह काम नहीं देख सकता।',

    fieldTitle: 'काम',
    fieldTitlePlaceholder: 'जैसे: एरेटर जाँचें',
    fieldNotes: 'टिप्पणी',
    fieldNotesPlaceholder: 'काम करने वाले को जो जानना चाहिए',

    fieldDue: 'कब तक',
    dueToday: 'आज',
    dueTomorrow: 'कल',
    dueCustom: 'तारीख़ चुनें',
    fieldDueDate: 'नियत तारीख़',
    dueOverdue: '{{count}} दिन देर',

    fieldType: 'किस तरह का काम',
    type_FEED: 'खाना देना',
    type_WATER_TEST: 'पानी की जाँच',
    type_SAMPLING: 'नमूना लेना',
    type_AERATOR_CHECK: 'एरेटर जाँच',
    type_MORTALITY_CHECK: 'मृत्यु जाँच',
    type_HARVEST_PREP: 'कटाई की तैयारी',
    type_OTHER: 'अन्य',

    fieldPriority: 'प्राथमिकता',
    priority_low: 'कम',
    priority_medium: 'सामान्य',
    priority_high: 'ज़रूरी',

    fieldFrom: 'से',
    fieldTo: 'तक',

    fieldPond: 'तालाब',
    pondAny: 'पूरा फ़ार्म',

    fieldAssignees: 'कौन करेगा',
    assignEveryone: 'सब लोग',
    everyoneOnFarmHint: 'इस फ़ार्म के सभी लोग इसे देखेंगे।',
    everyoneOnPondHint: 'इस तालाब पर काम करने वाले सभी लोग इसे देखेंगे।',
    assignedCount: '{{count}} लोगों को दिया गया',

    fieldRepeat: 'दोहराएँ',
    repeatNever: 'कभी नहीं',
    repeatDaily: 'हर दिन',
    repeatWeekly: 'हर हफ़्ते',
    repeatHint: 'एक बार बनाइए। यह अपने आप लौट आएगा — दोबारा जोड़ने की ज़रूरत नहीं।',

    createCta: 'काम बनाएँ',
    createErrorTitle: 'काम नहीं बन सका',
    createErrorBody: 'कृपया विवरण जाँचें और फिर कोशिश करें।',

    newTaskCta: 'नया काम',
    newPersonalCta: 'अपने लिए काम',

    // ── पंक्ति के चिह्न ───────────────────────────────────────
    badgeRepeating: 'बार-बार',
    badgePersonal: 'सिर्फ़ आप',
    byYou: 'आपने बनाया',
    assignedToYou: 'आपको दिया गया',

    // ── दोहराए जाने वाले काम ─────────────────────────────────
    repeatingTitle: 'दोहराए जाने वाले काम',
    repeatingWithFarm: 'दोहराव · {{farmName}}',
    repeatingSub: 'रोज़ और हर हफ़्ते अपने आप बनने वाले काम',
    repeatUntil: '{{date}} तक',
    repeatForever: 'कोई अंतिम तारीख़ नहीं',
    noRepeatingTitle: 'कोई दोहराया जाने वाला काम नहीं',
    noRepeatingSub: 'किसी काम पर “दोहराएँ” लगाइए, वह यहाँ दिखेगा।',
    stopRepeatTitle: 'दोहराना बंद करें?',
    stopRepeatBody: '“{{title}}” अब नहीं बनेगा। पूरे हो चुके दिन बने रहेंगे।',
    stopRepeatCta: 'बंद करें',
};

export default tasks;
