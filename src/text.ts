/**
 * Every user-facing string lives here. Edit the wording freely; keep the function signatures.
 */
export const t = {
  footer: 'Railcore · Falkenberg Railways',
  presence: 'the rails',

  errors: {
    title: 'Signal at danger',
    unexpected: (ref: string) =>
      `Something went off the rails on our side. Please try again in a moment.\nReference: \`${ref}\``,
    botMissingPermissions:
      "I'm missing a permission to do that. Ask an admin to check my role and channel permissions.",
    noPermission: "You don't have permission to do that.",
    unknownInteraction: 'This button or menu is no longer active. Run the command again.',
    roleNotAssignable: (role: string) =>
      `${role} is managed by an integration or is @everyone, so I can't assign it.`,
    roleTooHigh: (role: string) =>
      `${role} is above my highest role, so I can't assign it. Drag my role above it in **Server Settings → Roles**.`,
    needManageRoles: 'I need the **Manage Roles** permission to assign roles.',
  },

  commands: {
    setup: 'Configure Railcore for this server',
    verifyPanel: 'Post the verification panel in the verification channel',
    ticketPanel: 'Post the ticket panel in this channel',
    ticket: 'Manage who can see this ticket',
    ticketAdd: 'Give a member access to this ticket',
    ticketRemove: "Remove a member's access to this ticket",
    warn: 'Warn a member',
    warnings: "Show a member's active warnings",
    clearwarn: 'Clear one or all warnings of a member',
    timeout: 'Time out a member',
    untimeout: "Remove a member's timeout",
    kick: 'Kick a member from the server',
    ban: 'Ban a user from the server',
    unban: 'Unban a user',
    purge: 'Bulk delete recent messages in this channel',
  },

  /** Right-click menu entries (Apps). Max 32 characters; re-register commands after changing. */
  contextMenus: {
    warn: 'Warn',
    timeout: 'Timeout',
    warnings: 'Show warnings',
    report: 'Report message',
  },

  /** Slash-command option descriptions (max 100 characters). */
  options: {
    user: 'The member',
    reason: 'Why? The member sees this in their DM',
    duration: 'How long, e.g. 10m, 2h or 1d (max 28d)',
    case: 'Case number of one warning (leave empty to clear all)',
    deleteMessages: 'Also delete their recent messages',
    amount: 'How many recent messages to check (1–100)',
    purgeUser: 'Only delete messages from this user',
    userId: 'ID of the banned user',
    ticketUser: 'The member',
  },

  time: {
    d: (n: number) => `${n} day${n === 1 ? '' : 's'}`,
    h: (n: number) => `${n} hour${n === 1 ? '' : 's'}`,
    m: (n: number) => `${n} minute${n === 1 ? '' : 's'}`,
    s: (n: number) => `${n} second${n === 1 ? '' : 's'}`,
  },

  /** Names as Discord shows them in channel settings. Unlisted ones fall back to "Split Words". */
  permissions: {
    ViewChannel: 'View Channel',
    SendMessages: 'Send Messages',
    EmbedLinks: 'Embed Links',
    AttachFiles: 'Attach Files',
    ManageChannels: 'Manage Channels',
    ManageRoles: 'Manage Permissions',
    ReadMessageHistory: 'Read Message History',
  } as Partial<Record<string, string>>,

  logs: {
    member: 'Member',
    accountCreated: 'Account created',
  },

  verify: {
    panelTitle: 'Welcome to Falkenberg Railways',
    panelBody:
      'Before you board, take a minute to read the server rules.\n\nWhen you are ready, press **Verify** to get access to the rest of the server.',
    verifyButton: 'Verify',
    verifyEmoji: '🎫',
    promptTitle: 'One last stop',
    promptBody:
      '**I have read and accept the rules.**\n\nPress **Accept** to confirm and get access to the server.',
    acceptButton: 'Accept',
    welcomeTitle: 'All aboard! 🚆',
    welcome: (user: string) =>
      `Welcome to Falkenberg Railways, ${user}. You now have access to the server. Enjoy the ride!`,
    alreadyVerifiedTitle: 'Already on board',
    alreadyVerified: "You're already verified. Enjoy the ride!",
    notConfigured: "Verification isn't available right now. Please let a staff member know.",
    tooNewTitle: 'Account too new',
    tooNew: (days: number, when: string) =>
      `Your Discord account is too new to verify here. Accounts must be at least **${days} day${days === 1 ? '' : 's'}** old.\n\nYou can verify ${when}.`,
    cooldown: (when: string) => `Easy there! You can try again ${when}.`,
    auditReason: 'Accepted the rules',
    panelPostedTitle: 'Panel posted',
    panelPosted: (channel: string) => `The verification panel is now live in ${channel}.`,
    panelNeedsChannel: 'Set a **Verification channel** in `/setup` first.',
    panelNeedsRole: 'Set a **Verified role** in `/setup` first.',
    panelMissingPerms: (channel: string, perms: string) =>
      `I'm missing **${perms}** in ${channel}.`,
    logVerifiedTitle: 'Member verified',
    logTooNewTitle: 'Verification blocked: account too new',
    requiredAge: 'Required age',
  },

  tickets: {
    panelTitle: 'Need a hand?',
    panelBody:
      'Pick what fits best and we will open a private channel with our staff.\n\n🛟 **Support**: questions, problems or anything else\n🐞 **Bug Report**: something broken in the game\n📋 **Staff Application**: join the Falkenberg Railways team',
    types: {
      SUPPORT: {
        label: 'Support',
        emoji: '🛟',
        channel: 'support',
        title: 'Support ticket',
        intro: 'Thanks for reaching out! A staff member will be with you shortly.',
      },
      BUG_REPORT: {
        label: 'Bug Report',
        emoji: '🐞',
        channel: 'bug',
        title: 'Bug report',
        intro: 'Thanks for reporting! A staff member will be with you shortly.',
      },
      APPLICATION: {
        label: 'Staff Application',
        emoji: '📋',
        channel: 'application',
        title: 'Staff application',
        intro: 'Thanks for applying! Staff will review your answers and get back to you here.',
      },
      REPORT: {
        label: 'Report',
        emoji: '🚩',
        channel: 'report',
        title: 'Message report',
        intro: 'Thanks for the report! Staff will take a look and may ask you questions here.',
      },
    },
    /** Modal questions. Labels: max 45 characters, placeholders: max 100. */
    questions: {
      SUPPORT: {
        subject: { label: 'What do you need help with?', placeholder: 'A short summary' },
        details: { label: 'Details', placeholder: 'Tell us as much as you can' },
      },
      BUG_REPORT: {
        roblox: { label: 'Roblox username', placeholder: 'Your Roblox username' },
        what: { label: 'What happened?', placeholder: 'Describe the bug' },
        steps: { label: 'Steps to reproduce', placeholder: '1. Spawn at… 2. Drive to… 3. …' },
        where: { label: 'Where did it happen?', placeholder: 'Route, station or train' },
        device: { label: 'Device', placeholder: 'PC, mobile, console…' },
      },
      APPLICATION: {
        roblox: { label: 'Roblox username', placeholder: 'Your Roblox username' },
        age: { label: 'Age', placeholder: 'How old are you?' },
        timezone: { label: 'Timezone', placeholder: 'e.g. CET or UTC+1' },
        experience: {
          label: 'Experience',
          placeholder: 'Moderation, community or game experience',
        },
        why: {
          label: 'Why should we pick you?',
          placeholder: 'Tell us what you would bring to the team',
        },
      },
      REPORT: {
        details: {
          label: 'What is wrong with this message?',
          placeholder: 'Optional, but it helps staff',
        },
      },
    },
    reportAuthor: 'Author',
    reportMessage: 'Reported message',
    notInTicket: 'Use this inside an open ticket channel.',
    cantChangeOpener: 'The person who opened the ticket always keeps access.',
    cantChangeBot: 'I need to stay in the ticket.',
    cantRemoveStaff:
      'Staff always see tickets. To keep someone out, remove their staff role first.',
    userAdded: (user: string, by: string) => `${user} was added to this ticket by ${by}.`,
    userRemoved: (user: string, by: string) => `${user} was removed from this ticket by ${by}.`,
    auditAccess: (by: string) => `Ticket access changed by ${by}`,
    reminderTitle: 'Still need help?',
    reminder: 'Is there anything else we can help with? Just reply here.',
    reminderWithClose: (when: string) =>
      `Is there anything else we can help with? Just reply here, otherwise this ticket closes ${when}.`,
    autoCloseReason: 'Closed automatically after no reply',
    reportLink: 'Link',
    reportJump: 'Jump to message',
    reportAttachments: 'Attachments',
    reportOwn: "You can't report your own message.",
    reportExpired: 'This report form expired. Please right-click the message and report it again.',
    openedBy: 'Opened by',
    openedTitle: 'Ticket opened',
    opened: (channel: string) => `All aboard! Your ticket is ready: ${channel}`,
    notConfigured: "Tickets aren't set up yet. Please let a staff member know.",
    panelNeedsSetup:
      'Set a **Ticket category**, a **Ticket log channel** and at least one **Staff role** in `/setup` first.',
    transcriptNotSaved:
      "Couldn't post the transcript to the ticket log, so I kept this channel. Check the **Ticket log channel** in `/setup` (I need Send Messages and Attach Files there).",
    cooldown: (when: string) => `You just opened a ticket. You can open another one ${when}.`,
    panelPostedTitle: 'Panel posted',
    panelPosted: 'The ticket panel is now live in this channel.',
    alreadyOpen: (type: string, channel?: string) =>
      channel
        ? `You already have an open ${type} ticket: ${channel}`
        : `You already have an open ${type} ticket.`,
    alreadyClosed: 'This ticket is already closed.',
    alreadyClosing: 'This ticket is already being closed.',
    staffOnly: 'Only staff can do that.',
    closeNotAllowed: 'Only staff or the person who opened this ticket can close it.',
    claim: 'Claim',
    claimed: 'Claimed',
    close: 'Close',
    claimedBy: (user: string) => `${user} claimed this ticket and will be helping you.`,
    alreadyClaimed: (user: string) => `This ticket is already claimed by ${user}.`,
    confirmTitle: 'Close this ticket?',
    confirmBody: 'A transcript is saved and sent to the opener, then this channel is deleted.',
    confirmClose: 'Close ticket',
    confirmWithReason: 'Close with reason',
    reasonModalTitle: 'Close ticket',
    reasonLabel: 'Reason',
    reasonPlaceholder: 'Shown in the ticket log and the closing DM',
    closingTitle: 'Closing ticket…',
    closingNotice: (user: string) =>
      `🔒 Ticket closed by ${user}. This channel will be deleted in 5 seconds.`,
    staleReason: 'Channel no longer exists',
    topic: (title: string, number: string, user: string) =>
      `${title} #${number} · opened by ${user}`,
    auditOpened: (user: string) => `Ticket opened by ${user}`,
    auditClosed: 'Ticket closed',
    logClosedTitle: (title: string, number: string) => `${title} #${number} closed`,
    closedBy: 'Closed by',
    claimedByField: 'Claimed by',
    reason: 'Reason',
    noReason: 'No reason given',
    nobody: 'Nobody',
    openedAt: 'Opened',
    messages: 'Messages',
    dmClosedTitle: 'Your ticket was closed',
    dmClosed: (title: string, number: string, guild: string) =>
      `Your ${title.toLowerCase()} #${number} on **${guild}** has been closed. The full transcript is attached.`,
  },

  applications: {
    accept: 'Accept',
    deny: 'Deny',
    acceptTitle: 'Accept application',
    denyTitle: 'Deny application',
    reasonLabel: 'Reason (staff only)',
    reasonHint: 'Optional. Saved in the ticket log; the applicant never sees it.',
    alreadyReviewed: 'This application has already been reviewed.',
    ownApplication: "You can't review your own application.",
    roleFailed:
      "The decision is saved, but I couldn't give the application role. Check that the applicant is still here and that my role is above it.",
    decision: 'Decision',
    acceptedBy: (user: string) => `✅ Accepted by ${user}`,
    deniedBy: (user: string) => `❌ Denied by ${user}`,
    dmAcceptedTitle: 'Application accepted 🎉',
    dmAccepted: (guild: string) =>
      `Great news! Your staff application on **${guild}** has been accepted. Welcome to the team, a staff member will be in touch.`,
    dmDeniedTitle: 'Application update',
    dmDenied: (guild: string) =>
      `Thanks for applying on **${guild}**. Unfortunately your staff application was not accepted this time. You are welcome to apply again in the future.`,
    dmFailed: "I couldn't DM the applicant (their DMs are closed). Please let them know here.",
    auditAccepted: 'Staff application accepted',
    logTitle: (number: string, accepted: boolean) =>
      `Staff application #${number} ${accepted ? 'accepted' : 'denied'}`,
    applicant: 'Applicant',
    reviewedBy: 'Reviewed by',
    ticket: 'Ticket',
    status: 'Application',
    statuses: { PENDING: 'Pending', ACCEPTED: 'Accepted', DENIED: 'Denied' },
  },

  transcript: {
    openedBy: 'Opened by',
    messages: (n: number) => `${n} message${n === 1 ? '' : 's'}`,
    bot: 'BOT',
    linkMayExpire: 'link may expire',
  },

  serverLog: {
    messageEdited: 'Message edited',
    messageDeleted: 'Message deleted',
    memberJoined: 'Member joined',
    memberLeft: 'Member left',
    rolesChanged: 'Roles updated',
    nicknameChanged: 'Nickname changed',
    author: 'Author',
    channel: 'Channel',
    before: 'Before',
    after: 'After',
    content: 'Content',
    attachments: 'Attachments',
    joined: 'Joined',
    roles: 'Roles',
    added: 'Added',
    removed: 'Removed',
    memberCount: 'Members',
    newAccount: '⚠️ new account',
    notCached: '*Unknown, not in my cache*',
    messagesBulkDeleted: (count: number) => `${count} messages deleted`,
    unknown: '*Unknown*',
    noText: '*No text*',
    none: '*None*',
  },

  mod: {
    noReason: 'No reason given',
    warnModalTitle: (user: string) => `Warn ${user}`,
    timeoutModalTitle: (user: string) => `Time out ${user}`,
    reasonLabel: 'Reason',
    reasonPlaceholder: 'The member sees this in their DM',
    durationLabel: 'Duration',
    durationPlaceholder: 'e.g. 10m, 2h or 1d (max 28d)',
    actions: {
      WARN: 'Warning',
      TIMEOUT: 'Timeout',
      UNTIMEOUT: 'Timeout removed',
      KICK: 'Kick',
      BAN: 'Ban',
      UNBAN: 'Unban',
      PURGE: 'Purge',
    },
    caseTitle: (number: number, action: string) => `Case #${number} · ${action}`,
    done: {
      WARN: (user: string) => `${user} has been warned.`,
      TIMEOUT: (user: string) => `${user} has been timed out.`,
      UNTIMEOUT: (user: string) => `${user}'s timeout has been removed.`,
      KICK: (user: string) => `${user} has been kicked.`,
      BAN: (user: string) => `${user} has been banned.`,
      UNBAN: (user: string) => `${user} has been unbanned.`,
    },
    endsAt: (when: string) => `Ends ${when}.`,
    dmSent: 'They were notified by DM.',
    dmFailed: "I couldn't DM them, their DMs are closed.",
    auditReason: (moderator: string, reason: string) => `${moderator}: ${reason}`,
    /** What the member receives by DM. The reason and case number are added below it. */
    dm: {
      WARN: {
        title: 'You received a warning',
        body: (guild: string) =>
          `A moderator warned you in **${guild}**. Please keep the server rules in mind.`,
      },
      TIMEOUT: {
        title: 'You were timed out',
        body: (guild: string) =>
          `You are timed out in **${guild}**. You can't chat or join voice until it ends.`,
      },
      UNTIMEOUT: {
        title: 'Your timeout was removed',
        body: (guild: string) => `Your timeout in **${guild}** has been removed. Welcome back!`,
      },
      KICK: {
        title: 'You were kicked',
        body: (guild: string) =>
          `You were kicked from **${guild}**. You can rejoin with a new invite.`,
      },
      BAN: {
        title: 'You were banned',
        body: (guild: string) => `You were banned from **${guild}**.`,
      },
    },
    fields: {
      user: 'User',
      moderator: 'Moderator',
      reason: 'Reason',
      duration: 'Duration',
      ends: 'Ends',
      case: 'Case',
      channel: 'Channel',
      messages: 'Messages',
    },
    notMember: "That user isn't in this server.",
    notSelf: "You can't moderate yourself.",
    notBot: "I can't moderate myself.",
    notOwner: "The server owner can't be moderated.",
    targetHigher: (user: string) =>
      `${user} has an equal or higher role than you, so you can't moderate them.`,
    botCannot: (user: string) =>
      `I can't do that to ${user}. My role must be above theirs and I need the matching permission.`,
    timeoutAdmin: "Administrators can't be timed out.",
    invalidDuration: 'Use a duration like `10m`, `2h` or `1d`, between 1 minute and 28 days.',
    notTimedOut: (user: string) => `${user} isn't timed out.`,
    alreadyBanned: (user: string) => `${user} is already banned.`,
    notBanned: "That user isn't banned.",
    invalidUserId:
      "That doesn't look like a user ID. Right-click the user and choose **Copy User ID**.",
    deleteChoices: {
      none: "Don't delete any",
      hour: 'Last hour',
      day: 'Last 24 hours',
      week: 'Last 7 days',
    },
    noWarnings: (user: string) => `${user} has no active warnings. Clean record!`,
    warningsTitle: (user: string, count: number) =>
      `${count} active warning${count === 1 ? '' : 's'} for ${user}`,
    warningLine: (number: number, date: string, moderator: string, reason: string) =>
      `**#${number}** · ${date} · by ${moderator}\n${reason}`,
    moreWarnings: (n: number) => `…and ${n} more.`,
    caseNotFound: (number: number) => `There's no active warning #${number} for that user.`,
    clearedOne: (number: number, user: string) => `Cleared warning #${number} for ${user}.`,
    clearedAll: (count: number, user: string) =>
      `Cleared ${count} warning${count === 1 ? '' : 's'} for ${user}.`,
    logClearedTitle: 'Warnings cleared',
    purged: (count: number, channel: string) =>
      `Deleted ${count} message${count === 1 ? '' : 's'} in ${channel}.`,
    purgeSkipped: 'Pinned messages, system messages and messages older than 14 days were skipped.',
    nothingToPurge:
      'There were no messages I could delete. Pinned messages, system messages and messages older than 14 days are skipped.',
  },

  setup: {
    title: 'Railcore setup',
    intro: 'Pick a setting below to change it. Changes save instantly.',
    notSet: '`Not set`',
    days: (n: number) => (n === 0 ? 'Off' : `${n} day${n === 1 ? '' : 's'}`),
    groups: {
      verification: 'Verification',
      tickets: 'Tickets & applications',
      logs: 'Logs',
    },
    pickPlaceholder: 'Choose a setting to change…',
    editTitle: (label: string) => `Setup · ${label}`,
    current: 'Current',
    channelPlaceholder: 'Select a channel…',
    categoryPlaceholder: 'Select a category…',
    rolePlaceholder: 'Select a role…',
    rolesPlaceholder: 'Select up to 10 roles…',
    back: 'Back',
    clear: 'Clear',
    change: 'Change',
    saved: (label: string) => `✅ Saved **${label}**.`,
    cleared: (label: string) => `✅ Cleared **${label}**.`,
    savedMissingPerms: (label: string, channel: string, perms: string) =>
      `⚠️ Saved **${label}**, but I'm missing **${perms}** in ${channel}. Fix that, or I can't work there.`,
    hours: (n: number) => (n === 0 ? 'Off' : `${n} hour${n === 1 ? '' : 's'}`),
    units: { days: 'Days', hours: 'Hours' },
    numberHint: (max: number) => `Whole number from 0 to ${max}. 0 turns it off.`,
    invalidNumber: (max: number) => `Enter a whole number from 0 to ${max}.`,
    settings: {
      verificationChannelId: {
        label: 'Verification channel',
        description: 'Where the verify panel is posted.',
      },
      verifiedRoleId: {
        label: 'Verified role',
        description: 'Given to members after they accept the rules.',
      },
      minAccountAgeDays: {
        label: 'Minimum account age',
        description: "Younger Discord accounts can't verify.",
      },
      ticketCategoryId: {
        label: 'Ticket category',
        description: 'New ticket channels are created here.',
      },
      ticketLogChannelId: {
        label: 'Ticket log channel',
        description: 'Transcripts of closed tickets go here.',
      },
      staffRoleIds: {
        label: 'Staff roles',
        description: 'Can see and handle tickets and applications.',
      },
      applicationRoleId: {
        label: 'Application role',
        description: 'Given when a staff application is accepted.',
      },
      ticketReminderHours: {
        label: 'Ticket reminder',
        description: 'Hours without a reply to staff before the opener is reminded.',
      },
      ticketAutoCloseHours: {
        label: 'Ticket auto-close',
        description: 'Hours after the reminder until the ticket closes itself.',
      },
      modLogChannelId: {
        label: 'Mod log channel',
        description: 'Moderation actions and verification alerts.',
      },
      serverLogChannelId: {
        label: 'Server log channel',
        description: 'Edits, deletes, joins, leaves, role and nickname changes.',
      },
    },
  },
} as const;
