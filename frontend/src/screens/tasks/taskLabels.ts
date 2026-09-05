/**
 * The words on a task row, in one place.
 *
 * Home, Team and the task board all have to answer the same three questions —
 * when is it due, is it a routine daily task or a one-off, and did I set it
 * myself or did someone hand it to me. Three screens deriving that separately
 * is three chances to say it differently, which is how the app ended up with
 * three local `timeAgo` implementations.
 */
import type { TFunction } from 'i18next';

import { dueInfo, isRepeating, taskOrigin, type Task } from '../../api/tasks';
import { formatDate } from '../../utils/formatDate';

/** "Today" / "Tomorrow" / "2 d overdue" / "12 Sep". Null when there is no due. */
export const dueLabel = (
    t: TFunction,
    dueDate: string | null | undefined,
    now: Date = new Date(),
): string | null => {
    const info = dueInfo(dueDate, now);
    switch (info.kind) {
        case 'none': return null;
        case 'today': return t('tasks.dueToday');
        case 'tomorrow': return t('tasks.dueTomorrow');
        case 'overdue': return t('tasks.dueOverdue', { count: -info.days });
        default: return formatDate(info.date);
    }
};

/** True once the due date is behind us and the task is still open. */
export const isOverdue = (task: Task, now: Date = new Date()): boolean =>
    dueInfo(task.dueDate, now).kind === 'overdue' &&
    task.status !== 'done' &&
    task.status !== 'verified' &&
    task.status !== 'cancelled';

/**
 * "Daily" for an instance minted from a repeat template, nothing for a one-off.
 * The farmer asked to be able to tell a regular daily job from a special one at
 * a glance, and this is the whole of that signal.
 */
export const repeatLabel = (t: TFunction, task: Task): string | null =>
    isRepeating(task) ? t('tasks.badgeRepeating') : null;

/**
 * "You set this" vs "Assigned to you". Only meaningful on YOUR rows — on
 * someone else's task the interesting name is the assignee's, not the author's.
 */
export const originLabel = (
    t: TFunction,
    task: Task,
    userId?: string | null,
): string => (taskOrigin(task, userId) === 'self' ? t('tasks.byYou') : t('tasks.assignedToYou'));

/** The whole meta line for one of MY rows, ready to join with ' · '. */
export const myTaskMeta = (
    t: TFunction,
    task: Task,
    userId?: string | null,
    now: Date = new Date(),
): string[] =>
    [
        dueLabel(t, task.dueDate, now),
        repeatLabel(t, task),
        task.scope === 'personal' ? t('tasks.badgePersonal') : originLabel(t, task, userId),
    ].filter(Boolean) as string[];
