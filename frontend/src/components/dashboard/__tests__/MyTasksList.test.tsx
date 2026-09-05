/**
 * The Today card. It has one line per task and four rows total, so what that
 * line says is the whole design: when it is due, whether it is the daily
 * routine or a one-off, and whether the farmer set it themselves or a manager
 * handed it to them — the distinction the farmer asked for by name.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { MyTasksList } from '../MyTasksList';
import type { Task } from '../../../api/tasks';

const ME = 'user-me';
const BOSS = 'user-boss';

const task = (over: Partial<Task> = {}): Task => ({
    id: 't1',
    farmId: 'farm-1',
    title: 'Check trays',
    type: 'OTHER',
    status: 'open',
    priority: 'medium',
    scope: 'farm',
    assigneeIds: [ME],
    createdById: BOSS,
    createdAt: '',
    updatedAt: '',
    ...over,
});

const todayIso = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const renderList = (tasks: Task[]) =>
    render(<MyTasksList tasks={tasks} userId={ME} onOpen={jest.fn()} onSeeAll={jest.fn()} />);

it('says a task a manager assigned is assigned to you', () => {
    const { getByText } = renderList([task({ createdById: BOSS })]);
    expect(getByText(/Assigned to you/)).toBeTruthy();
});

it('says a task you set yourself is yours', () => {
    const { getByText } = renderList([task({ createdById: ME })]);
    expect(getByText(/You set this/)).toBeTruthy();
});

it('marks a personal task as visible only to you', () => {
    const { getByText } = renderList([
        task({ scope: 'personal', createdById: ME, assigneeIds: [ME] }),
    ]);
    expect(getByText(/Only you/)).toBeTruthy();
});

it('marks a repeating instance and leaves a one-off unmarked', () => {
    const { getByText } = renderList([task({ parentTaskId: 'tpl-1' })]);
    expect(getByText(/Repeats/)).toBeTruthy();

    const oneOff = renderList([task({ id: 't2' })]);
    expect(oneOff.queryByText(/Repeats/)).toBeNull();
});

it('shows the due on every row', () => {
    const { getByText } = renderList([task({ dueDate: todayIso() })]);
    expect(getByText(/Today/)).toBeTruthy();
});

it('says how overdue a late task is', () => {
    const { getByText } = renderList([task({ dueDate: '2020-01-01' })]);
    expect(getByText(/overdue/)).toBeTruthy();
});
