const tasks = {
    // ── பணி உருவாக்கம் ─────────────────────────────────────────
    composeTitle: 'புதிய பணி',
    composeWithFarm: 'புதிய பணி · {{farmName}}',
    scopeLabel: 'இது யாருக்கு?',
    scopeFarm: 'பண்ணைக்கு',
    scopePersonal: 'எனக்கு மட்டும்',
    personalOnlyYou: 'உங்களுக்கு மட்டும் — பண்ணையில் வேறு யாரும் இந்தப் பணியைப் பார்க்க முடியாது.',

    fieldTitle: 'பணி',
    fieldTitlePlaceholder: 'எ.கா. ஏரேட்டரைச் சரிபார்க்கவும்',
    fieldNotes: 'குறிப்புகள்',
    fieldNotesPlaceholder: 'செய்பவர் தெரிந்திருக்க வேண்டியவை',

    fieldDue: 'எப்போதுக்குள்',
    dueToday: 'இன்று',
    dueTomorrow: 'நாளை',
    dueCustom: 'தேதியைத் தேர்வு செய்',
    fieldDueDate: 'கடைசி தேதி',
    dueOverdue: '{{count}} நாள் தாமதம்',

    fieldType: 'எந்த வகை வேலை',
    type_FEED: 'தீவனம் இடுதல்',
    type_WATER_TEST: 'நீர் பரிசோதனை',
    type_SAMPLING: 'மாதிரி எடுத்தல்',
    type_AERATOR_CHECK: 'ஏரேட்டர் சோதனை',
    type_MORTALITY_CHECK: 'இறப்பு சோதனை',
    type_HARVEST_PREP: 'அறுவடை தயாரிப்பு',
    type_OTHER: 'மற்றவை',

    fieldPriority: 'முன்னுரிமை',
    priority_low: 'குறைவு',
    priority_medium: 'சாதாரணம்',
    priority_high: 'அவசரம்',

    fieldFrom: 'முதல்',
    fieldTo: 'வரை',

    fieldPond: 'குளம்',
    pondAny: 'முழு பண்ணை',

    fieldAssignees: 'யார் செய்வார்',
    assignEveryone: 'அனைவரும்',
    everyoneOnFarmHint: 'இந்தப் பண்ணையில் உள்ள அனைவரும் இதைப் பார்ப்பார்கள்.',
    everyoneOnPondHint: 'இந்தக் குளத்தில் வேலை செய்யும் அனைவரும் இதைப் பார்ப்பார்கள்.',
    assignedCount: '{{count}} பேருக்கு ஒதுக்கப்பட்டது',

    fieldRepeat: 'மீண்டும்',
    repeatNever: 'இல்லை',
    repeatDaily: 'தினமும்',
    repeatWeekly: 'வாரம் ஒருமுறை',
    repeatHint: 'ஒருமுறை உருவாக்குங்கள். அது தானாகவே திரும்பும் — மீண்டும் சேர்க்க வேண்டாம்.',

    createCta: 'பணியை உருவாக்கு',
    createErrorTitle: 'பணியை உருவாக்க முடியவில்லை',
    createErrorBody: 'விவரங்களைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',

    newTaskCta: 'புதிய பணி',
    newPersonalCta: 'எனக்கான பணி',

    // ── வரிசைக் குறியீடுகள் ────────────────────────────────────
    badgeRepeating: 'தொடர் பணி',
    badgePersonal: 'உங்களுக்கு மட்டும்',
    byYou: 'நீங்கள் உருவாக்கியது',
    assignedToYou: 'உங்களுக்கு ஒதுக்கப்பட்டது',

    // ── தொடர் பணிகள் ──────────────────────────────────────────
    repeatingTitle: 'தொடர் பணிகள்',
    repeatingWithFarm: 'தொடர் · {{farmName}}',
    repeatingSub: 'தினமும், வாரமும் தானாக உருவாகும் வேலை',
    repeatUntil: '{{date}} வரை',
    repeatForever: 'முடிவு தேதி இல்லை',
    noRepeatingTitle: 'தொடர் பணிகள் இல்லை',
    noRepeatingSub: 'ஒரு பணிக்கு “மீண்டும்” அமைத்தால் அது இங்கே தோன்றும்.',
    stopRepeatTitle: 'மீண்டுவதை நிறுத்தவா?',
    stopRepeatBody: '“{{title}}” இனி உருவாக்கப்படாது. முடிந்த நாட்கள் அப்படியே இருக்கும்.',
    stopRepeatCta: 'நிறுத்து',
};

export default tasks;
