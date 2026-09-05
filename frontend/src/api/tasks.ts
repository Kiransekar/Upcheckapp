import apiClient from './client';

export const TASK_TYPES = [
    'FEED', 'WATER_TEST', 'SAMPLING', 'AERATOR_CHECK', 'MORTALITY_CHECK', 'HARVEST_PREP', 'OTHER',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/**
 * `farm` tasks belong to the farm and can be assigned to anyone on it.
 * `personal` tasks are the "helping myself" case the farmer asked for: created
 * by anyone, always assigned to their creator, visible to nobody else.
 */
export type TaskScope = 'farm' | 'personal';

export interface Task {
    id: string;
    farmId: string;
    pondId?: string | null;
    cropId?: string | null;
    title: string;
    description?: string | null;
    /** FEED | WATER_TEST | SAMPLING | AERATOR_CHECK | MORTALITY_CHECK | HARVEST_PREP | OTHER */
    type: string;
    /** 'open' | 'in_progress' | 'done' | 'verified' | 'cancelled' */
    status: string;
    /** 'low' | 'medium' | 'high' */
    priority: string;
    /** 'YYYY-MM-DD' */
    dueDate?: string | null;
    timeWindowStart?: string | null;
    timeWindowEnd?: string | null;
    scope?: TaskScope;
    /** EMPTY means everyone in scope (the farm, or the pond when pondId is set). */
    assigneeIds?: string[];
    /**
     * The pre-multi-assignee field. Still read because the app ships as an OTA
     * update and the backend deploys separately — a phone WILL run this against
     * an API that only knows the single-assignee shape. Read through
     * `taskAssignees`, never directly.
     */
    assignedToId?: string | null;
    createdById?: string | null;
    completedAt?: string | null;
    verifiedAt?: string | null;
    verifiedById?: string | null;
    /** A recurrence TEMPLATE. Never a to-do — it only mints instances. */
    isTemplate?: boolean;
    /** 'FREQ=DAILY' | 'FREQ=WEEKLY;BYDAY=1' */
    recurrenceRule?: string | null;
    recurrenceUntil?: string | null;
    /** Set on an instance minted from a template — this is what makes it "daily". */
    parentTaskId?: string | null;
    createdAt: string;
    updatedAt: string;
}

/** "Repeat: every day / every week", as the composer sends it. */
export interface TaskRecurrence {
    freq: 'daily' | 'weekly';
    /** 0 = Sunday. Weekly only. */
    byWeekday?: number;
    until?: string;
}

export interface CreateTaskDto {
    farmId: string;
    title: string;
    description?: string;
    type?: TaskType;
    status?: string;
    priority?: TaskPriority;
    dueDate?: string;
    timeWindowStart?: string;
    timeWindowEnd?: string;
    pondId?: string;
    cropId?: string;
    scope?: TaskScope;
    /** Omitted or `[]` = everyone in scope. */
    assigneeIds?: string[];
    /** Present ⇒ the server creates a template, not a task. */
    recurrence?: TaskRecurrence;
}

export type UpdateTaskDto = Partial<Omit<CreateTaskDto, 'farmId' | 'recurrence'>>;

export const tasksApi = {
    getAll: (farmId: string, params?: { status?: string; assignedToId?: string; scope?: TaskScope; dueBefore?: string }) =>
        apiClient.get<Task[]>('/tasks', { params: { farmId, ...params } }),

    /**
     * Everything that is MINE: assigned to me, unassigned in my scope, personal.
     * Across every accessible farm unless `farmId` narrows it — which it must
     * when a screen is scoped to one farm, or the list contradicts its filter.
     */
    getMine: (params?: { farmId?: string; scope?: TaskScope; dueBefore?: string }) =>
        apiClient.get<Task[]>('/tasks/mine', params ? { params } : undefined),

    /** The recurrence templates, so a manager can stop a daily task in one place. */
    getTemplates: (farmId: string) =>
        apiClient.get<Task[]>('/tasks/templates', { params: { farmId } }),

    getById: (id: string) => apiClient.get<Task>(`/tasks/${id}`),

    create: (data: CreateTaskDto) => apiClient.post<Task>('/tasks', data),

    update: (id: string, data: UpdateTaskDto) => apiClient.patch<Task>(`/tasks/${id}`, data),

    /** `series` also removes the template's future, not-yet-completed instances. */
    delete: (id: string, opts?: { series?: boolean }) =>
        apiClient.delete(`/tasks/${id}`, opts?.series ? { params: { series: true } } : undefined),

    /** Worker marks their assigned task done (assignee enforced server-side). */
    complete: (id: string) => apiClient.post<Task>(`/tasks/${id}/complete`, {}),

    /** Manager/owner verifies a completed task. */
    verify: (id: string) => apiClient.post<Task>(`/tasks/${id}/verify`, {}),
};

// ── Pure task logic ───────────────────────────────────────────────
// Kept out of the screens so the rules that decide what a farmer sees are
// testable without a renderer, and so Home and Team cannot drift apart.

/** Who a task is for. EMPTY means everyone in scope — not "nobody". */
export const taskAssignees = (task: Task): string[] =>
    task.assigneeIds ?? (task.assignedToId ? [task.assignedToId] : []);

/** No named assignee: the whole farm (or the whole pond) is expected to do it. */
export const isForEveryone = (task: Task): boolean => taskAssignees(task).length === 0;

/** An instance minted from a repeat template — the "regular daily task". */
export const isRepeating = (task: Task): boolean => !!task.parentTaskId;

/**
 * Did I make this for myself, or did someone hand it to me? The farmer asked
 * for the distinction explicitly. It is derived, not stored: `createdById`
 * already says it.
 */
export type TaskOrigin = 'self' | 'assigned';

export const taskOrigin = (task: Task, userId?: string | null): TaskOrigin =>
    userId && task.createdById === userId ? 'self' : 'assigned';

/**
 * "Your tasks" vs "Others' tasks".
 *
 * Yours = assigned to you, or unassigned in your scope (everyone means you),
 * or your own personal task. Theirs = farm work with a named assignee who is
 * not you. A personal task NEVER lands in "others'" — that is somebody's
 * private list, and leaking it is the one thing this split must not do.
 */
export interface TaskSplit {
    mine: Task[];
    others: Task[];
}

export const splitTasks = (tasks: Task[], userId?: string | null): TaskSplit => {
    const mine: Task[] = [];
    const others: Task[] = [];
    for (const task of tasks) {
        if (task.isTemplate) continue; // templates are not to-dos
        if (task.scope === 'personal') {
            // The server only sends you your own, but a private list is not a
            // thing to trust a filter elsewhere for.
            if (userId && task.createdById === userId) mine.push(task);
            continue;
        }
        const assignees = taskAssignees(task);
        if (assignees.length === 0 || (userId != null && assignees.includes(userId))) mine.push(task);
        else others.push(task);
    }
    return { mine, others };
};

// ── Due dates ─────────────────────────────────────────────────────

/** 'YYYY-MM-DD' → a LOCAL date. `new Date('2026-09-05')` is UTC midnight and
 *  reads as the previous day east of Greenwich, which is the entire market. */
const parseDueDate = (value: string): Date | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

export type DueKind = 'none' | 'overdue' | 'today' | 'tomorrow' | 'later';

/** `days` is whole days from today: negative = overdue by that many. */
export interface DueInfo {
    kind: DueKind;
    days: number;
    date: Date | null;
}

export const dueInfo = (
    dueDate: string | null | undefined,
    now: Date = new Date(),
): DueInfo => {
    if (!dueDate) return { kind: 'none', days: 0, date: null };
    const date = parseDueDate(dueDate);
    if (!date) return { kind: 'none', days: 0, date: null };
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round(
        (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - today.getTime()) / 86_400_000,
    );
    if (days < 0) return { kind: 'overdue', days, date };
    if (days === 0) return { kind: 'today', days, date };
    if (days === 1) return { kind: 'tomorrow', days, date };
    return { kind: 'later', days, date };
};

/** 'YYYY-MM-DD' for a local Date — what the API takes for a due date. */
export const toDueDate = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** 'FREQ=DAILY' / 'FREQ=WEEKLY;BYDAY=1' → the composer's repeat value. */
export const recurrenceLabelKey = (rule: string | null | undefined): 'daily' | 'weekly' | null => {
    if (!rule) return null;
    return /WEEKLY/i.test(rule) ? 'weekly' : 'daily';
};
