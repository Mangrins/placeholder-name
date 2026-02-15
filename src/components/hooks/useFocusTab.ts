import { useEffect, useRef, useState } from "react";
import { Task, FocusSession, AppSettings } from "../../domain/types";

const timerPresets = [
  { name: "Classic 25/5", work: 25, break: 5, longBreak: 15, everyN: 4 },
  { name: "Power 50/10", work: 50, break: 10, longBreak: 20, everyN: 3 },
  { name: "Deep 90/20", work: 90, break: 20, longBreak: 30, everyN: 2 },
] as const;

interface UseFocusTabProps {
  activeTab: string;
  timerSettings: {
    workMin: number;
    breakMin: number;
    longBreakMin: number;
    everyN: number;
  };
  tasks: Task[];
  addFocusSession: (session: FocusSession) => Promise<void>;
  refreshAnalytics: () => void;
  updateTimerSettings: (patch: Partial<AppSettings["timer"]>) => Promise<void>;
  ensureNotificationPermission: () => Promise<void>;
}

export const useFocusTab = ({
  activeTab,
  timerSettings,
  tasks,
  addFocusSession,
  refreshAnalytics,
  updateTimerSettings,
  ensureNotificationPermission,
}: UseFocusTabProps) => {
  // Timer state
  const [timerPhase, setTimerPhase] = useState<"work" | "break" | "long_break">("work");
  const [timerRunning, setTimerRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [sessionCount, setSessionCount] = useState(0);

  // UI state
  const [focusExpanded, setFocusExpanded] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState("");

  // Custom timer settings state
  const [customWork, setCustomWork] = useState(25);
  const [customBreak, setCustomBreak] = useState(5);
  const [customLongBreak, setCustomLongBreak] = useState(15);
  const [customEveryN, setCustomEveryN] = useState(4);

  // Refs
  const timerInitialized = useRef(false);
  const timerEndAtRef = useRef<number | null>(null);
  const phaseTimeoutRef = useRef<number | null>(null);
  const workBlockStartedAtRef = useRef<string | null>(null);

  // Computed values
  const immersiveFocusMode = activeTab === "focus" && timerRunning && timerPhase === "work";
  const phaseTotalSeconds =
    timerPhase === "work"
      ? timerSettings.workMin * 60
      : timerPhase === "break"
        ? timerSettings.breakMin * 60
        : timerSettings.longBreakMin * 60;
  const ringProgressRatio =
    phaseTotalSeconds > 0
      ? Math.max(0, Math.min(1, (phaseTotalSeconds - secondsLeft) / phaseTotalSeconds))
      : 0;
  const ringProgressDeg = `${Math.round(ringProgressRatio * 360)}deg`;
  const isFocusCollapsed = immersiveFocusMode && !focusExpanded;
  const openTasks = tasks.filter((task) => task.status !== "done");

  // Utility functions
  const makeId = (): string => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  };

  const playPhaseAlarm = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const audio = new AudioCtx();
      const master = audio.createGain();
      master.gain.value = 0.05;
      master.connect(audio.destination);

      [0, 0.24, 0.48].forEach((offset) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = "triangle";
        osc.frequency.value = 860;
        gain.gain.setValueAtTime(0.0001, audio.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(
          0.2,
          audio.currentTime + offset + 0.02,
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          audio.currentTime + offset + 0.18,
        );
        osc.connect(gain);
        gain.connect(master);
        osc.start(audio.currentTime + offset);
        osc.stop(audio.currentTime + offset + 0.22);
      });
    } catch {
      // Ignore audio API failures.
    }
  };

  const notifyPhaseEnd = (title: string, body: string) => {
    playPhaseAlarm();
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        const notification = new Notification(title, {
          body,
          tag: "pomodoro-phase-end",
          requireInteraction: true,
        });
        window.setTimeout(() => notification.close(), 12000);
      } catch {
        // Ignore notification errors.
      }
    }
  };

  const resolveFocusContext = () => {
    const linkedTask = tasks.find((task) => task.id === focusTaskId);
    return {
      linkedTask,
      categoryId: linkedTask?.categoryId ?? "learning",
      label: linkedTask?.title ?? "Focus",
    };
  };

  const clearPhaseTimeout = () => {
    if (phaseTimeoutRef.current !== null) {
      window.clearTimeout(phaseTimeoutRef.current);
      phaseTimeoutRef.current = null;
    }
  };

  // Effects
  useEffect(() => {
    return () => {
      if (phaseTimeoutRef.current !== null) {
        window.clearTimeout(phaseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (timerInitialized.current) return;
    setSecondsLeft(timerSettings.workMin * 60);
    setCustomWork(timerSettings.workMin);
    setCustomBreak(timerSettings.breakMin);
    setCustomLongBreak(timerSettings.longBreakMin);
    setCustomEveryN(timerSettings.everyN);
    timerInitialized.current = true;
  }, [
    timerSettings.breakMin,
    timerSettings.everyN,
    timerSettings.longBreakMin,
    timerSettings.workMin,
  ]);

  useEffect(() => {
    if (!timerRunning) return;
    if (timerEndAtRef.current === null) {
      timerEndAtRef.current = Date.now() + secondsLeft * 1000;
    }
    const id = window.setInterval(() => {
      if (timerEndAtRef.current === null) return;
      const next = Math.max(
        0,
        Math.ceil((timerEndAtRef.current - Date.now()) / 1000),
      );
      setSecondsLeft((prev) => (prev === next ? prev : next));
    }, 250);
    return () => window.clearInterval(id);
  }, [secondsLeft, timerRunning]);

  useEffect(() => {
    if (!timerRunning || secondsLeft !== 0) return;

    const finishPhase = async () => {
      if (timerPhase === "work") {
        const { linkedTask, categoryId, label } = resolveFocusContext();
        const now = new Date();
        const completedMinutes = timerSettings.workMin;
        const startedAt = new Date(
          now.getTime() - completedMinutes * 60 * 1000,
        ).toISOString();
        const session: FocusSession = {
          id: makeId(),
          label,
          taskId: linkedTask?.id,
          categoryId,
          startedAt,
          endedAt: now.toISOString(),
          durationMin: completedMinutes,
          rewardMinutes: completedMinutes,
          type: "work",
          completed: true,
        };
        await addFocusSession(session);
        refreshAnalytics();
        notifyPhaseEnd("Work session complete", "Time for a break.");
        workBlockStartedAtRef.current = null;

        const nextSessionCount = sessionCount + 1;
        setSessionCount(nextSessionCount);
        const useLongBreak =
          nextSessionCount % Math.max(2, timerSettings.everyN) === 0;
        setTimerPhase(useLongBreak ? "long_break" : "break");
        setSecondsLeft(
          (useLongBreak ? timerSettings.longBreakMin : timerSettings.breakMin) *
            60,
        );
        setTimerRunning(false);
        timerEndAtRef.current = null;
        clearPhaseTimeout();
        return;
      }

      notifyPhaseEnd(
        "Break complete",
        "Ready to start your next focus session.",
      );
      workBlockStartedAtRef.current = null;
      setTimerPhase("work");
      setSecondsLeft(timerSettings.workMin * 60);
      setTimerRunning(false);
      timerEndAtRef.current = null;
      clearPhaseTimeout();
    };

    void finishPhase();
  }, [
    addFocusSession,
    refreshAnalytics,
    focusTaskId,
    notifyPhaseEnd,
    resolveFocusContext,
    secondsLeft,
    sessionCount,
    tasks,
    timerPhase,
    timerRunning,
    timerSettings.breakMin,
    timerSettings.everyN,
    timerSettings.longBreakMin,
    timerSettings.workMin,
  ]);

  // Timer control functions
  const toggleFocusTimer = () => {
    if (timerRunning) {
      setTimerRunning(false);
      timerEndAtRef.current = null;
      clearPhaseTimeout();
      return;
    }

    if (timerPhase === "work" && !workBlockStartedAtRef.current) {
      workBlockStartedAtRef.current = new Date().toISOString();
    }

    timerEndAtRef.current = Date.now() + secondsLeft * 1000;
    clearPhaseTimeout();
    phaseTimeoutRef.current = window.setTimeout(() => {
      setSecondsLeft(0);
    }, secondsLeft * 1000);
    setFocusExpanded(false);
    setTimerRunning(true);
    void ensureNotificationPermission();
  };

  const resetFocusTimer = () => {
    setTimerRunning(false);
    setTimerPhase("work");
    setSecondsLeft(timerSettings.workMin * 60);
    timerEndAtRef.current = null;
    clearPhaseTimeout();
    workBlockStartedAtRef.current = null;
  };

  const skipBreak = () => {
    if (timerPhase === "work") return;
    setTimerPhase("work");
    setTimerRunning(false);
    setSecondsLeft(timerSettings.workMin * 60);
    timerEndAtRef.current = null;
    clearPhaseTimeout();
    workBlockStartedAtRef.current = null;
  };

  const skipWork = () => {
    if (timerPhase !== "work") return;
    setTimerRunning(false);
    timerEndAtRef.current = null;
    clearPhaseTimeout();
    workBlockStartedAtRef.current = null;
    setTimerPhase("break");
    setSecondsLeft(timerSettings.breakMin * 60);
  };

  const applyTimerPreset = async (presetName: string) => {
    const preset = timerPresets.find((item) => item.name === presetName);
    if (!preset) return;

    await updateTimerSettings({
      workMin: preset.work,
      breakMin: preset.break,
      longBreakMin: preset.longBreak,
      everyN: preset.everyN,
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
      everyN: Math.max(2, Math.min(8, Math.round(customEveryN))),
    };

    await updateTimerSettings(patch);
    if (!timerRunning) {
      if (timerPhase === "work") setSecondsLeft(patch.workMin * 60);
      if (timerPhase === "break") setSecondsLeft(patch.breakMin * 60);
      if (timerPhase === "long_break") setSecondsLeft(patch.longBreakMin * 60);
    }
  };

  return {
    // Timer state
    timerPhase,
    timerRunning,
    secondsLeft,

    // UI state
    focusExpanded,
    setFocusExpanded,
    focusTaskId,
    setFocusTaskId,

    // Custom timer settings
    customWork,
    setCustomWork,
    customBreak,
    setCustomBreak,
    customLongBreak,
    setCustomLongBreak,
    customEveryN,
    setCustomEveryN,

    // Computed values
    immersiveFocusMode,
    ringProgressDeg,
    isFocusCollapsed,
    openTasks,
    timerPresets,

    // Functions
    toggleFocusTimer,
    resetFocusTimer,
    skipWork,
    skipBreak,
    applyTimerPreset,
    saveCustomTimer,
    resolveFocusContext,
  };
};