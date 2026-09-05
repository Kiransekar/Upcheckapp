const leave = {
  title: 'Leave',
  requestFormTitle: 'Request leave',
  startDateLabel: 'Start date',
  endDateLabel: 'End date',
  reasonLabel: 'Reason (optional)',
  reasonPlaceholder: 'e.g. Family event',
  submitCta: 'Submit request',
  submittedTitle: 'Request submitted',
  submittedSub: 'Your leave request was sent for approval.',
  submitError: 'Could not submit your request. Try again.',
  errorDateRange: 'End date cannot be before start date.',
  // Reviewing leave spans every farm; requesting it needs exactly one, so the
  // form asks when it was opened without one.
  farmLabel: 'Farm',
  errorNoFarm: 'Choose which farm this leave is from.',
  decideError: 'Could not update this request. Try again.',
  pendingTitle: 'Pending approvals',
  pendingEmpty: 'No pending leave requests.',
  myRequestsTitle: 'My requests',
  myRequestsEmpty: "You haven't requested any leave yet.",
  dateRange: '{{start}} to {{end}}',
  approve: 'Approve',
  reject: 'Reject',
  status_pending: 'Pending',
  status_approved: 'Approved',
  status_rejected: 'Rejected',

  // Leave — artboard 3c
  dayCount: "{{count}} days",
  dayCount_one: "{{count}} day",
  noReason: "No reason given",
  nobodyAway: "Nobody else is on leave this week",
  awayThisWeek: "On leave this week: {{names}}",

  // Requester name
  unknownPerson: "Unknown member",
};

export default leave;
