const feedback = {
    // Entry points — the Settings tile and the row inside Help & Support.
    tileLabel: 'Report a problem',
    tileSub: 'Tell the team directly. They reply here in the app.',

    title: 'Report a problem',
    eyebrow: 'Straight to the Upcheck team',
    intro: 'Tell us what happened. Someone on the team reads every report and replies on this screen — you do not need to leave a Play Store review to reach us.',

    categoryLabel: 'What is this about',
    cat_problem: 'Something is wrong',
    cat_confusing: 'Something is confusing',
    cat_suggestion: 'An idea',
    cat_other: 'Something else',

    messageLabel: 'What happened',
    messagePlaceholder: 'Example: I saved a water test but it does not show up in the pond history.',
    subjectLabel: 'Short title (optional)',
    subjectPlaceholder: 'Water test did not save',

    photosLabel: 'Photos',
    photosHint: 'Up to {{count}} photos. A screenshot of the problem helps most.',
    addPhoto: 'Add photo',
    removePhoto: 'Remove photo',
    photoLimitReached: 'You can attach up to {{count}} photos.',
    permissionTitle: 'Photos need permission',
    permissionBody: 'Upcheck cannot open your photos without permission. You can allow it in your phone settings — or just send the report without a photo.',
    uploadFailed: 'That photo could not be attached. You can send the report without it.',

    send: 'Send to the team',
    messageRequired: 'Please write what happened first.',
    sendFailed: 'Could not send your report. Please try again.',
    sentTitle: 'Sent',
    sentBody: 'Thank you. The team will reply on this screen.',
    offlineTitle: 'You are offline',
    offlineBody: 'A report is a conversation, so it is not saved for later — please send it when you have signal again.',

    myReports: 'Your reports',
    noReports: 'You have not reported anything yet.',
    loadFailed: 'Could not load your reports.',
    replied: 'Team replied',
    attachmentCount_one: '{{count}} photo',
    attachmentCount_other: '{{count}} photos',

    // Status vocabulary — see backend/src/feedback/feedback-status.ts.
    status_new: 'Sent',
    status_seen: 'Seen by the team',
    status_in_review: 'Being looked at',
    status_done: 'Done',
    status_closed: 'Closed',

    detailTitle: 'Your report',
    yourMessage: 'What you sent',
    teamResponse: 'The team replied',
    noResponseYet: 'No reply yet. It will appear here when the team writes back.',
    respondedBy: '{{name}} · {{date}}',
    photos: 'Photos',
    photosUnavailable: 'Photos could not be loaded right now.',
    detailLoadFailed: 'Could not load this report.',
};

export default feedback;
