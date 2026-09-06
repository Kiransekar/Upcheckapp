const team = {
    title: 'Team',
    // The tab spans every farm by default; the chips narrow it.
    allFarms: "All farms",
    // The header button goes to the roster, so it says what it opens.
    manageTeam: 'Manage team',
    manageTeamPending: "Manage team · {{count}} waiting",
    noFarmTitle: "No farms yet",
    noFarmSub: "Create or join a farm to see its team.",
    checkedInAt: 'You checked in at {{time}}',
    stillCheckedIn: 'Still checked in · {{elapsed}}',
    checkOut: 'Check out',
    // The shift card used to appear only once you were already in, so the
    // check-in itself had no control anywhere on the tab.
    notCheckedIn: "You haven't checked in today",
    checkInSub: 'Start your shift so your hours are recorded.',
    checkInCta: 'Check in',
    savedOffline: 'Saved — will sync when online',
    // Attendance/Leave subtitles for someone who only sees their own state.
    yourAttendanceIn: 'Checked in · {{elapsed}}',
    leaveSelfSub: 'Request time off',
    // Asked instead of silently picking a farm for you.
    chooseFarmTitle: 'Which farm?',
    attendance: 'Attendance',
    checkedInCount: '{{count}} of {{total}} checked in today',
    leave: 'Leave',
    leaveWaiting: '{{count}} request waiting for you',
    leaveNone: 'Nothing waiting',
    tasksToday: 'Team tasks today',
    yourTasks: 'Your tasks',
    yourTasksNone: 'Nothing assigned to you today.',
    othersTasks: "Others' tasks",
    assign: 'Assign',
    overdue: 'overdue',
    overdueCount: '{{count}} overdue',
    noTasksTitle: 'No tasks today',
    noTasksSub: 'Assign work to your team and it shows up here.',
    showMoreTasks: 'Show {{count}} more tasks',
    status_open: 'Open',
    status_in_progress: 'Doing',
    status_done: 'Verify',
    status_verified: 'Done',

    // Team roster (AllWorkersScreen) — everyone, across every farm.
    rosterTitle: 'Team roster',
    rosterSub: 'Attendance, leave and join requests',
    rosterPeople: '{{count}} people',
    unknownPerson: 'Unknown',
    youAreIn: "You're checked in",
    youSuffix: '{{name}} (you)',
    sinceTime: 'Since {{time}}',
    att_in: 'In',
    att_out: 'Out',
    att_absent: 'Not in',
    pendingJoinBadge: 'Waiting',
    leaveRange: 'Leave {{from}} – {{to}}',
    approve: 'Approve',
    reject: 'Reject',
    // Join queue, mirrored by the Team tab badge.
    joins: 'Join requests',
    joinsWaiting: '{{count}} waiting to be let in',
    leaveMineWaiting: '{{count}} of your requests waiting',
    actionError: 'Could not update. Please try again.',
};

export default team;
