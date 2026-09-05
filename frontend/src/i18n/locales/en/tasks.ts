/**
 * Task management — the composer, the row badges and the repeat templates.
 *
 * Separate from `content.tasks` (the old board strings) on purpose: this is
 * the vocabulary of ASSIGNING work, which the app did not have at all.
 */
const tasks = {
    // ── Composer ──────────────────────────────────────────────
    composeTitle: 'New task',
    composeWithFarm: 'New task · {{farmName}}',
    scopeLabel: 'Who is this for?',
    scopeFarm: 'The farm',
    scopePersonal: 'Just me',
    personalOnlyYou: 'Just for you — nobody else on the farm can see this task.',

    fieldTitle: 'Task',
    fieldTitlePlaceholder: 'e.g. Check the aerators',
    fieldNotes: 'Notes',
    fieldNotesPlaceholder: 'Anything the person doing it should know',

    fieldDue: 'Due',
    dueToday: 'Today',
    dueTomorrow: 'Tomorrow',
    dueCustom: 'Pick a date',
    fieldDueDate: 'Due date',
    dueOverdue: '{{count}} d overdue',

    fieldType: 'Kind of work',
    type_FEED: 'Feeding',
    type_WATER_TEST: 'Water test',
    type_SAMPLING: 'Sampling',
    type_AERATOR_CHECK: 'Aerator check',
    type_MORTALITY_CHECK: 'Mortality check',
    type_HARVEST_PREP: 'Harvest prep',
    type_OTHER: 'Other',

    fieldPriority: 'Priority',
    priority_low: 'Low',
    priority_medium: 'Normal',
    priority_high: 'Urgent',

    fieldFrom: 'From',
    fieldTo: 'To',

    fieldPond: 'Pond',
    pondAny: 'Whole farm',

    fieldAssignees: 'Who does it',
    assignEveryone: 'Everyone',
    everyoneOnFarmHint: 'Everyone on this farm will see it.',
    everyoneOnPondHint: 'Everyone who works this pond will see it.',
    assignedCount: 'Assigned to {{count}} people',

    fieldRepeat: 'Repeat',
    repeatNever: 'Never',
    repeatDaily: 'Every day',
    repeatWeekly: 'Every week',
    repeatHint: 'Create it once. It comes back on its own — you never add it again.',

    createCta: 'Create task',
    createErrorTitle: 'Could not create the task',
    createErrorBody: 'Please check the details and try again.',

    newTaskCta: 'New task',
    newPersonalCta: 'Task for myself',

    // ── Row badges ────────────────────────────────────────────
    badgeRepeating: 'Repeats',
    badgePersonal: 'Only you',
    byYou: 'You set this',
    assignedToYou: 'Assigned to you',

    // ── Repeating templates ───────────────────────────────────
    repeatingTitle: 'Repeating tasks',
    repeatingWithFarm: 'Repeating · {{farmName}}',
    repeatingSub: 'Daily and weekly work that creates itself',
    repeatUntil: 'until {{date}}',
    repeatForever: 'no end date',
    noRepeatingTitle: 'No repeating tasks',
    noRepeatingSub: 'Set Repeat on a task and it will show up here.',
    stopRepeatTitle: 'Stop repeating?',
    stopRepeatBody: '“{{title}}” will stop being created. Days already finished are kept.',
    stopRepeatCta: 'Stop',
};

export default tasks;
