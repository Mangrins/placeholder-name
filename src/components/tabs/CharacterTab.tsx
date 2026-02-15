import React from "react";
import { CharacterState, StreakState } from "../../domain/types";

interface CharacterTabProps {
  level: number;
  rankFromLevel: (level: number) => string;
  xpProgress: number;
  xpCurrent: number;
  xpNeeded: number;
  character: CharacterState | undefined;
  streaks: StreakState | undefined;
  dayLabels: string[];
  peakDayIndex: number;
  peakHourIndex: number;
  peakDaySharePct: number;
  bestFocusDay: { date: string } | null;
  avgDailyFocus: number;
}

export const CharacterTab: React.FC<CharacterTabProps> = ({
  level,
  rankFromLevel,
  xpProgress,
  xpCurrent,
  xpNeeded,
  character,
  streaks,
  dayLabels,
  peakDayIndex,
  peakHourIndex,
  peakDaySharePct,
  bestFocusDay,
  avgDailyFocus,
}) => {
  return (
    <section className="panel-grid">
      <article className="panel">
        <h3>Rank + Progression</h3>
        <p className="lead-text">Current rank: {rankFromLevel(level)}</p>
        <div className="xp-mini">
          <div className="xp-mini-track">
            <span style={{ width: `${xpProgress}%` }} />
          </div>
          <small>
            XP to next level: {xpCurrent}/{xpNeeded}
          </small>
        </div>
        <p className="muted">XP lifetime: {character?.xpLifetime ?? 0}</p>
        <p className="muted">Season cap: {character?.seasonCap ?? 60}</p>
        <p className="muted">Task streak: {streaks?.taskDays ?? 0} days</p>
        <p className="muted">Focus streak: {streaks?.focusDays ?? 0} days</p>
      </article>
      <article className="panel">
        <h3>Build Direction</h3>
        <p className="muted">
          Peak day: {dayLabels[peakDayIndex]} • Peak hour:{" "}
          {String(peakHourIndex).padStart(2, "0")}:00
        </p>
        <div className="mini-progress">
          <span style={{ width: `${peakDaySharePct}%` }} />
        </div>
        <p className="muted">
          Best focus day in recent data: {bestFocusDay?.date ?? "n/a"}
        </p>
        <p className="muted">Average daily focus: {avgDailyFocus}m</p>
        <div className="mini-progress">
          <span
            style={{
              width: `${Math.min(100, Math.round((avgDailyFocus / 120) * 100))}%`,
            }}
          />
        </div>
      </article>
    </section>
  );
};
