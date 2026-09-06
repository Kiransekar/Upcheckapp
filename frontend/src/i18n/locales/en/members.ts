// Farm team / worker membership screens.
const members = {
    // Profile QR
    workerCode: 'My worker code',
    workerCodeHint: 'Show this code to a farm owner so they can add you to their farm.',
    workerCodeCopied: 'Code copied',
    workerCodeShareMessage: 'My Neerani worker code: {{code}}',

    // Farm join code (shown to owner/manager so a worker can self-join)
    farmCodeLabel: 'Farm join code',
    farmCodeHint: 'Share this code with a worker so they can join this farm themselves.',
    copyCode: 'Copy code',
    codeCopiedTitle: 'Copied',
    codeCopiedSub: 'Farm code copied to clipboard.',

    // Members list
    title: 'Farm Team',
    farmCodeIdentityHint: "This is the farm's identifier. To let someone join, share an invite below.",
    inviteTitle: 'Invite to join',
    createInvite: 'Create an invite',
    newInvite: 'Replace with a new invite',
    noActiveInvite: 'No active invite. Create one to let someone join this farm.',
    inviteCreatedTitle: 'Invite created',
    inviteCreatedSub: 'The code is copied. Any older invite for this farm has been retired.',
    inviteCopiedSub: 'Invite code copied to clipboard.',
    inviteError: 'Could not update the invite. Please try again.',
    shareInvite: 'Share invite',
    revokeInvite: 'Revoke',
    revokeTitle: 'Revoke this invite?',
    revokeConfirm: 'Anyone still holding this code will no longer be able to join.',
    /**
     * An https link, NOT `upcheckapp://` (W4-A).
     *
     * The custom scheme was the only link here, and WhatsApp does not linkify
     * custom schemes — so the line rendered as dead text for the person
     * receiving it, and a recipient without the app installed got nothing at
     * all: no page, no Play Store link, no way to carry the code through an
     * install. The invite loop ended there.
     *
     * The bare code stays on the line above it deliberately. It is the
     * fallback that always works — readable aloud, and typeable into the app
     * by someone whose phone did nothing useful with the link.
     */
    shareInviteMessage: 'Join {{farm}} on Neerani with this code: {{code}}\nOr tap: https://api.upcheck.in/join/{{code}}',
    neverExpires: 'Never expires',
    expiresInDays: 'Expires in {{count}} days',
    expiresInHours: 'Expires in {{count}} hours',
    usesCount: '{{used}} of {{max}} used',
    unlimitedUses: 'Unlimited uses',
    joinExpired: 'That invite has expired. Ask the farm owner for a new code.',
    joinRevoked: 'That invite has been revoked. Ask the farm owner for a new code.',
    joinExhausted: 'That invite has already been used. Ask the farm owner for a new code.',
    joinAlreadyPending: "Your code worked. You are waiting for the owner to let you in — there is nothing more to type.",
    joinAlreadyMember: "You are already on this farm. Nothing to do — open it from your farm list.",
    joinNotFound: 'No farm found for that code. Check it and try again.',
    waitingTitle: 'Waiting to be let in',
    usedYourCode: 'Used your code',
    letIn: 'Let in',
    decline: 'Decline',
    declineTitle: 'Turn them away?',
    declineConfirm: '{{name}} will not join this farm. They can ask again with a new code.',
    approveError: 'Could not update the request. Please try again.',
    loadErrorTitle: 'Could not load the team',
    allPonds: 'all {{count}} ponds',
    emptyTitle: 'No team members yet',
    emptySub: 'Add a worker so they can log water quality and feed for this farm.',
    addWorker: 'Add worker',
    role_owner: 'Owner',
    role_manager: 'Manager',
    role_worker: 'Worker',
    role_viewer: 'Viewer',
    remove: 'Remove',
    removeTitle: 'Remove member',
    removeConfirm: 'Remove {{name}} from this farm?',
    removeError: 'Could not remove this member.',

    // Transfer of ownership — irreversible, so the copy says so plainly.
    transferCta: 'Transfer ownership',
    transferTitle: 'Transfer ownership?',
    transferConfirm: 'This cannot be undone. {{name}} becomes the owner of this farm and you become a manager.',
    transferError: 'Could not transfer ownership. Please try again.',

    // Add worker
    scanTab: 'Scan QR',
    manualTab: 'Enter ID',
    scanHint: "Point the camera at the worker's profile QR code.",
    cameraChecking: 'Checking camera permission…',
    cameraDenied: 'Camera access is off. Allow it to scan, or enter the ID manually.',
    grantCamera: 'Allow camera',
    enterManually: 'Enter ID instead',
    identifierLabel: 'Worker ID, phone or email',
    identifierPlaceholder: 'Paste ID or type phone / email',
    findUser: 'Find user',

    // Lookup / add results
    notFoundTitle: 'User not found',
    notFoundSub: 'No account matches that identifier. Check and try again.',
    inviteInstead: 'Send an invite instead',
    inviteInsteadBody: 'No account matches that identifier. Send an invite instead — they can join once they have an Neerani account.',
    invalidQrTitle: 'Unrecognized QR',
    invalidQrSub: 'That is not an Neerani worker code.',
    confirmAdd: 'Add to farm',
    addedTitle: 'Worker added',
    addedSub: '{{name}} can now log data for this farm.',
    addError: 'Could not add this worker.',

    // Cross-farm "All Workers" overview
    allTitle: 'All Workers',
    allEmptyTitle: 'No workers yet',
    allEmptySub: 'Add workers to your farms to see everyone here.',
    allFarmMemberCountLabel: 'Team: {{count}}',

  // Members — frontend/design/invite.png
  joinsAsWorker: "Anyone with this joins as a worker",
  shareCode: "Share code",
  newCode: "New code",
  onThisFarm: "On this farm",
  tapToEdit: "Tap any member to change their role or the ponds they can log.",
  roleSection: "Role",
  roleNote: "What they can do across the whole farm.",
  roleChangeError: "Could not change their role.",
  pondsSection: "Ponds they can log",
  allPondsAction: "All ponds",
  scopeAllNote: "Every pond on this farm. Tick some to narrow it.",
  scopeSomeNote: "Only the ponds ticked below.",
  noPondsToScope: "This farm has no ponds yet.",
  scopeError: "Could not change which ponds they can reach.",
  financialsSection: "Costs and money",
  financialsToggle: "Can see costs and money",
  financialsNote: "Off by default for workers and viewers.",
  financialsError: "Could not change their money access.",

  // Permission grid — per role (FarmMembersScreen) and per member (MemberDetailScreen)
  permissionsSection: "What this person can do",
  permissionsNote: "Leave anything on Default to follow the role rules below.",
  capabilitiesError: "Could not change their permissions.",
  rolePolicySection: "Permissions by role",
  rolePolicyNote: "Applies to everyone with that role on this farm, unless you change it for one person.",
  rolePolicyError: "Could not change the role permissions.",
  capDefault: "Default",
  capAllowed: "Allowed",
  capBlocked: "Blocked",
  capDefaultAllowed: "Default: allowed",
  capDefaultBlocked: "Default: not allowed",
  cap_RECORD_HARVEST: "Record a harvest",
  cap_VIEW_FINANCIALS: "See costs and money",
  cap_MANAGE_INVENTORY: "Change stock",
  cap_VIEW_INVENTORY: "See stock",
  cap_MANAGE_WORKERS: "Add and remove workers",
  cap_WRITE_MANAGEMENT: "Manage ponds and cycles",
};

export default members;
