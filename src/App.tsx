import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { format, isToday, parseISO } from "date-fns";
import { useAppStore } from "./data/store";
import { getWeeklyTrends, getYearHeatmap } from "./analytics/selectors";
import { completionRateOnFocusDays, peakDayDistribution, peakHourDistribution } from "./analytics/projections";
import { buildSnapshot, todayRange } from "./snapshot/buildSnapshot";
import type { FocusSession, Quest, Task, TaskCompletionReward, TaskSubtask } from "./domain/types";

type TabId =
  | "dashboard"
  | "tasks"
  | "focus"
  | "quests"
  | "character"
  | "achievements"
  | "analytics"
  | "journal"
  | "settings";

type TimerPhase = "work" | "break" | "long_break";

interface TaskDraft {
  title: string;
  categoryId: string;
  priority: "low" | "medium" | "high";
  deadlineAt: string;
  estimateMinutes: number;
  tagsText: string;
  notes: string;
  recurrenceMode: "none" | "daily_interval" | "weekly_days" | "custom";
  recurrenceEvery: number;
  recurrenceWeekdays: number[];
  recurrenceRuleText: string;
  subtasks: TaskSubtask[];
}

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  section: string;
  keywords: string;
  run: () => void;
}

const tabItems: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "⚔" },
  { id: "tasks", label: "Tasks", icon: "☑" },
  { id: "focus", label: "Focus", icon: "⌛" },
  { id: "quests", label: "Quests", icon: "🗺" },
  { id: "character", label: "Character", icon: "🛡" },
  { id: "achievements", label: "Badges", icon: "🏆" },
  { id: "analytics", label: "Analytics", icon: "📈" },
  { id: "journal", label: "Journal", icon: "✎" },
  { id: "settings", label: "Settings", icon: "⚙" }
];

const timerPresets = [
  { name: "Classic 25/5", work: 25, break: 5, longBreak: 15, everyN: 4 },
  { name: "Power 50/10", work: 50, break: 10, longBreak: 20, everyN: 3 },
  { name: "Deep 90/20", work: 90, break: 20, longBreak: 30, everyN: 2 }
] as const;

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const statMeta: Record<string, { icon: string; label: string }> = {
  strength: { icon: "⚔", label: "Strength" },
  vitality: { icon: "♥", label: "Vitality" },
  intellect: { icon: "✦", label: "Intellect" },
  creativity: { icon: "✎", label: "Creativity" },
  discipline: { icon: "⌘", label: "Discipline" },
  social: { icon: "☻", label: "Social" }
};

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function rankFromLevel(level: number): string {
  if (level <= 10) return "E-Rank Novice";
  if (level <= 20) return "D-Rank Initiate";
  if (level <= 35) return "C-Rank Hunter";
  if (level <= 50) return "B-Rank Vanguard";
  return "A-Rank Ascendant";
}

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(total % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function inputDateFromISO(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function isoFromInputDate(value: string): string | undefined {
  if (!value) return undefined;
  return `${value}T18:00:00.000Z`;
}

function taskInFilter(task: Task, filter: string): boolean {
  if (filter === "completed") return task.status === "done";
  if (filter === "active") return task.status !== "done";
  if (filter === "today") return task.status !== "done" && (!!task.deadlineAt ? isToday(parseISO(task.deadlineAt)) : true);
  if (filter === "upcoming") return task.status !== "done" && !!task.deadlineAt && !isToday(parseISO(task.deadlineAt));
  return true;
}

function parseTagInput(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);
}

function progressPercent(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

function heatLevel(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 20) return 1;
  if (minutes < 45) return 2;
  if (minutes < 90) return 3;
  return 4;
}

function buildBlankDraft(defaultCategoryId: string): TaskDraft {
  return {
    title: "",
    categoryId: defaultCategoryId,
    priority: "medium",
    deadlineAt: "",
    estimateMinutes: 30,
    tagsText: "",
    notes: "",
    recurrenceMode: "none",
    recurrenceEvery: 1,
    recurrenceWeekdays: [1],
    recurrenceRuleText: "",
    subtasks: []
  };
}

function recurrenceSummary(
  mode: TaskDraft["recurrenceMode"],
  every: number,
  weekdays: number[],
  customText: string
): string | undefined {
  if (mode === "custom") return customText.trim() || undefined;
  if (mode === "daily_interval") {
    return every <= 1 ? "Every day" : `Every ${every} days`;
  }
  if (mode === "weekly_days") {
    const sortedDays = [...weekdays].sort((a, b) => a - b).map((day) => dayLabels[day]).filter(Boolean);
    if (sortedDays.length === 0) return undefined;
    if (every <= 1) return `Weekly: ${sortedDays.join(", ")}`;
    return `Every ${every} weeks: ${sortedDays.join(", ")}`;
  }
  return undefined;
}

export default function App(): JSX.Element {
  const {
    init,
    ready,
    tasks,
    categories,
    quests,
    achievements,
    achievementProgress,
    profile,
    character,
    settings,
    streaks,
    activeTab,
    setActiveTab,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    reopenTask,
    addFocusSession,
    createQuest,
    updateQuest,
    updateTimerSettings,
    resetLifetimeXp
  } = useAppStore();

  const [taskFilter, setTaskFilter] = useState("today");
  const [taskSearch, setTaskSearch] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskCategory, setTaskCategory] = useState("learning");
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [taskDeadline, setTaskDeadline] = useState("");

  const [taskEditorOpen, setTaskEditorOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(buildBlankDraft("learning"));
  const [subtaskInput, setSubtaskInput] = useState("");

  const [timerPhase, setTimerPhase] = useState<TimerPhase>("work");
  const [timerRunning, setTimerRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [sessionCount, setSessionCount] = useState(0);
  const [focusExpanded, setFocusExpanded] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState("");
  const [focusLabel, setFocusLabel] = useState("General Focus");

  const [customWork, setCustomWork] = useState(25);
  const [customBreak, setCustomBreak] = useState(5);
  const [customLongBreak, setCustomLongBreak] = useState(15);
  const [customEveryN, setCustomEveryN] = useState(4);

  const [questTitle, setQuestTitle] = useState("");
  const [questKind, setQuestKind] = useState<Quest["kind"]>("daily");
  const [questObjectiveType, setQuestObjectiveType] = useState<Quest["objectiveType"]>("task_completions");
  const [questTarget, setQuestTarget] = useState(3);
  const [questRewardXp, setQuestRewardXp] = useState(80);
  const [questCategoryId, setQuestCategoryId] = useState("");

  const [weeklyTrend, setWeeklyTrend] = useState<Array<{ date: string; focus: number; completions: number }>>([]);
  const [yearHeatmap, setYearHeatmap] = useState<Array<{ date: string; minutes: number }>>([]);
  const [peakHours, setPeakHours] = useState<number[]>(Array.from({ length: 24 }, () => 0));
  const [peakDays, setPeakDays] = useState<number[]>(Array.from({ length: 7 }, () => 0));
  const [focusDayCompletionRate, setFocusDayCompletionRate] = useState(0);
  const [snapshotPreview, setSnapshotPreview] = useState("");

  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [taskCompletionFeedback, setTaskCompletionFeedback] = useState("");

  const timerInitialized = useRef(false);

  const timerSettings = settings?.timer ?? {
    workMin: 25,
    breakMin: 5,
    longBreakMin: 15,
    everyN: 4
  };

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (!ready || timerInitialized.current) return;
    setSecondsLeft(timerSettings.workMin * 60);
    setCustomWork(timerSettings.workMin);
    setCustomBreak(timerSettings.breakMin);
    setCustomLongBreak(timerSettings.longBreakMin);
    setCustomEveryN(timerSettings.everyN);
    timerInitialized.current = true;
  }, [ready, timerSettings.breakMin, timerSettings.everyN, timerSettings.longBreakMin, timerSettings.workMin]);

  useEffect(() => {
    const run = async () => {
      const [trend, heat, hourDist, dayDist, rate] = await Promise.all([
        getWeeklyTrends(),
        getYearHeatmap(new Date().getFullYear()),
        peakHourDistribution(),
        peakDayDistribution(),
        completionRateOnFocusDays()
      ]);
      setWeeklyTrend(trend);
      setYearHeatmap(heat);
      setPeakHours(hourDist);
      setPeakDays(dayDist);
      setFocusDayCompletionRate(rate);
    };

    if (ready) {
      void run();
    }
  }, [ready, tasks, quests, character]);

  useEffect(() => {
    if (!timerRunning || secondsLeft <= 0) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [secondsLeft, timerRunning]);

  useEffect(() => {
    if (!taskCompletionFeedback) return;
    const timeout = window.setTimeout(() => {
      setTaskCompletionFeedback("");
    }, 3400);
    return () => window.clearTimeout(timeout);
  }, [taskCompletionFeedback]);

  useEffect(() => {
    if (!timerRunning || secondsLeft !== 0) return;

    const finishPhase = async () => {
      if (timerPhase === "work") {
        const linkedTask = tasks.find((task) => task.id === focusTaskId);
        const categoryId = linkedTask?.categoryId ?? taskCategory;
        const now = new Date();
        const startedAt = new Date(now.getTime() - timerSettings.workMin * 60 * 1000).toISOString();
        const session: FocusSession = {
          id: makeId(),
          label: focusLabel.trim() || "General Focus",
          taskId: linkedTask?.id,
          categoryId,
          startedAt,
          endedAt: now.toISOString(),
          durationMin: timerSettings.workMin,
          type: "work",
          completed: true
        };
        await addFocusSession(session);

        const nextSessionCount = sessionCount + 1;
        setSessionCount(nextSessionCount);
        const useLongBreak = nextSessionCount % Math.max(2, timerSettings.everyN) === 0;
        setTimerPhase(useLongBreak ? "long_break" : "break");
        setSecondsLeft((useLongBreak ? timerSettings.longBreakMin : timerSettings.breakMin) * 60);
        setTimerRunning(false);
        return;
      }

      setTimerPhase("work");
      setSecondsLeft(timerSettings.workMin * 60);
      setTimerRunning(false);
    };

    void finishPhase();
  }, [
    addFocusSession,
    focusLabel,
    focusTaskId,
    secondsLeft,
    sessionCount,
    taskCategory,
    tasks,
    timerPhase,
    timerRunning,
    timerSettings.breakMin,
    timerSettings.everyN,
    timerSettings.longBreakMin,
    timerSettings.workMin
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const meta = event.metaKey || event.ctrlKey;

      if (meta && key === "k") {
        event.preventDefault();
        setCommandQuery("");
        setCommandOpen(true);
        return;
      }

      if (meta && key === "n") {
        event.preventDefault();
        setActiveTab("tasks");
        const input = document.getElementById("task-quick-add") as HTMLInputElement | null;
        input?.focus();
      }

      if (!commandOpen) return;

      if (key === "escape") {
        event.preventDefault();
        setCommandOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandOpen, setActiveTab]);

  const level = character?.level ?? 1;
  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    const scoped = tasks.filter((task) => taskInFilter(task, taskFilter));
    if (!q) return scoped;
    return scoped.filter((task) => {
      const hay = [task.title, task.notes, task.categoryId, task.priority, task.tags.join(" "), task.recurrenceRule ?? ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [taskFilter, taskSearch, tasks]);

  const heatmapMeta = useMemo(() => {
    const year = new Date().getFullYear();
    const byDate = new Map(yearHeatmap.map((row) => [row.date, row.minutes]));
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const cells: Array<{ date: string; minutes: number } | null> = [];
    const monthLabelsByCol = new Map<number, string>();

    for (let i = 0; i < start.getDay(); i += 1) {
      cells.push(null);
    }

    const cursor = new Date(start);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      if (cursor.getDate() === 1) {
        const col = Math.floor(cells.length / 7);
        monthLabelsByCol.set(col, format(cursor, "MMM"));
      }
      cells.push({ date: key, minutes: byDate.get(key) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    const columns = Math.max(1, Math.ceil(cells.length / 7));
    const monthLabels = Array.from({ length: columns }, (_, col) => monthLabelsByCol.get(col) ?? "");

    return { cells, columns, monthLabels };
  }, [yearHeatmap]);

  const weeklyFocus = weeklyTrend.reduce((sum, day) => sum + day.focus, 0);
  const weeklyCompletions = weeklyTrend.reduce((sum, day) => sum + day.completions, 0);
  const avgDailyFocus = weeklyTrend.length > 0 ? Math.round(weeklyFocus / weeklyTrend.length) : 0;
  const bestFocusDay = weeklyTrend.reduce<{ date: string; focus: number } | null>((best, day) => {
    if (!best || day.focus > best.focus) return { date: day.date, focus: day.focus };
    return best;
  }, null);

  const peakHourIndex = peakHours.reduce((best, value, idx, arr) => (value > arr[best] ? idx : best), 0);
  const peakDayIndex = peakDays.reduce((best, value, idx, arr) => (value > arr[best] ? idx : best), 0);
  const phaseTotalSeconds =
    timerPhase === "work"
      ? timerSettings.workMin * 60
      : timerPhase === "break"
        ? timerSettings.breakMin * 60
        : timerSettings.longBreakMin * 60;
  const ringProgressRatio =
    phaseTotalSeconds > 0 ? Math.max(0, Math.min(1, (phaseTotalSeconds - secondsLeft) / phaseTotalSeconds)) : 0;
  const ringProgressDeg = `${Math.round(ringProgressRatio * 360)}deg`;
  const isFocusCollapsed = timerRunning && !focusExpanded;

  const openTasks = tasks.filter((task) => task.status !== "done");
  const weeklyFocusPeak = Math.max(1, ...weeklyTrend.map((item) => item.focus));
  const weeklyCompletionPeak = Math.max(1, ...weeklyTrend.map((item) => item.completions));
  const peakHourMax = Math.max(1, ...peakHours);
  const peakDayTotal = peakDays.reduce((sum, value) => sum + value, 0);
  const peakDaySharePct = peakDayTotal > 0 ? Math.round(((peakDays[peakDayIndex] ?? 0) / peakDayTotal) * 100) : 0;

  const openTaskEditor = (task?: Task) => {
    if (!task) {
      setEditingTaskId(null);
      setTaskDraft(buildBlankDraft(categories[0]?.id ?? "learning"));
      setSubtaskInput("");
      setTaskEditorOpen(true);
      return;
    }

    const fallbackSubtasks = task.subtaskIds.map((id, index) => ({ id, title: `Step ${index + 1}`, done: false }));
    const nextSubtasks = task.subtasks && task.subtasks.length > 0 ? task.subtasks : fallbackSubtasks;
    const recurrenceMode: TaskDraft["recurrenceMode"] = task.recurrence
      ? task.recurrence.kind
      : task.recurrenceRule
        ? "custom"
        : "none";
    const recurrenceEvery =
      task.recurrence?.kind === "daily_interval"
        ? task.recurrence.intervalDays
        : task.recurrence?.kind === "weekly_days"
          ? task.recurrence.intervalWeeks
          : 1;
    const recurrenceWeekdays =
      task.recurrence?.kind === "weekly_days" && task.recurrence.weekdays.length > 0 ? task.recurrence.weekdays : [1];

    setEditingTaskId(task.id);
    setTaskDraft({
      title: task.title,
      categoryId: task.categoryId,
      priority: task.priority,
      deadlineAt: inputDateFromISO(task.deadlineAt),
      estimateMinutes: task.estimateMinutes,
      tagsText: task.tags.join(", "),
      notes: task.notes,
      recurrenceMode,
      recurrenceEvery,
      recurrenceWeekdays,
      recurrenceRuleText: task.recurrenceRule ?? "",
      subtasks: nextSubtasks
    });
    setSubtaskInput("");
    setTaskEditorOpen(true);
  };

  const saveTaskEditor = async () => {
    if (!taskDraft.title.trim()) return;

    const recurrenceEvery = Math.max(1, Math.round(taskDraft.recurrenceEvery));
    const recurrenceWeekdays = [...new Set(taskDraft.recurrenceWeekdays)]
      .filter((day) => day >= 0 && day <= 6)
      .sort((a, b) => a - b);

    const recurrence =
      taskDraft.recurrenceMode === "daily_interval"
        ? { kind: "daily_interval" as const, intervalDays: recurrenceEvery }
        : taskDraft.recurrenceMode === "weekly_days"
          ? {
              kind: "weekly_days" as const,
              intervalWeeks: recurrenceEvery,
              weekdays: recurrenceWeekdays.length > 0 ? recurrenceWeekdays : [1]
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
        taskDraft.recurrenceRuleText
      ),
      estimateMinutes: Math.max(1, Math.round(taskDraft.estimateMinutes)),
      tags: parseTagInput(taskDraft.tagsText),
      notes: taskDraft.notes,
      subtasks: taskDraft.subtasks,
      subtaskIds: taskDraft.subtasks.map((subtask) => subtask.id)
    };

    if (editingTaskId) {
      await updateTask(editingTaskId, payload);
    } else {
      await createTask({ ...payload, parentTaskId: undefined });
    }

    setTaskEditorOpen(false);
    setEditingTaskId(null);
    setTaskDraft(buildBlankDraft(categories[0]?.id ?? "learning"));
    setSubtaskInput("");
  };

  const showTaskCompletionFeedback = (reward?: TaskCompletionReward) => {
    if (!reward) return;
    const statParts = Object.entries(reward.statGains)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] > 0)
      .map(([stat, value]) => `+${value} ${stat}`);
    const statSummary = statParts.length > 0 ? statParts.join(" • ") : "minor stat gains";
    const levelSummary =
      reward.levelAfter > reward.levelBefore ? ` • Level up ${reward.levelBefore} → ${reward.levelAfter}` : "";

    setTaskCompletionFeedback(`+${reward.xpGain} XP • ${statSummary}${levelSummary}`);
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
      notes: "",
      subtasks: [],
      subtaskIds: [],
      parentTaskId: undefined
    });

    setTaskTitle("");
  };

  const applyTimerPreset = async (presetName: string) => {
    const preset = timerPresets.find((item) => item.name === presetName);
    if (!preset) return;

    await updateTimerSettings({
      workMin: preset.work,
      breakMin: preset.break,
      longBreakMin: preset.longBreak,
      everyN: preset.everyN
    });

    setCustomWork(preset.work);
    setCustomBreak(preset.break);
    setCustomLongBreak(preset.longBreak);
    setCustomEveryN(preset.everyN);
    setTimerPhase("work");
    setSecondsLeft(preset.work * 60);
    setTimerRunning(false);
  };

  const saveCustomTimer = async () => {
    const patch = {
      workMin: Math.max(5, Math.min(180, Math.round(customWork))),
      breakMin: Math.max(2, Math.min(45, Math.round(customBreak))),
      longBreakMin: Math.max(5, Math.min(60, Math.round(customLongBreak))),
      everyN: Math.max(2, Math.min(8, Math.round(customEveryN)))
    };

    await updateTimerSettings(patch);
    if (!timerRunning) {
      if (timerPhase === "work") setSecondsLeft(patch.workMin * 60);
      if (timerPhase === "break") setSecondsLeft(patch.breakMin * 60);
      if (timerPhase === "long_break") setSecondsLeft(patch.longBreakMin * 60);
    }
  };

  const skipBreak = () => {
    if (timerPhase === "work") return;
    setTimerPhase("work");
    setTimerRunning(false);
    setSecondsLeft(timerSettings.workMin * 60);
  };

  const toggleFocusTimer = () => {
    setTimerRunning((prev) => {
      const next = !prev;
      if (next) setFocusExpanded(false);
      return next;
    });
  };

  const resetFocusTimer = () => {
    setTimerRunning(false);
    setTimerPhase("work");
    setSecondsLeft(timerSettings.workMin * 60);
  };

  const submitQuest = async () => {
    if (!questTitle.trim()) return;

    await createQuest({
      title: questTitle.trim(),
      kind: questKind,
      objectiveType: questObjectiveType,
      target: questTarget,
      rewardXp: questRewardXp,
      objectiveCategoryId: questObjectiveType === "category_balance" ? questCategoryId || undefined : undefined
    });

    setQuestTitle("");
  };

  const runSnapshot = () => {
    void buildSnapshot(todayRange()).then((snapshot) => {
      setSnapshotPreview(JSON.stringify(snapshot, null, 2));
    });
  };

  const commandItems = useMemo<CommandItem[]>(() => {
    const navCommands = tabItems.map((item) => ({
      id: `nav-${item.id}`,
      label: `Go to ${item.label}`,
      hint: item.icon,
      section: "Navigation",
      keywords: `${item.id} ${item.label}`,
      run: () => {
        setActiveTab(item.id);
        setCommandOpen(false);
      }
    }));

    return [
      ...navCommands,
      {
        id: "new-task",
        label: "Open task editor",
        hint: "Ctrl/Cmd+N",
        section: "Actions",
        keywords: "new task create",
        run: () => {
          setActiveTab("tasks");
          openTaskEditor();
          setCommandOpen(false);
        }
      },
      {
        id: "timer-toggle",
        label: timerRunning ? "Pause focus timer" : "Start focus timer",
        hint: "Space",
        section: "Actions",
        keywords: "focus timer pause start",
        run: () => {
          setActiveTab("focus");
          setTimerRunning((prev) => {
            const next = !prev;
            if (next) setFocusExpanded(false);
            return next;
          });
          setCommandOpen(false);
        }
      },
      {
        id: "skip-break",
        label: "Skip current break",
        section: "Actions",
        keywords: "skip break long",
        run: () => {
          setActiveTab("focus");
          skipBreak();
          setCommandOpen(false);
        }
      },
      {
        id: "snapshot",
        label: "Build snapshot preview",
        section: "Utilities",
        keywords: "snapshot privacy export",
        run: () => {
          setActiveTab("settings");
          runSnapshot();
          setCommandOpen(false);
        }
      }
    ];
  }, [timerRunning]);

  const filteredCommands = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    if (!q) return commandItems;
    return commandItems.filter((item) => `${item.label} ${item.keywords} ${item.section}`.toLowerCase().includes(q));
  }, [commandItems, commandQuery]);

  if (!ready) {
    return <div className="loading">Forging your hunter profile...</div>;
  }

  const activeQuestProgress = quests
    .filter((quest) => quest.status === "active")
    .map((quest) => ({ id: quest.id, title: quest.title, percent: progressPercent(quest.progress, quest.target) }));

  const unlockedBadges = achievements.filter((achievement) => !!achievementProgress[achievement.id]?.unlockedAt).length;

  return (
    <div className="app-shell">
      <aside className="left-nav">
        <div className="brand">RPG Productivity</div>
        <div className="profile-block">
          <div className="avatar" aria-hidden="true" />
          <div>
            <div className="name">{profile?.displayName}</div>
            <div className="muted">{rankFromLevel(level)}</div>
          </div>
        </div>

        <nav>
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? "nav-btn active" : "nav-btn"}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="nav-icon" aria-hidden="true">
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="hint">
          Command palette: <kbd>Ctrl/Cmd + K</kbd>
          <br />
          Quick add task: <kbd>Ctrl/Cmd + N</kbd>
        </div>
      </aside>

      <main className="main-content">
        {taskCompletionFeedback && (
          <motion.section
            className="panel reward-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <strong>Task Complete</strong>
            <span>{taskCompletionFeedback}</span>
          </motion.section>
        )}

        <motion.section
          className="panel hero"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div>
            <h1>{profile?.title}</h1>
            <p>
              Level {level} • Prestige {character?.prestigeRank ?? 0} • Lifetime XP {character?.xpLifetime ?? 0}
            </p>
          </div>
          {activeTab !== "focus" && (
            <div className="stat-grid stat-grid-upgraded">
              {Object.entries(character?.stats ?? {}).map(([stat, value]) => (
                <div className="chip stat-chip" key={stat}>
                  <div className="stat-chip-head">
                    <span className="stat-chip-label">{statMeta[stat]?.label ?? stat}</span>
                  </div>
                  <div className="stat-chip-value-row">
                    <strong className="stat-chip-value">{value}</strong>
                    <span className="stat-chip-icon" aria-hidden="true">
                      {statMeta[stat]?.icon ?? "◈"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {activeTab === "dashboard" && (
          <section className="panel-grid">
            <article className="panel">
              <h3>Quest Momentum</h3>
              {activeQuestProgress.slice(0, 4).map((quest) => (
                <div key={quest.id} className="progress-row">
                  <span>{quest.title}</span>
                  <span>{quest.percent}%</span>
                </div>
              ))}
              {activeQuestProgress.length === 0 && <p className="muted">All tracked quests are complete. Create new custom quests.</p>}
            </article>

            <article className="panel">
              <h3>Weekly Summary</h3>
              <div className="progress-row">
                <span>Focus minutes</span>
                <strong>{weeklyFocus}m</strong>
              </div>
              <div className="mini-progress">
                <span style={{ width: `${Math.min(100, Math.round((weeklyFocus / Math.max(1, timerSettings.workMin * 7)) * 100))}%` }} />
              </div>
              <div className="progress-row">
                <span>Task completions</span>
                <strong>{weeklyCompletions}</strong>
              </div>
              <div className="mini-progress">
                <span style={{ width: `${Math.min(100, Math.round((weeklyCompletions / 28) * 100))}%` }} />
              </div>
              <div className="progress-row">
                <span>Focus-day completion rate</span>
                <strong>{focusDayCompletionRate}%</strong>
              </div>
              <div className="mini-progress">
                <span style={{ width: `${focusDayCompletionRate}%` }} />
              </div>
              <div className="progress-row">
                <span>Peak hour</span>
                <strong>{String(peakHourIndex).padStart(2, "0")}:00</strong>
              </div>
            </article>

            <article className="panel">
              <h3>Immersion Status</h3>
              <p className="lead-text">
                Streaks: <strong>{streaks?.taskDays ?? 0}</strong> task days • <strong>{streaks?.focusDays ?? 0}</strong> focus days
              </p>
              <p className="lead-text">
                Badges unlocked: <strong>{unlockedBadges}</strong> / {achievements.length}
              </p>
              <p className="muted">Use custom quests and subtask-rich task planning to build stronger progression loops.</p>
            </article>
          </section>
        )}

        {activeTab === "tasks" && (
          <section className="panel-grid tasks-layout">
            <article className="panel">
              <h3>Quick Add Task</h3>
              <div className="form-grid">
                <input
                  id="task-quick-add"
                  placeholder="Defeat backlog item..."
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void createQuickTask();
                  }}
                />
                <select value={taskCategory} onChange={(event) => setTaskCategory(event.target.value)}>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as "low" | "medium" | "high")}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <input className="date-themed" type="date" value={taskDeadline} onChange={(event) => setTaskDeadline(event.target.value)} />
                <div className="row">
                  <button onClick={() => void createQuickTask()}>Create</button>
                  <button className="ghost" onClick={() => openTaskEditor()}>
                    Advanced editor
                  </button>
                </div>
              </div>
            </article>

            <article className="panel">
              <div className="row space wrap">
                <h3>Task Board</h3>
                <div className="row wrap">
                  {(["today", "upcoming", "active", "completed", "all"] as const).map((filter) => (
                    <button
                      key={filter}
                      className={taskFilter === filter ? "pill active" : "pill"}
                      onClick={() => setTaskFilter(filter)}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="row" style={{ marginBottom: "0.7rem" }}>
                <input
                  value={taskSearch}
                  onChange={(event) => setTaskSearch(event.target.value)}
                  placeholder="Search title, notes, tags, recurrence..."
                />
              </div>

              <div className="task-list">
                {filteredTasks.map((task) => {
                  const subtaskDone = task.subtasks?.filter((subtask) => subtask.done).length ?? 0;
                  const subtaskTotal = task.subtasks?.length ?? 0;
                  const deadline = task.deadlineAt ? format(new Date(task.deadlineAt), "MMM dd") : null;

                  return (
                    <div key={task.id} className={task.status === "done" ? "task-row done" : "task-row"}>
                      <div>
                        <strong>{task.title}</strong>
                        <div className="muted">
                          {task.categoryId} • {task.priority}
                          {deadline ? ` • due ${deadline}` : ""}
                          {task.recurrenceRule ? ` • ${task.recurrenceRule}` : ""}
                        </div>
                        {subtaskTotal > 0 && (
                          <div className="muted">
                            Checklist: {subtaskDone}/{subtaskTotal}
                          </div>
                        )}
                        {task.tags.length > 0 && (
                          <div className="row wrap" style={{ marginTop: "0.2rem" }}>
                            {task.tags.map((tag) => (
                              <span key={tag} className="badge">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="row wrap">
                        <button className="small ghost" onClick={() => openTaskEditor(task)}>
                          Edit
                        </button>
                        <button className="small ghost" onClick={() => void deleteTask(task.id)}>
                          Delete
                        </button>
                        {task.status !== "done" ? (
                          <button className="small" onClick={() => void handleCompleteTask(task.id)}>
                            Complete
                          </button>
                        ) : (
                          <button className="small" onClick={() => void reopenTask(task.id)}>
                            Uncheck
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredTasks.length === 0 && <div className="muted">No tasks match this filter.</div>}
              </div>
            </article>
          </section>
        )}

        {activeTab === "focus" && (
          <section className={isFocusCollapsed ? "panel-grid focus-layout focus-layout-collapsed" : "panel-grid focus-layout"}>
            <article className="panel focus-hero">
              <h3>Pomodoro Nexus</h3>
              <div className={isFocusCollapsed ? "focus-core focus-core-collapsed" : "focus-core"}>
                <div
                  className={timerRunning ? "focus-ring-shell running" : "focus-ring-shell"}
                  style={{ ["--ring-progress" as string]: ringProgressDeg } as React.CSSProperties}
                  role="button"
                  tabIndex={0}
                  aria-label={timerRunning ? "Pause focus timer" : "Start focus timer"}
                  onClick={toggleFocusTimer}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleFocusTimer();
                    }
                  }}
                >
                  <div className="focus-ring-track" />
                  <div className="focus-ring-progress" />
                  <div className="focus-ring-core">
                    <span className="focus-ring-time">{formatSeconds(secondsLeft)}</span>
                  </div>
                </div>
                {!isFocusCollapsed && (
                  <div className="focus-main">
                    <div className="focus-phase-line">
                      Phase: <strong>{timerPhase.replace("_", " ")}</strong> • Linked: <strong>{focusTaskId ? "Task linked" : "General focus"}</strong>
                    </div>
                    <div className="focus-phase-line">
                      Today: <strong>{weeklyTrend[weeklyTrend.length - 1]?.focus ?? 0} min</strong> • Cycles: <strong>{sessionCount}</strong> (long break every {timerSettings.everyN})
                    </div>
                    <div className="focus-inline-actions">
                      <button className="focus-action" onClick={toggleFocusTimer}>
                        {timerRunning ? "Pause" : "Start"}
                      </button>
                      <button className="focus-action ghost" onClick={resetFocusTimer}>
                        Reset
                      </button>
                    </div>
                  </div>
                )}
                {isFocusCollapsed && (
                  <div className="focus-collapsed-cta">
                    <button className="focus-action ghost" onClick={() => setFocusExpanded(true)}>
                      Show controls
                    </button>
                  </div>
                )}
              </div>

              {!isFocusCollapsed && (
                <>
                  <div className="divider" />

                  <div className="row wrap" style={{ marginTop: "0.5rem" }}>
                    <span className="badge">Peak hour {String(peakHourIndex).padStart(2, "0")}:00</span>
                    <span className="badge">Sessions {sessionCount}</span>
                    <button className="small ghost" disabled={timerPhase === "work"} onClick={skipBreak}>
                      Skip break
                    </button>
                    {timerRunning && (
                      <button className="small ghost" onClick={() => setFocusExpanded(false)}>
                        Collapse to timer
                      </button>
                    )}
                  </div>

                  <div className="divider" />

                  <div className="focus-controls-grid">
                    <div className="focus-pane">
                      <label className="label">Presets</label>
                      <div className="row wrap" style={{ marginBottom: "0.4rem" }}>
                        {timerPresets.map((preset) => (
                          <button key={preset.name} className="small focus-pill" onClick={() => void applyTimerPreset(preset.name)}>
                            {preset.work}/{preset.break}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="focus-pane">
                      <label className="label">Session label</label>
                      <input value={focusLabel} onChange={(event) => setFocusLabel(event.target.value)} placeholder="Deep work: chapter draft" />
                      <label className="label">Link task (optional)</label>
                      <select value={focusTaskId} onChange={(event) => setFocusTaskId(event.target.value)}>
                        <option value="">No linked task</option>
                        {openTasks.slice(0, 60).map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.title}
                          </option>
                        ))}
                      </select>
                      <p className="muted" style={{ marginTop: "0.45rem" }}>
                        Linking boosts the linked task&apos;s stat on completion.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </article>

            {!isFocusCollapsed && (
              <article className="panel focus-config">
                <h3>Custom Timer Configuration</h3>
                <div className="form-grid focus-config-grid">
                  <div className="row">
                    <label className="label">Work</label>
                    <input type="number" min={5} max={180} value={customWork} onChange={(event) => setCustomWork(Number(event.target.value))} />
                  </div>
                  <div className="row">
                    <label className="label">Break</label>
                    <input type="number" min={2} max={45} value={customBreak} onChange={(event) => setCustomBreak(Number(event.target.value))} />
                  </div>
                  <div className="row">
                    <label className="label">Long break</label>
                    <input
                      type="number"
                      min={5}
                      max={60}
                      value={customLongBreak}
                      onChange={(event) => setCustomLongBreak(Number(event.target.value))}
                    />
                  </div>
                  <div className="row">
                    <label className="label">Long break every N sessions</label>
                    <input type="number" min={2} max={8} value={customEveryN} onChange={(event) => setCustomEveryN(Number(event.target.value))} />
                  </div>
                  <button className="small" onClick={() => void saveCustomTimer()}>
                    Apply
                  </button>
                </div>
                <p className="muted" style={{ marginTop: "0.65rem" }}>
                  Focus session completions automatically log XP and feed analytics. Skipping breaks keeps momentum when needed.
                </p>
              </article>
            )}
          </section>
        )}

        {activeTab === "quests" && (
          <section className="panel-grid">
            <article className="panel">
              <h3>Create Custom Quest</h3>
              <div className="form-grid">
                <input value={questTitle} onChange={(event) => setQuestTitle(event.target.value)} placeholder="Quest title" />
                <select value={questKind} onChange={(event) => setQuestKind(event.target.value as Quest["kind"])}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="storyline">Storyline</option>
                  <option value="boss">Boss</option>
                </select>
                <select
                  value={questObjectiveType}
                  onChange={(event) => setQuestObjectiveType(event.target.value as Quest["objectiveType"])}
                >
                  <option value="task_completions">Task completions</option>
                  <option value="focus_minutes">Focus minutes</option>
                  <option value="category_balance">Category completions</option>
                </select>
                {questObjectiveType === "category_balance" && (
                  <select value={questCategoryId} onChange={(event) => setQuestCategoryId(event.target.value)}>
                    <option value="">Any category count</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                )}
                <div className="row">
                  <input
                    type="number"
                    min={1}
                    value={questTarget}
                    onChange={(event) => setQuestTarget(Math.max(1, Number(event.target.value)))}
                  />
                  <input
                    type="number"
                    min={1}
                    value={questRewardXp}
                    onChange={(event) => setQuestRewardXp(Math.max(1, Number(event.target.value)))}
                  />
                </div>
                <div className="row">
                  <button onClick={() => void submitQuest()}>Create quest</button>
                </div>
              </div>
            </article>

            <article className="panel">
              <h3>Quest Log</h3>
              <div className="task-list">
                {quests.map((quest) => {
                  const percent = progressPercent(quest.progress, quest.target);
                  return (
                    <div key={quest.id} className="quest-card">
                      <div className="row space wrap">
                        <strong>{quest.title}</strong>
                        <span className={quest.status === "complete" ? "badge" : "pill"}>{quest.status}</span>
                      </div>
                      <div className="muted">
                        {quest.kind} • {quest.objectiveType.replace("_", " ")} • reward {quest.reward.xp} XP
                      </div>
                      <div className="progress-bar">
                        <span style={{ width: `${percent}%` }} />
                      </div>
                      <div className="row space">
                        <small>
                          {quest.progress}/{quest.target}
                        </small>
                        {quest.status !== "complete" && (
                          <button
                            className="small"
                            onClick={() => {
                              void updateQuest(quest.id, { status: "complete", progress: quest.target });
                            }}
                          >
                            Mark complete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          </section>
        )}

        {activeTab === "character" && (
          <section className="panel-grid">
            <article className="panel">
              <h3>Rank + Progression</h3>
              <p className="lead-text">Current rank: {rankFromLevel(level)}</p>
              <p className="muted">XP lifetime: {character?.xpLifetime ?? 0}</p>
              <p className="muted">Season cap: {character?.seasonCap ?? 60}</p>
              <p className="muted">Task streak: {streaks?.taskDays ?? 0} days</p>
              <p className="muted">Focus streak: {streaks?.focusDays ?? 0} days</p>
            </article>
            <article className="panel">
              <h3>Build Direction</h3>
              <p className="muted">Peak day: {dayLabels[peakDayIndex]} • Peak hour: {String(peakHourIndex).padStart(2, "0")}:00</p>
              <div className="mini-progress">
                <span style={{ width: `${peakDaySharePct}%` }} />
              </div>
              <p className="muted">Best focus day in recent data: {bestFocusDay?.date ?? "n/a"}</p>
              <p className="muted">Average daily focus: {avgDailyFocus}m</p>
              <div className="mini-progress">
                <span style={{ width: `${Math.min(100, Math.round((avgDailyFocus / 120) * 100))}%` }} />
              </div>
            </article>
          </section>
        )}

        {activeTab === "achievements" && (
          <section className="panel">
            <h3>Trophy Room</h3>
            <p className="muted">
              Locked badges stay greyed out until requirements are met. Unlocked: {unlockedBadges}/{achievements.length}
            </p>
            <div className="badge-grid">
              {achievements.map((achievement) => {
                const progress = achievementProgress[achievement.id]?.value ?? 0;
                const unlockedAt = achievementProgress[achievement.id]?.unlockedAt;
                const unlocked = Boolean(unlockedAt);
                const percent = progressPercent(progress, achievement.requirementValue);

                return (
                  <article key={achievement.id} className={unlocked ? "badge-card" : "badge-card locked"}>
                    <div className="row space">
                      <strong>{achievement.title}</strong>
                      <span className="badge">{achievement.tier}</span>
                    </div>
                    <div className="muted">{achievement.category.replace("_", " ")}</div>
                    <div className="progress-bar" style={{ marginTop: "0.4rem" }}>
                      <span style={{ width: `${percent}%` }} />
                    </div>
                    <div className="row space" style={{ marginTop: "0.4rem" }}>
                      <small>
                        {progress}/{achievement.requirementValue}
                      </small>
                      <small>{unlocked ? `Unlocked ${unlockedAt?.slice(0, 10)}` : "Locked"}</small>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === "analytics" && (
          <section className="analytics-layout">
            <article className="panel analytics-equal">
              <h3>Yearly Focus Heatmap</h3>
              <p className="muted">Intensity by day with weekday rows and month columns.</p>
              <div className="heatmap-frame">
                <div
                  className="heatmap-months"
                  style={{ ["--heat-columns" as string]: String(heatmapMeta.columns) } as React.CSSProperties}
                >
                  {heatmapMeta.monthLabels.map((label, idx) => (
                    <span key={`month-${idx}`}>{label}</span>
                  ))}
                </div>
                <div className="heatmap-body">
                  <div className="heatmap-days">
                    {dayLabels.map((day) => (
                      <span key={`day-${day}`}>{day}</span>
                    ))}
                  </div>
                  <div
                    className="year-heatmap"
                    role="img"
                    aria-label="Yearly focus heatmap"
                    style={{ ["--heat-columns" as string]: String(heatmapMeta.columns) } as React.CSSProperties}
                  >
                    {heatmapMeta.cells.map((cell, idx) => {
                      if (!cell) {
                        return <span key={`blank-${idx}`} className="heat blank" />;
                      }
                      return (
                        <span
                          key={cell.date}
                          className={`heat lvl-${heatLevel(cell.minutes)}`}
                          title={`${cell.date}: ${cell.minutes} min`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </article>

            <div className="analytics-right">
              <article className="panel analytics-equal">
                <h3>Peak + Weekly Statistics</h3>
                <div className="hour-chart">
                  {peakHours.map((value, hour) => {
                    const height = Math.round((value / peakHourMax) * 100);
                    return (
                      <div key={hour} className="hour-col" title={`${String(hour).padStart(2, "0")}:00 • ${value} min`}>
                        <span style={{ height: `${height}%` }} />
                        <small>{hour % 6 === 0 ? hour : ""}</small>
                      </div>
                    );
                  })}
                </div>
                <div className="row wrap analytics-days" style={{ marginTop: "0.5rem" }}>
                  {peakDays.map((value, idx) => (
                    <span key={dayLabels[idx]} className="badge">
                      {dayLabels[idx]}: {value}m
                    </span>
                  ))}
                </div>

                <div className="analytics-pies">
                  <div className="pie-card">
                    <div
                      className="pie-chart"
                      style={{ ["--pie-fill" as string]: `${focusDayCompletionRate}%`, ["--pie-color" as string]: "var(--accent)" } as React.CSSProperties}
                    />
                    <div>
                      <strong>{focusDayCompletionRate}%</strong>
                      <p className="muted">Focus-day completion rate</p>
                    </div>
                  </div>
                  <div className="pie-card">
                    <div
                      className="pie-chart"
                      style={{ ["--pie-fill" as string]: `${peakDaySharePct}%`, ["--pie-color" as string]: "var(--accent-2)" } as React.CSSProperties}
                    />
                    <div>
                      <strong>{peakDaySharePct}%</strong>
                      <p className="muted">Peak day concentration</p>
                    </div>
                  </div>
                </div>

                <div className="divider" />

                <div className="analytics-weekly-list">
                  {weeklyTrend.map((item) => (
                    <div key={item.date} className="analytics-week-row">
                      <div className="progress-row">
                        <span>{item.date}</span>
                        <span>
                          {item.focus}m • {item.completions} tasks
                        </span>
                      </div>
                      <div className="dual-mini-progress">
                        <span className="focus" style={{ width: `${Math.round((item.focus / weeklyFocusPeak) * 100)}%` }} />
                        <span className="tasks" style={{ width: `${Math.round((item.completions / weeklyCompletionPeak) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="divider" />
                <p className="muted">Weekly focus total: {weeklyFocus}m</p>
                <p className="muted">Weekly completions: {weeklyCompletions}</p>
              </article>
            </div>
          </section>
        )}

        {activeTab === "journal" && (
          <section className="panel-grid journal-layout">
            <article className="panel journal-left">
              <h3>Daily Journal</h3>
              <p className="muted">Capture what moved today, and what to protect tomorrow.</p>
              <textarea rows={8} placeholder="Daily notes..." />
            </article>
            <article className="panel journal-right">
              <h3>Weekly Reflection</h3>
              <p className="muted">What action improved your deepest work sessions this week?</p>
              <textarea className="reflection-area journal-reflection-area" placeholder="Write your reflection..." />
            </article>
          </section>
        )}

        {activeTab === "settings" && (
          <section className="panel-grid">
            <article className="panel">
              <h3>Social-Ready Snapshot</h3>
              <p className="muted">Aggregate-only preview for future guild and party features.</p>
              <button onClick={runSnapshot}>Build Snapshot (Local)</button>
              {snapshotPreview && <pre>{snapshotPreview}</pre>}
            </article>
            <article className="panel">
              <h3>Current Timer Profile</h3>
              <p className="muted">Work: {timerSettings.workMin}m</p>
              <p className="muted">Break: {timerSettings.breakMin}m</p>
              <p className="muted">Long break: {timerSettings.longBreakMin}m</p>
              <p className="muted">Cycle: every {timerSettings.everyN} work sessions</p>
              <div className="divider" />
              <p className="muted">Lifetime XP: {character?.xpLifetime ?? 0}</p>
              <button className="ghost" onClick={() => void resetLifetimeXp()}>
                Reset lifetime XP
              </button>
            </article>
          </section>
        )}
      </main>

      {taskEditorOpen && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Task editor">
          <div className="modal-card large">
            <div className="row space">
              <h3>{editingTaskId ? "Edit Task" : "Create Task"}</h3>
              <button className="small ghost" onClick={() => setTaskEditorOpen(false)}>
                Close
              </button>
            </div>

            <div className="form-grid">
              <input
                value={taskDraft.title}
                onChange={(event) => setTaskDraft((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Task title"
              />
              <div className="row wrap">
                <select
                  value={taskDraft.categoryId}
                  onChange={(event) => setTaskDraft((prev) => ({ ...prev, categoryId: event.target.value }))}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <select
                  value={taskDraft.priority}
                  onChange={(event) =>
                    setTaskDraft((prev) => ({ ...prev, priority: event.target.value as "low" | "medium" | "high" }))
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={360}
                  value={taskDraft.estimateMinutes}
                  onChange={(event) =>
                    setTaskDraft((prev) => ({ ...prev, estimateMinutes: Math.max(1, Number(event.target.value)) }))
                  }
                />
              </div>

              <div className="row wrap">
                <input
                  className="date-themed"
                  type="date"
                  value={taskDraft.deadlineAt}
                  onChange={(event) => setTaskDraft((prev) => ({ ...prev, deadlineAt: event.target.value }))}
                />
                <select
                  value={taskDraft.recurrenceMode}
                  onChange={(event) =>
                    setTaskDraft((prev) => ({ ...prev, recurrenceMode: event.target.value as TaskDraft["recurrenceMode"] }))
                  }
                >
                  <option value="none">No recurrence</option>
                  <option value="daily_interval">Every N days</option>
                  <option value="weekly_days">Weekly on selected days</option>
                  <option value="custom">Custom text rule</option>
                </select>
              </div>

              {(taskDraft.recurrenceMode === "daily_interval" || taskDraft.recurrenceMode === "weekly_days") && (
                <div className="row wrap">
                  <label className="label">Every</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={taskDraft.recurrenceEvery}
                    onChange={(event) =>
                      setTaskDraft((prev) => ({
                        ...prev,
                        recurrenceEvery: Math.max(1, Math.round(Number(event.target.value) || 1))
                      }))
                    }
                  />
                  <span className="muted">{taskDraft.recurrenceMode === "daily_interval" ? "day(s)" : "week(s)"}</span>
                </div>
              )}

              {taskDraft.recurrenceMode === "weekly_days" && (
                <div className="row wrap">
                  {dayLabels.map((day, idx) => {
                    const selected = taskDraft.recurrenceWeekdays.includes(idx);
                    return (
                      <button
                        key={day}
                        type="button"
                        className={selected ? "pill active" : "pill"}
                        onClick={() => {
                          setTaskDraft((prev) => {
                            const exists = prev.recurrenceWeekdays.includes(idx);
                            const weekdays = exists
                              ? prev.recurrenceWeekdays.filter((entry) => entry !== idx)
                              : [...prev.recurrenceWeekdays, idx];
                            return {
                              ...prev,
                              recurrenceWeekdays: weekdays.length > 0 ? weekdays : [idx]
                            };
                          });
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              )}

              {taskDraft.recurrenceMode === "custom" && (
                <input
                  value={taskDraft.recurrenceRuleText}
                  onChange={(event) => setTaskDraft((prev) => ({ ...prev, recurrenceRuleText: event.target.value }))}
                  placeholder="Custom recurrence label"
                />
              )}

              <div className="muted">
                {recurrenceSummary(
                  taskDraft.recurrenceMode,
                  taskDraft.recurrenceEvery,
                  taskDraft.recurrenceWeekdays,
                  taskDraft.recurrenceRuleText
                ) ?? "No recurrence set"}
              </div>

              <input
                value={taskDraft.tagsText}
                onChange={(event) => setTaskDraft((prev) => ({ ...prev, tagsText: event.target.value }))}
                placeholder="Tags (comma separated)"
              />

              <textarea
                rows={5}
                value={taskDraft.notes}
                onChange={(event) => setTaskDraft((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Notes"
              />
            </div>

            <div className="divider" />

            <div>
              <h4>Subtasks</h4>
              <div className="row wrap" style={{ marginBottom: "0.5rem" }}>
                <input value={subtaskInput} onChange={(event) => setSubtaskInput(event.target.value)} placeholder="Add subtask" />
                <button
                  onClick={() => {
                    if (!subtaskInput.trim()) return;
                    setTaskDraft((prev) => ({
                      ...prev,
                      subtasks: [...prev.subtasks, { id: makeId(), title: subtaskInput.trim(), done: false }]
                    }));
                    setSubtaskInput("");
                  }}
                >
                  Add subtask
                </button>
              </div>

              <div className="task-list">
                {taskDraft.subtasks.map((subtask) => (
                  <div key={subtask.id} className="task-row compact">
                    <div className="row" style={{ flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={subtask.done}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setTaskDraft((prev) => ({
                            ...prev,
                            subtasks: prev.subtasks.map((entry) => (entry.id === subtask.id ? { ...entry, done: checked } : entry))
                          }));
                        }}
                      />
                      <input
                        value={subtask.title}
                        onChange={(event) => {
                          const value = event.target.value;
                          setTaskDraft((prev) => ({
                            ...prev,
                            subtasks: prev.subtasks.map((entry) => (entry.id === subtask.id ? { ...entry, title: value } : entry))
                          }));
                        }}
                      />
                    </div>
                    <button
                      className="small ghost"
                      onClick={() => {
                        setTaskDraft((prev) => ({
                          ...prev,
                          subtasks: prev.subtasks.filter((entry) => entry.id !== subtask.id)
                        }));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="row" style={{ marginTop: "0.8rem", justifyContent: "flex-end" }}>
              <button className="ghost" onClick={() => setTaskEditorOpen(false)}>
                Cancel
              </button>
              <button onClick={() => void saveTaskEditor()}>{editingTaskId ? "Save changes" : "Create task"}</button>
            </div>
          </div>
        </div>
      )}

      {commandOpen && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Command palette">
          <div className="modal-card">
            <div className="row space">
              <h3>Command Palette</h3>
              <button className="small ghost" onClick={() => setCommandOpen(false)}>
                Close
              </button>
            </div>
            <input
              autoFocus
              placeholder="Type to filter commands..."
              value={commandQuery}
              onChange={(event) => setCommandQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && filteredCommands[0]) {
                  event.preventDefault();
                  filteredCommands[0].run();
                }
              }}
            />

            <div className="command-list">
              {filteredCommands.map((command) => (
                <button key={command.id} className="command-row" onClick={command.run}>
                  <span>
                    <strong>{command.label}</strong>
                    <small>{command.section}</small>
                  </span>
                  {command.hint ? <kbd>{command.hint}</kbd> : null}
                </button>
              ))}
              {filteredCommands.length === 0 && <div className="muted">No commands match.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
