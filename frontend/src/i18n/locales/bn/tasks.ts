const tasks = {
    // ── কাজ তৈরি ──────────────────────────────────────────────
    composeTitle: 'নতুন কাজ',
    composeWithFarm: 'নতুন কাজ · {{farmName}}',
    scopeLabel: 'এটি কার জন্য?',
    scopeFarm: 'খামারের জন্য',
    scopePersonal: 'শুধু আমার জন্য',
    personalOnlyYou: 'শুধু আপনার জন্য — খামারের আর কেউ এই কাজটি দেখতে পাবে না।',

    fieldTitle: 'কাজ',
    fieldTitlePlaceholder: 'যেমন: এরেটর পরীক্ষা করুন',
    fieldNotes: 'নোট',
    fieldNotesPlaceholder: 'যে করবে তার যা জানা দরকার',

    fieldDue: 'কবের মধ্যে',
    dueToday: 'আজ',
    dueTomorrow: 'আগামীকাল',
    dueCustom: 'তারিখ বাছুন',
    fieldDueDate: 'নির্ধারিত তারিখ',
    dueOverdue: '{{count}} দিন দেরি',

    fieldType: 'কী ধরনের কাজ',
    type_FEED: 'খাবার দেওয়া',
    type_WATER_TEST: 'জল পরীক্ষা',
    type_SAMPLING: 'নমুনা নেওয়া',
    type_AERATOR_CHECK: 'এরেটর পরীক্ষা',
    type_MORTALITY_CHECK: 'মৃত্যু পরীক্ষা',
    type_HARVEST_PREP: 'ফসল তোলার প্রস্তুতি',
    type_OTHER: 'অন্যান্য',

    fieldPriority: 'অগ্রাধিকার',
    priority_low: 'কম',
    priority_medium: 'সাধারণ',
    priority_high: 'জরুরি',

    fieldFrom: 'থেকে',
    fieldTo: 'পর্যন্ত',

    fieldPond: 'পুকুর',
    pondAny: 'পুরো খামার',

    fieldAssignees: 'কে করবে',
    assignEveryone: 'সবাই',
    everyoneOnFarmHint: 'এই খামারের সবাই এটি দেখতে পাবে।',
    everyoneOnPondHint: 'এই পুকুরে যারা কাজ করে তারা সবাই এটি দেখতে পাবে।',
    assignedCount: '{{count}} জনকে দেওয়া হয়েছে',

    fieldRepeat: 'পুনরাবৃত্তি',
    repeatNever: 'কখনও নয়',
    repeatDaily: 'প্রতিদিন',
    repeatWeekly: 'প্রতি সপ্তাহে',
    repeatHint: 'একবার তৈরি করুন। এটি নিজেই ফিরে আসবে — আর যোগ করতে হবে না।',

    createCta: 'কাজ তৈরি করুন',
    createErrorTitle: 'কাজটি তৈরি করা গেল না',
    createErrorBody: 'তথ্যগুলি দেখে আবার চেষ্টা করুন।',

    newTaskCta: 'নতুন কাজ',
    newPersonalCta: 'নিজের জন্য কাজ',

    // ── সারির চিহ্ন ───────────────────────────────────────────
    badgeRepeating: 'বারবার',
    badgePersonal: 'শুধু আপনি',
    byYou: 'আপনি তৈরি করেছেন',
    assignedToYou: 'আপনাকে দেওয়া হয়েছে',

    // ── পুনরাবৃত্ত কাজ ────────────────────────────────────────
    repeatingTitle: 'পুনরাবৃত্ত কাজ',
    repeatingWithFarm: 'পুনরাবৃত্তি · {{farmName}}',
    repeatingSub: 'প্রতিদিন ও প্রতি সপ্তাহে নিজে থেকেই তৈরি হওয়া কাজ',
    repeatUntil: '{{date}} পর্যন্ত',
    repeatForever: 'কোনও শেষ তারিখ নেই',
    noRepeatingTitle: 'কোনও পুনরাবৃত্ত কাজ নেই',
    noRepeatingSub: 'কোনও কাজে “পুনরাবৃত্তি” দিন, সেটি এখানে দেখা যাবে।',
    stopRepeatTitle: 'পুনরাবৃত্তি বন্ধ করবেন?',
    stopRepeatBody: '“{{title}}” আর তৈরি হবে না। শেষ হওয়া দিনগুলি থেকে যাবে।',
    stopRepeatCta: 'বন্ধ করুন',
};

export default tasks;
