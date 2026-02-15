import { useState, useMemo, useEffect } from "react";
import { useAppStore } from "./data/store";
import { useFocusTab } from "./components/hooks/useFocusTab";
import { useSettingsTab } from "./components/hooks/useSettingsTab";
import { useTasksTab } from "./components/hooks/useTasksTab";
import { useQuestsTab } from "./components/hooks/useQuestsTab";
import { useAnalyticsTab } from "./components/hooks/useAnalyticsTab";
import { useJournalTab } from "./components/hooks/useJournalTab";
import { FocusTab } from "./components/tabs/FocusTab";
import { SettingsTab } from "./components/tabs/SettingsTab";
import { TasksTab } from "./components/tabs/TasksTab";
import { QuestsTab } from "./components/tabs/QuestsTab";
import { AnalyticsTab } from "./components/tabs/AnalyticsTab";
import { JournalTab } from "./components/tabs/JournalTab";
import { DashboardTab } from "./components/tabs/DashboardTab";
import { CharacterTab } from "./components/tabs/CharacterTab";
import { AchievementsTab } from "./components/tabs/AchievementsTab";
import { xpToNext } from "./domain/progression";

type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  section: string;
  keywords: string;
  run: () => void;
};

export default function App() {
  const {
    ready,
    init,
    settings,
    tasks,
    categories,
    quests,
    streaks,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    reopenTask,
    createQuest,
    updateQuest,
    addFocusSession,
    updateTimerSettings,
    updateSettings,
    resetLifetimeXp,
    activeTab,
    setActiveTab,
    profile,
    character,
    achievements,
    achievementProgress,
  } = useAppStore();
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState("all");
  const [taskSearch, setTaskSearch] = useState("");

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute(
      "data-theme",
      settings?.themeId ?? "neon",
    );
  }, [settings?.themeId]);

  const timerSettings = settings?.timer ?? {
    workMin: 25,
    breakMin: 5,
    longBreakMin: 15,
    everyN: 4,
  };

  const ensureNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        // Ignore permission errors and fall back to sound only.
      }
    }
  };

  const focusTab = useFocusTab({
    activeTab,
    timerSettings,
    tasks,
    addFocusSession,
    refreshAnalytics: () => {},
    updateTimerSettings,
    ensureNotificationPermission,
  });

  const settingsTab = useSettingsTab();

  const tasksTab = useTasksTab({
    categories,
    tasks,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    reopenTask,
    taskFilter,
    taskSearch,
  });

  const questsTab = useQuestsTab({
    categories,
    quests,
    createQuest,
    updateQuest,
  });

  const analyticsTab = useAnalyticsTab(ready, tasks, quests, character);

  const journalTab = useJournalTab();

  const activeQuestProgress = useMemo(() => {
    return quests.map((quest) => ({
      id: quest.id,
      title: quest.title,
      percent:
        quest.target > 0
          ? Math.min(100, Math.round((quest.progress / quest.target) * 100))
          : 0,
    }));
  }, [quests]);

  const rankFromLevel = (level: number) => {
    if (level >= 50) return "Archmage";
    if (level >= 40) return "Grandmaster";
    if (level >= 30) return "Master";
    if (level >= 20) return "Expert";
    if (level >= 10) return "Apprentice";
    return "Novice";
  };

  const themeOptions = [
    { id: "neon" as const, label: "Neon" },
    { id: "pastel_light" as const, label: "Pastel Light" },
    { id: "monochrome" as const, label: "Monochrome" },
    { id: "ember" as const, label: "Ember" },
    { id: "oceanic" as const, label: "Oceanic" },
    { id: "medieval" as const, label: "Medieval" },
  ];

  const commandItems = useMemo<CommandItem[]>(() => {
    const navCommands = [
      { id: "dashboard", label: "Dashboard", icon: "🏠" },
      { id: "tasks", label: "Tasks", icon: "✅" },
      { id: "focus", label: "Focus", icon: "⌛" },
      { id: "quests", label: "Quests", icon: "🗺" },
      { id: "character", label: "Character", icon: "🛡" },
      { id: "achievements", label: "Badges", icon: "🏆" },
      { id: "analytics", label: "Analytics", icon: "📈" },
      { id: "journal", label: "Journal", icon: "✎" },
      { id: "settings", label: "Settings", icon: "🛠️" },
    ].map((item) => ({
      id: `nav-${item.id}`,
      label: `Go to ${item.label}`,
      hint: item.icon,
      section: "Navigation",
      keywords: `${item.id} ${item.label}`,
      run: () => {
        setActiveTab(item.id as any);
        setCommandOpen(false);
      },
    }));

    return [
      ...navCommands,
      {
        id: "timer-toggle",
        label: focusTab.timerRunning
          ? "Pause focus timer"
          : "Start focus timer",
        hint: "Space",
        section: "Actions",
        keywords: "focus timer pause start",
        run: () => {
          setActiveTab("focus");
          focusTab.toggleFocusTimer();
          setCommandOpen(false);
        },
      },
      {
        id: "skip-break",
        label: "Skip current break",
        section: "Actions",
        keywords: "skip break long",
        run: () => {
          setActiveTab("focus");
          focusTab.skipBreak();
          setCommandOpen(false);
        },
      },
      {
        id: "skip-work",
        label: "Skip current work block",
        section: "Actions",
        keywords: "skip work block",
        run: () => {
          setActiveTab("focus");
          focusTab.skipWork();
          setCommandOpen(false);
        },
      },
    ];
  }, [
    focusTab.timerRunning,
    focusTab.toggleFocusTimer,
    focusTab.skipBreak,
    focusTab.skipWork,
    setActiveTab,
  ]);

  const filteredCommands = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    if (!q) return commandItems;
    return commandItems.filter((item) =>
      `${item.label} ${item.keywords} ${item.section}`
        .toLowerCase()
        .includes(q),
    );
  }, [commandItems, commandQuery]);

  if (!ready) {
    return <div className="loading">Forging your hunter profile...</div>;
  }

  const level = character?.level ?? 1;
  const xpCurrent = character?.xpCurrent ?? 0;
  const xpNeeded = xpToNext(level);
  const xpProgress =
    xpNeeded > 0
      ? Math.max(0, Math.min(100, Math.round((xpCurrent / xpNeeded) * 100)))
      : 0;
  const unlockedBadges = achievements.filter(
    (achievement) => !!achievementProgress[achievement.id]?.unlockedAt,
  ).length;
  const rankTier =
    level >= 50
      ? "S"
      : level >= 40
        ? "A"
        : level >= 30
          ? "B"
          : level >= 20
            ? "C"
            : level >= 10
              ? "D"
              : "E";
  const rankHeader = `${rankTier}-Rank ${rankFromLevel(level)}`.toUpperCase();
  const heroAttributes = [
    { label: "Strength", value: character?.stats.strength ?? 0, icon: "⚔" },
    { label: "Vitality", value: character?.stats.vitality ?? 0, icon: "❤" },
    {
      label: "Intellect",
      value: character?.stats.intellect ?? 0,
      icon: "✦",
    },
    {
      label: "Creativity",
      value: character?.stats.creativity ?? 0,
      icon: "✎",
    },
    {
      label: "Discipline",
      value: character?.stats.discipline ?? 0,
      icon: "⌘",
    },
    { label: "Social", value: character?.stats.social ?? 0, icon: "☺" },
  ];

  return (
    <div className="app-shell">
      <aside className="left-nav">
        <div className="brand">RPG Productivity</div>
        {!focusTab.immersiveFocusMode && (
          <div className="profile-block">
            <div className="avatar" aria-hidden="true" />
            <div>
              <div className="name">{profile?.displayName}</div>
              <div className="muted">Level {level}</div>
              <div className="xp-mini">
                <div className="xp-mini-track">
                  <span style={{ width: `${xpProgress}%` }} />
                </div>
                <small>
                  XP {xpCurrent}/{xpNeeded}
                </small>
              </div>
            </div>
          </div>
        )}
        <nav>
          {[
            { id: "dashboard", label: "Dashboard", icon: "🏠" },
            { id: "tasks", label: "Tasks", icon: "✅" },
            { id: "focus", label: "Focus", icon: "⌛" },
            { id: "quests", label: "Quests", icon: "🗺" },
            { id: "character", label: "Character", icon: "🛡" },
            { id: "achievements", label: "Badges", icon: "🏆" },
            { id: "analytics", label: "Analytics", icon: "📈" },
            { id: "journal", label: "Journal", icon: "✎" },
            { id: "settings", label: "Settings", icon: "🛠️" },
          ].map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? "nav-btn active" : "nav-btn"}
              onClick={() => setActiveTab(tab.id as any)}
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
        {!focusTab.immersiveFocusMode && (
          <section className="panel hero">
            <div className="hero-content">
              <h1>{rankHeader}</h1>
              <p>
                Level {level} • Prestige 0 • Lifetime XP{" "}
                {character?.xpLifetime ?? 0}
              </p>
              <div className="hero-xp">
                <div className="xp-mini-track">
                  <span style={{ width: `${xpProgress}%` }} />
                </div>
                <small>
                  Rank XP {xpCurrent}/{xpNeeded}
                </small>
              </div>
              <div className="hero-attribute-grid">
                {heroAttributes.map((attribute) => (
                  <div key={attribute.label} className="hero-attribute-card">
                    <div className="hero-attribute-label">{attribute.label}</div>
                    <div className="hero-attribute-value-row">
                      <span className="hero-attribute-value">
                        {attribute.value}
                      </span>
                      <span className="hero-attribute-icon" aria-hidden="true">
                        {attribute.icon}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === "focus" && (
          <FocusTab
            timerPhase={focusTab.timerPhase}
            secondsLeft={focusTab.secondsLeft}
            timerRunning={focusTab.timerRunning}
            ringProgressDeg={focusTab.ringProgressDeg}
            toggleFocusTimer={focusTab.toggleFocusTimer}
            resetFocusTimer={focusTab.resetFocusTimer}
            isFocusCollapsed={focusTab.isFocusCollapsed}
            setFocusExpanded={focusTab.setFocusExpanded}
            skipWork={focusTab.skipWork}
            skipBreak={focusTab.skipBreak}
            timerPresets={focusTab.timerPresets}
            applyTimerPreset={focusTab.applyTimerPreset}
            focusTaskId={focusTab.focusTaskId}
            setFocusTaskId={focusTab.setFocusTaskId}
            openTasks={focusTab.openTasks}
            customWork={focusTab.customWork}
            setCustomWork={focusTab.setCustomWork}
            customBreak={focusTab.customBreak}
            setCustomBreak={focusTab.setCustomBreak}
            customLongBreak={focusTab.customLongBreak}
            setCustomLongBreak={focusTab.setCustomLongBreak}
            customEveryN={focusTab.customEveryN}
            setCustomEveryN={focusTab.setCustomEveryN}
            saveCustomTimer={focusTab.saveCustomTimer}
            immersiveFocusMode={focusTab.immersiveFocusMode}
          />
        )}

        {activeTab === "settings" && (
          <SettingsTab
            runSnapshot={settingsTab.runSnapshot}
            snapshotPreview={settingsTab.snapshotPreview}
            activeThemeId={settings?.themeId ?? "neon"}
            updateSettings={updateSettings}
            themeOptions={themeOptions}
            timerSettings={timerSettings}
            character={character}
            resetLifetimeXp={resetLifetimeXp}
          />
        )}

        {activeTab === "tasks" && (
          <TasksTab
            taskTitle={tasksTab.taskTitle}
            setTaskTitle={tasksTab.setTaskTitle}
            taskCategory={tasksTab.taskCategory}
            setTaskCategory={tasksTab.setTaskCategory}
            taskPriority={tasksTab.taskPriority}
            setTaskPriority={tasksTab.setTaskPriority}
            taskDeadline={tasksTab.taskDeadline}
            setTaskDeadline={tasksTab.setTaskDeadline}
            createQuickTask={tasksTab.createQuickTask}
            openTaskEditor={tasksTab.openTaskEditor}
            categories={tasksTab.categories}
            taskFilter={taskFilter}
            setTaskFilter={setTaskFilter}
            taskSearch={taskSearch}
            setTaskSearch={setTaskSearch}
            filteredTasks={tasksTab.filteredTasks}
            deleteTask={tasksTab.deleteTask}
            handleCompleteTask={tasksTab.handleCompleteTask}
            reopenTask={tasksTab.reopenTask}
            taskEditorOpen={tasksTab.taskEditorOpen}
            setTaskEditorOpen={tasksTab.setTaskEditorOpen}
            editingTaskId={tasksTab.editingTaskId}
            taskDraft={tasksTab.taskDraft}
            setTaskDraft={tasksTab.setTaskDraft}
            subtaskInput={tasksTab.subtaskInput}
            setSubtaskInput={tasksTab.setSubtaskInput}
            saveTaskEditor={tasksTab.saveTaskEditor}
          />
        )}

        {activeTab === "quests" && (
          <QuestsTab
            questTitle={questsTab.questTitle}
            setQuestTitle={questsTab.setQuestTitle}
            questKind={questsTab.questKind}
            setQuestKind={questsTab.setQuestKind}
            questObjectiveType={questsTab.questObjectiveType}
            setQuestObjectiveType={questsTab.setQuestObjectiveType}
            questCategoryId={questsTab.questCategoryId}
            setQuestCategoryId={questsTab.setQuestCategoryId}
            questTarget={questsTab.questTarget}
            setQuestTarget={questsTab.setQuestTarget}
            questRewardXp={questsTab.questRewardXp}
            setQuestRewardXp={questsTab.setQuestRewardXp}
            submitQuest={questsTab.submitQuest}
            categories={questsTab.categories}
            quests={questsTab.quests}
            progressPercent={questsTab.progressPercent}
            updateQuest={questsTab.updateQuest}
          />
        )}

        {activeTab === "analytics" && (
          <AnalyticsTab
            heatmapMeta={analyticsTab.heatmapMeta}
            dayLabels={analyticsTab.dayLabels}
            selectedHeatCell={analyticsTab.selectedHeatCell}
            setSelectedHeatCell={analyticsTab.setSelectedHeatCell}
            heatLevel={analyticsTab.heatLevel}
            peakHours={analyticsTab.peakHours}
            peakHourMax={analyticsTab.peakHourMax}
            peakDays={analyticsTab.peakDays}
            focusDayCompletionRate={analyticsTab.focusDayCompletionRate}
            peakDaySharePct={analyticsTab.peakDaySharePct}
            weeklyTrend={analyticsTab.weeklyTrend}
            weeklyFocusPeak={analyticsTab.weeklyFocusPeak}
            weeklyCompletionPeak={analyticsTab.weeklyCompletionPeak}
            weeklyFocus={analyticsTab.weeklyFocus}
            weeklyCompletions={analyticsTab.weeklyCompletions}
          />
        )}

        {activeTab === "journal" && (
          <JournalTab
            journalDaily={journalTab.journalDaily}
            setJournalDaily={journalTab.setJournalDaily}
            journalWeekly={journalTab.journalWeekly}
            setJournalWeekly={journalTab.setJournalWeekly}
          />
        )}

        {activeTab === "dashboard" && (
          <DashboardTab
            activeQuestProgress={activeQuestProgress}
            weeklyFocus={analyticsTab.weeklyFocus}
            timerSettings={timerSettings}
            weeklyCompletions={analyticsTab.weeklyCompletions}
            focusDayCompletionRate={analyticsTab.focusDayCompletionRate}
            peakHourIndex={analyticsTab.peakHourIndex}
            streaks={streaks}
            unlockedBadges={unlockedBadges}
            achievements={achievements}
          />
        )}

        {activeTab === "character" && (
          <CharacterTab
            level={character?.level ?? 1}
            rankFromLevel={rankFromLevel}
            xpProgress={xpProgress}
            xpCurrent={xpCurrent}
            xpNeeded={xpNeeded}
            character={character}
            streaks={streaks}
            dayLabels={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]}
            peakDayIndex={analyticsTab.peakDayIndex}
            peakHourIndex={analyticsTab.peakHourIndex}
            peakDaySharePct={analyticsTab.peakDaySharePct}
            bestFocusDay={analyticsTab.bestFocusDay}
            avgDailyFocus={analyticsTab.avgDailyFocus}
          />
        )}

        {activeTab === "achievements" && (
          <AchievementsTab
            unlockedBadges={unlockedBadges}
            achievements={achievements}
            achievementProgress={achievementProgress}
            progressPercent={(progress, target) =>
              target > 0
                ? Math.min(100, Math.round((progress / target) * 100))
                : 0
            }
          />
        )}

        {activeTab !== "focus" &&
          activeTab !== "settings" &&
          activeTab !== "tasks" &&
          activeTab !== "quests" &&
          activeTab !== "analytics" &&
          activeTab !== "journal" &&
          activeTab !== "dashboard" &&
          activeTab !== "character" &&
          activeTab !== "achievements" && (
            <div className="panel">
              <h2>Tab: {activeTab}</h2>
              <p>This tab is not yet implemented in the simplified version.</p>
            </div>
          )}
      </main>

      {commandOpen && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <div className="modal-card">
            <div className="row space">
              <h3>Command Palette</h3>
              <button
                className="small ghost"
                onClick={() => setCommandOpen(false)}
              >
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
                <button
                  key={command.id}
                  className="command-row"
                  onClick={command.run}
                >
                  <span>
                    <strong>{command.label}</strong>
                    <small>{command.section}</small>
                  </span>
                  {command.hint ? <kbd>{command.hint}</kbd> : null}
                </button>
              ))}
              {filteredCommands.length === 0 && (
                <div className="muted">No commands match.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
