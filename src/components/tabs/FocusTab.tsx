import React from "react";
import { Task } from "../../domain/types";

interface TimerPreset {
  name: string;
  work: number;
  break: number;
  longBreak: number;
  everyN: number;
}

interface FocusTabProps {
  timerPhase: "work" | "break" | "long_break";
  secondsLeft: number;
  timerRunning: boolean;
  ringProgressDeg: string;
  toggleFocusTimer: () => void;
  resetFocusTimer: () => void;
  isFocusCollapsed: boolean;
  setFocusExpanded: (value: boolean) => void;
  skipWork: () => void;
  skipBreak: () => void;
  timerPresets: readonly TimerPreset[];
  applyTimerPreset: (presetName: string) => Promise<void>;
  focusTaskId: string;
  setFocusTaskId: (value: string) => void;
  openTasks: Task[];
  customWork: number;
  setCustomWork: (value: number) => void;
  customBreak: number;
  setCustomBreak: (value: number) => void;
  customLongBreak: number;
  setCustomLongBreak: (value: number) => void;
  customEveryN: number;
  setCustomEveryN: (value: number) => void;
  saveCustomTimer: () => Promise<void>;
  immersiveFocusMode: boolean;
}

const formatSeconds = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export const FocusTab: React.FC<FocusTabProps> = ({
  timerPhase,
  secondsLeft,
  timerRunning,
  ringProgressDeg,
  toggleFocusTimer,
  resetFocusTimer,
  isFocusCollapsed,
  setFocusExpanded,
  skipWork,
  skipBreak,
  timerPresets,
  applyTimerPreset,
  focusTaskId,
  setFocusTaskId,
  openTasks,
  customWork,
  setCustomWork,
  customBreak,
  setCustomBreak,
  customLongBreak,
  setCustomLongBreak,
  customEveryN,
  setCustomEveryN,
  saveCustomTimer,
  immersiveFocusMode,
}) => {
  return (
    <section
      className={
        isFocusCollapsed
          ? "panel-grid focus-layout focus-layout-collapsed"
          : "panel-grid focus-layout"
      }
    >
      <article
        className={
          immersiveFocusMode
            ? "panel focus-hero focus-hero-immersive"
            : "panel focus-hero"
        }
      >
        {!immersiveFocusMode && <h3 className="focus-title">Pomodoro Nexus</h3>}
        <div
          className={
            isFocusCollapsed ? "focus-core focus-core-collapsed" : "focus-core"
          }
        >
          <div
            className={
              timerRunning ? "focus-ring-shell running" : "focus-ring-shell"
            }
            style={
              {
                ["--ring-progress" as string]: ringProgressDeg,
              } as React.CSSProperties
            }
            role="button"
            tabIndex={0}
            aria-label={
              timerRunning ? "Pause focus timer" : "Start focus timer"
            }
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
              <span className="focus-ring-time">
                {formatSeconds(secondsLeft)}
              </span>
              <div className="focus-ring-actions">
                <button
                  className="focus-action"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleFocusTimer();
                  }}
                >
                  {timerRunning ? "Pause" : "Start"}
                </button>
                <button
                  className="focus-action ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    resetFocusTimer();
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
          {isFocusCollapsed && (
            <div className="focus-collapsed-cta">
              <button
                className="focus-action ghost"
                onClick={() => setFocusExpanded(true)}
              >
                Show controls
              </button>
            </div>
          )}
        </div>

        {!isFocusCollapsed && (
          <>
            <div className="divider" />

            <div
              className="row wrap focus-skip-actions"
              style={{ marginTop: "0.5rem" }}
            >
              <button
                className="small ghost"
                disabled={timerPhase !== "work"}
                onClick={skipWork}
              >
                Skip work
              </button>
              <button
                className="small ghost"
                disabled={timerPhase === "work"}
                onClick={skipBreak}
              >
                Skip break
              </button>
            </div>
            {timerRunning && (
              <div
                className="row wrap focus-skip-actions"
                style={{ marginTop: "0.4rem" }}
              >
                <button
                  className="small ghost"
                  onClick={() => setFocusExpanded(false)}
                >
                  Collapse to timer
                </button>
              </div>
            )}

            <div className="divider" />

            <div className="focus-controls-grid">
              <div className="focus-pane">
                <label className="label">Presets</label>
                <div className="row wrap" style={{ marginBottom: "0.4rem" }}>
                  {timerPresets.map((preset) => (
                    <button
                      key={preset.name}
                      className="small focus-pill"
                      onClick={() => void applyTimerPreset(preset.name)}
                    >
                      {preset.work}/{preset.break}
                    </button>
                  ))}
                </div>
              </div>
              <div className="focus-pane">
                <label className="label">Link task (optional)</label>
                <select
                  value={focusTaskId}
                  onChange={(event) => setFocusTaskId(event.target.value)}
                >
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
              <input
                type="number"
                min={5}
                max={180}
                value={customWork}
                onChange={(event) => setCustomWork(Number(event.target.value))}
              />
            </div>
            <div className="row">
              <label className="label">Break</label>
              <input
                type="number"
                min={2}
                max={45}
                value={customBreak}
                onChange={(event) => setCustomBreak(Number(event.target.value))}
              />
            </div>
            <div className="row">
              <label className="label">Long break</label>
              <input
                type="number"
                min={5}
                max={60}
                value={customLongBreak}
                onChange={(event) =>
                  setCustomLongBreak(Number(event.target.value))
                }
              />
            </div>
            <div className="row">
              <label className="label">Long break every N sessions</label>
              <input
                type="number"
                min={2}
                max={8}
                value={customEveryN}
                onChange={(event) =>
                  setCustomEveryN(Number(event.target.value))
                }
              />
            </div>
            <button className="small" onClick={() => void saveCustomTimer()}>
              Apply
            </button>
          </div>
          <p className="muted" style={{ marginTop: "0.65rem" }}>
            Focus session completions automatically log XP and feed analytics.
            Skipping breaks keeps momentum when needed.
          </p>
        </article>
      )}
    </section>
  );
};
