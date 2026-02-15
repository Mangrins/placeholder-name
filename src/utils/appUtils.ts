import { isToday, parseISO } from 'date-fns';

export function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function inputDateFromISO(iso?: string): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function isoFromInputDate(value: string): string | undefined {
  if (!value) return undefined;
  return `${value}T18:00:00.000Z`;
}

export function taskInFilter(task: any, filter: string): boolean {
  if (filter === 'completed') return task.status === 'done';
  if (filter === 'active') return task.status !== 'done';
  if (filter === 'today')
    return (
      task.status !== 'done' &&
      (!!task.deadlineAt ? isToday(parseISO(task.deadlineAt)) : true)
    );
  if (filter === 'upcoming')
    return (
      task.status !== 'done' &&
      !!task.deadlineAt &&
      !isToday(parseISO(task.deadlineAt))
    );
  return true;
}

export function parseTagInput(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim().replace(/^#/, ''))
    .filter(Boolean);
}

export function buildBlankDraft(defaultCategoryId: string): any {
  return {
    title: '',
    categoryId: defaultCategoryId,
    priority: 'medium',
    deadlineAt: '',
    estimateMinutes: 30,
    tagsText: '',
    notes: '',
    recurrenceMode: 'none',
    recurrenceEvery: 1,
    recurrenceWeekdays: [1],
    recurrenceRuleText: '',
    subtasks: [],
  };
}

export function recurrenceSummary(
  mode: any,
  every: number,
  weekdays: number[],
  customText: string,
): string | undefined {
  if (mode === 'custom') return customText.trim() || undefined;
  if (mode === 'daily_interval') {
    return every <= 1 ? 'Every day' : `Every ${every} days`;
  }
  if (mode === 'weekly_days') {
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const sortedDays = [...weekdays]
      .sort((a, b) => a - b)
      .map((day) => dayLabels[day])
      .filter(Boolean);
    if (sortedDays.length === 0) return undefined;
    if (every <= 1) return `Weekly: ${sortedDays.join(', ')}`;
    return `Every ${every} weeks: ${sortedDays.join(', ')}`;
  }
  return undefined;
}

export function progressPercent(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

export function heatLevel(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 20) return 1;
  if (minutes < 45) return 2;
  if (minutes < 90) return 3;
  return 4;
}