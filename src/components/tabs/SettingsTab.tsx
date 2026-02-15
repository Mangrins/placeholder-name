import React from "react";
import { CharacterState, AppSettings } from "../../domain/types";

interface ThemeOption {
  id: NonNullable<AppSettings["themeId"]>;
  label: string;
}

interface TimerSettings {
  workMin: number;
  breakMin: number;
  longBreakMin: number;
  everyN: number;
}

interface SettingsTabProps {
  runSnapshot: () => void;
  snapshotPreview: string;
  activeThemeId: NonNullable<AppSettings["themeId"]>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  themeOptions: ThemeOption[];
  timerSettings: TimerSettings;
  character: CharacterState | undefined;
  resetLifetimeXp: () => Promise<void>;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  runSnapshot,
  snapshotPreview,
  activeThemeId,
  updateSettings,
  themeOptions,
  timerSettings,
  character,
  resetLifetimeXp,
}) => {
  return (
    <section className="panel-grid">
      <article className="panel">
        <h3>Social-Ready Snapshot</h3>
        <p className="muted">
          Aggregate-only preview for future guild and party features.
        </p>
        <button onClick={runSnapshot}>Build Snapshot (Local)</button>
        {snapshotPreview && <pre>{snapshotPreview}</pre>}
      </article>
      <article className="panel">
        <h3>Theme</h3>
        <p className="muted">Switch the UI palette instantly.</p>
        <select
          value={activeThemeId}
          onChange={(event) => {
            void updateSettings({
              themeId: event.target.value as NonNullable<
                AppSettings["themeId"]
              >,
            });
          }}
        >
          {themeOptions.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.label}
            </option>
          ))}
        </select>
      </article>
      <article className="panel">
        <h3>Current Timer Profile</h3>
        <p className="muted">Work: {timerSettings.workMin}m</p>
        <p className="muted">Break: {timerSettings.breakMin}m</p>
        <p className="muted">Long break: {timerSettings.longBreakMin}m</p>
        <p className="muted">
          Cycle: every {timerSettings.everyN} work sessions
        </p>
        <div className="divider" />
        <p className="muted">Lifetime XP: {character?.xpLifetime ?? 0}</p>
        <button className="ghost" onClick={() => void resetLifetimeXp()}>
          Reset lifetime XP
        </button>
      </article>
    </section>
  );
};
