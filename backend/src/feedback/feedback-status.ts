/**
 * The one place the feedback vocabulary is written down.
 *
 * Backend DTOs, the admin dashboard and the app's status pills all read from
 * here (the dashboard has its own copy of the union because it is a separate
 * deploy — if you change this list, change `admin/src/lib/feedback.ts` too).
 *
 * The intended order is:
 *
 *   new       → nobody on the team has opened it yet
 *   seen      → someone has read it; the farmer knows it landed
 *   in_review → somebody is actually working on it
 *   done      → fixed / answered / shipped
 *   closed    → deliberately not acted on (duplicate, not a bug, won't fix)
 *
 * `closed` earns its place because "done" is a promise. Marking a duplicate
 * "done" tells the farmer something was fixed when nothing was, and the next
 * thing they do is ask why they still see the problem.
 *
 * This is an ORDER, not a state machine. Staff may set any of these at any
 * time — support work goes backwards (a "done" that was not done reopens) and
 * a rule that forbade it would only be worked around by editing the DB. The
 * single transition the server does enforce lives in
 * `FeedbackService.respond`: a report that has a reply on it cannot still be
 * `new`.
 */
export const FEEDBACK_STATUSES = [
  'new',
  'seen',
  'in_review',
  'done',
  'closed',
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/**
 * What the farmer is reporting. Deliberately four broad buckets, not a
 * taxonomy: the point of this feature is that a farmer can send something
 * useful in a few taps, and every extra choice is a tap that makes them
 * give up and leave a one-star review instead.
 */
export const FEEDBACK_CATEGORIES = [
  'problem', // something is wrong / broken
  'confusing', // something is unclear
  'suggestion', // an idea
  'other',
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

/** Hard cap on attachments, enforced on both the upload and the create path. */
export const MAX_ATTACHMENTS = 3;
