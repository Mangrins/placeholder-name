import { useState, useMemo } from 'react';
import { Category, Task, TaskCompletionReward } from '../../domain/types';
import { buildBlankDraft, recurrenceSummary, parseTagInput, isoFromInputDate, taskInFilter } from '../../utils/appUtils';

interface UseTasksTabProps {
  categories: Category[];
  tasks: Task[];
  createTask: (task: any) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  completeTask: (id: string) => Promise<TaskCompletionReward | undefined>;
  reopenTask: (id: string) => Promise<void>;
  taskFilter: string;
  taskSearch: string;
}

export const useTasksTab = ({
  categories,
  tasks,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  reopenTask,
  taskFilter,
  taskSearch,
}: UseTasksTabProps) => {
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState('learning');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [taskEditorOpen, setTaskEditorOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState(buildBlankDraft('learning'));
  const [subtaskInput, setSubtaskInput] = useState('');

  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    const scoped = tasks.filter((task) => taskInFilter(task, taskFilter));
    if (!q) return scoped;
    return scoped.filter((task) => {
      const hay = [
        task.title,
        task.notes,
        task.categoryId,
        task.priority,
        task.tags.join(' '),
        task.recurrenceRule ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [taskFilter, taskSearch, tasks]);

  const openTaskEditor = (task?: Task) => {
    if (!task) {
      setEditingTaskId(null);
      setTaskDraft(buildBlankDraft(categories[0]?.id ?? 'learning'));
      setSubtaskInput('');
      setTaskEditorOpen(true);
      return;
    }

    const fallbackSubtasks = task.subtaskIds.map((id, index) => ({
      id,
      title: `Step ${index + 1}`,
      done: false,
    }));
    const nextSubtasks =
      task.subtasks && task.subtasks.length > 0
        ? task.subtasks
        : fallbackSubtasks;
    const recurrenceMode: any = task.recurrence
      ? task.recurrence.kind
      : task.recurrenceRule
        ? 'custom'
        : 'none';
    const recurrenceEvery =
      task.recurrence?.kind === 'daily_interval'
        ? task.recurrence.intervalDays
        : task.recurrence?.kind === 'weekly_days'
          ? task.recurrence.intervalWeeks
          : 1;
    const recurrenceWeekdays =
      task.recurrence?.kind === 'weekly_days' &&
      task.recurrence.weekdays.length > 0
        ? task.recurrence.weekdays
        : [1];

    setEditingTaskId(task.id);
    setTaskDraft({
      title: task.title,
      categoryId: task.categoryId,
      priority: task.priority,
      deadlineAt: task.deadlineAt ? isoFromInputDate(task.deadlineAt) : '',
      estimateMinutes: task.estimateMinutes,
      tagsText: task.tags.join(', '),
      notes: task.notes,
      recurrenceMode,
      recurrenceEvery,
      recurrenceWeekdays,
      recurrenceRuleText: task.recurrenceRule ?? '',
      subtasks: nextSubtasks,
    });
    setSubtaskInput('');
    setTaskEditorOpen(true);
  };

  const saveTaskEditor = async () => {
    if (!taskDraft.title.trim()) return;

    const recurrenceEvery = Math.max(1, Math.round(taskDraft.recurrenceEvery));
    const recurrenceWeekdays = [...new Set(taskDraft.recurrenceWeekdays as number[])]
      .filter((day: number) => day >= 0 && day <= 6)
      .sort((a: number, b: number) => a - b);

    const recurrence =
      taskDraft.recurrenceMode === 'daily_interval'
        ? { kind: 'daily_interval' as const, intervalDays: recurrenceEvery }
        : taskDraft.recurrenceMode === 'weekly_days'
          ? {
              kind: 'weekly_days' as const,
              intervalWeeks: recurrenceEvery,
              weekdays:
                recurrenceWeekdays.length > 0 ? recurrenceWeekdays : [1],
            }
          : undefined;

    const payload = {
      title: taskDraft.title.trim(),
      categoryId: taskDraft.categoryId,
      priority: taskDraft.priority,
      deadlineAt: isoFromInputDate(taskDraft.deadlineAt),
      recurrence,
      recurrenceRule: recurrenceSummary(
        taskDraft.recurrenceMode,
        recurrenceEvery,
        recurrenceWeekdays,
        taskDraft.recurrenceRuleText,
      ),
      estimateMinutes: Math.max(1, Math.round(taskDraft.estimateMinutes)),
      tags: parseTagInput(taskDraft.tagsText),
      notes: taskDraft.notes,
      subtasks: taskDraft.subtasks,
      subtaskIds: taskDraft.subtasks.map((subtask: any) => subtask.id),
      parentTaskId: undefined,
    };

    if (editingTaskId) {
      await updateTask(editingTaskId, payload);
    } else {
      await createTask(payload);
    }

    setTaskEditorOpen(false);
    setEditingTaskId(null);
    setTaskDraft(buildBlankDraft(categories[0]?.id ?? 'learning'));
    setSubtaskInput('');
  };

  const showTaskCompletionFeedback = (_reward?: any) => {
    // This is handled in App.tsx, but if needed, can be moved
  };

  const handleCompleteTask = async (taskId: string) => {
    const reward = await completeTask(taskId);
    showTaskCompletionFeedback(reward);
  };

  const createQuickTask = async (): Promise<void> => {
    if (!taskTitle.trim()) return;

    await createTask({
      title: taskTitle.trim(),
      categoryId: taskCategory,
      priority: taskPriority,
      deadlineAt: isoFromInputDate(taskDeadline),
      recurrenceRule: undefined,
      estimateMinutes: 30,
      tags: [],
      notes: '',
      subtasks: [],
      subtaskIds: [],
      parentTaskId: undefined,
    });

    setTaskTitle('');
  };

  return {
    taskTitle,
    setTaskTitle,
    taskCategory,
    setTaskCategory,
    taskPriority,
    setTaskPriority,
    taskDeadline,
    setTaskDeadline,
    createQuickTask,
    openTaskEditor,
    categories,
    filteredTasks,
    deleteTask,
    handleCompleteTask,
    reopenTask,
    taskEditorOpen,
    setTaskEditorOpen,
    editingTaskId,
    taskDraft,
    setTaskDraft,
    subtaskInput,
    setSubtaskInput,
    saveTaskEditor,
  };
};