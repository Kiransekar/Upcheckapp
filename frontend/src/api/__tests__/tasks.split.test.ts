/**
 * The rules that decide what a farmer sees on the task board.
 *
 * These used to live inline in three screens (`assignedToId === me`), which is
 * how a farm-wide task with no named assignee reached nobody's Today at all
 * and a personal note reached nobody's anything. They are pure now so the
 * privacy rule in particular — a personal task never appears under "Others'" —
 * is checked directly rather than inferred from a render.
 */
import { splitTasks, taskOrigin, isRepeating, isForEveryone, dueInfo, toDueDate, taskAssignees } from '../tasks';
import type { Task } from '../tasks';

const ME = 'user-me';
const THEM = 'user-them';

const task = (over: Partial<Task> = {}): Task => ({
    id: 't1',
    farmId: 'farm-1',
    title: 'Check trays',
    type: 'OTHER',
    status: 'open',
    priority: 'medium',
    scope: 'farm',
    assigneeIds: [],
    createdById: THEM,
    createdAt: '',
    updatedAt: '',
    ...over,
});

describe('splitTasks', () => {
    it('puts a task assigned to me under mine', () => {
        const t = task({ id: 'a', assigneeIds: [ME] });
        expect(splitTasks([t], ME)).toEqual({ mine: [t], others: [] });
    });

    it('puts a task assigned to someone else under others', () => {
        const t = task({ id: 'b', assigneeIds: [THEM] });
        expect(splitTasks([t], ME)).toEqual({ mine: [], others: [t] });
    });

    // "Everyone in scope" includes me. This is the case the old
    // `assignedToId === me` filter dropped on the floor entirely.
    it('puts an unassigned (everyone) task under mine', () => {
        const t = task({ id: 'c', assigneeIds: [] });
        expect(splitTasks([t], ME).mine).toEqual([t]);
        expect(splitTasks([t], ME).others).toEqual([]);
    });

    it('keeps a multi-assignee task that includes me under mine', () => {
        const t = task({ id: 'd', assigneeIds: [THEM, ME] });
        expect(splitTasks([t], ME).mine).toEqual([t]);
    });

    it('puts MY personal task under mine', () => {
        const t = task({ id: 'e', scope: 'personal', createdById: ME, assigneeIds: [ME] });
        expect(splitTasks([t], ME).mine).toEqual([t]);
    });

    // The one thing this split must never do.
    it("never leaks anyone's personal task into others'", () => {
        const t = task({ id: 'f', scope: 'personal', createdById: THEM, assigneeIds: [THEM] });
        const { mine, others } = splitTasks([t], ME);
        expect(others).toEqual([]);
        expect(mine).toEqual([]);
    });

    it('drops recurrence templates — they are not to-dos', () => {
        const t = task({ id: 'g', isTemplate: true, recurrenceRule: 'FREQ=DAILY' });
        expect(splitTasks([t], ME)).toEqual({ mine: [], others: [] });
    });

    // The backend deploys separately from the app, so a phone will run this
    // against the single-assignee API for a while.
    it('reads the legacy assignedToId when assigneeIds is absent', () => {
        const t = { ...task({ id: 'h' }), assigneeIds: undefined, assignedToId: ME };
        expect(taskAssignees(t)).toEqual([ME]);
        expect(splitTasks([t], ME).mine).toEqual([t]);
    });
});

describe('who made it', () => {
    it('tells a task I set myself from one handed to me', () => {
        expect(taskOrigin(task({ createdById: ME }), ME)).toBe('self');
        expect(taskOrigin(task({ createdById: THEM }), ME)).toBe('assigned');
    });
});

describe('routine vs one-off', () => {
    it('marks an instance minted from a template as repeating', () => {
        expect(isRepeating(task({ parentTaskId: 'tpl-1' }))).toBe(true);
    });

    it('does not mark a one-off', () => {
        expect(isRepeating(task())).toBe(false);
    });
});

describe('isForEveryone', () => {
    it('is true only with no named assignee', () => {
        expect(isForEveryone(task({ assigneeIds: [] }))).toBe(true);
        expect(isForEveryone(task({ assigneeIds: [ME] }))).toBe(false);
    });
});

describe('dueInfo', () => {
    const now = new Date(2026, 8, 5); // 5 Sep 2026, local

    it('reads a YYYY-MM-DD as a LOCAL day, not UTC midnight', () => {
        // `new Date('2026-09-05')` is UTC midnight and reads as 4 Sep in India.
        expect(dueInfo('2026-09-05', now).kind).toBe('today');
    });

    it('names tomorrow, later and overdue', () => {
        expect(dueInfo('2026-09-06', now).kind).toBe('tomorrow');
        expect(dueInfo('2026-09-12', now).kind).toBe('later');
        expect(dueInfo('2026-09-03', now)).toMatchObject({ kind: 'overdue', days: -2 });
    });

    it('settles to none with no due date', () => {
        expect(dueInfo(null, now).kind).toBe('none');
    });
});

describe('toDueDate', () => {
    it('formats a local date without shifting the day', () => {
        expect(toDueDate(new Date(2026, 8, 5))).toBe('2026-09-05');
    });
});
