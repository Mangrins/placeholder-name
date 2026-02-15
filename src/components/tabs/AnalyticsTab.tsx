import React from "react";

interface HeatmapCell {
  date: string;
  minutes: number;
}

interface HeatmapMeta {
  columns: number;
  monthLabels: string[];
  cells: (HeatmapCell | null)[];
}

interface WeeklyTrendItem {
  date: string;
  focus: number;
  completions: number;
}

interface AnalyticsTabProps {
  heatmapMeta: HeatmapMeta;
  dayLabels: string[];
  selectedHeatCell: HeatmapCell | null;
  setSelectedHeatCell: (cell: HeatmapCell | null) => void;
  heatLevel: (minutes: number) => number;
  peakHours: number[];
  peakHourMax: number;
  peakDays: number[];
  focusDayCompletionRate: number;
  peakDaySharePct: number;
  weeklyTrend: WeeklyTrendItem[];
  weeklyFocusPeak: number;
  weeklyCompletionPeak: number;
  weeklyFocus: number;
  weeklyCompletions: number;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  heatmapMeta,
  dayLabels,
  selectedHeatCell,
  setSelectedHeatCell,
  heatLevel,
  peakHours,
  peakHourMax,
  peakDays,
  focusDayCompletionRate,
  peakDaySharePct,
  weeklyTrend,
  weeklyFocusPeak,
  weeklyCompletionPeak,
  weeklyFocus,
  weeklyCompletions,
}) => {
  return (
    <section className="analytics-layout">
      <article className="panel analytics-equal">
        <h3>Yearly Focus Heatmap</h3>
        <p className="muted">
          Intensity by day with weekday rows and month columns.
        </p>
        <div className="heatmap-frame">
          <div
            className="heatmap-months"
            style={
              {
                ["--heat-columns" as string]: String(heatmapMeta.columns),
              } as React.CSSProperties
            }
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
              style={
                {
                  ["--heat-columns" as string]: String(heatmapMeta.columns),
                } as React.CSSProperties
              }
            >
              {heatmapMeta.cells.map((cell, idx) => {
                if (!cell) {
                  return <span key={`blank-${idx}`} className="heat blank" />;
                }
                return (
                  <button
                    type="button"
                    key={cell.date}
                    className={`heat lvl-${heatLevel(cell.minutes)}`}
                    title={`${cell.date}: ${cell.minutes} min`}
                    aria-label={`${cell.date}: ${cell.minutes} focus minutes`}
                    aria-pressed={selectedHeatCell?.date === cell.date}
                    onClick={() => setSelectedHeatCell(cell)}
                  />
                );
              })}
            </div>
          </div>
        </div>
        <p className="muted" style={{ marginTop: "0.45rem" }}>
          {selectedHeatCell
            ? `${selectedHeatCell.date} • ${selectedHeatCell.minutes} min`
            : "Click a day to view date and focus time."}
        </p>
      </article>

      <div className="analytics-right">
        <article className="panel analytics-equal">
          <h3>Peak + Weekly Statistics</h3>
          <div className="hour-chart">
            {peakHours.map((value, hour) => {
              const height = Math.round((value / peakHourMax) * 100);
              return (
                <div
                  key={hour}
                  className="hour-col"
                  title={`${String(hour).padStart(2, "0")}:00 • ${value} min`}
                >
                  <span style={{ height: `${height}%` }} />
                  <small>{hour % 6 === 0 ? hour : ""}</small>
                </div>
              );
            })}
          </div>
          <div
            className="row wrap analytics-days"
            style={{ marginTop: "0.5rem" }}
          >
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
                style={
                  {
                    ["--pie-fill" as string]: `${focusDayCompletionRate}%`,
                    ["--pie-color" as string]: "var(--accent)",
                  } as React.CSSProperties
                }
              />
              <div>
                <strong>{focusDayCompletionRate}%</strong>
                <p className="muted">Focus-day completion rate</p>
              </div>
            </div>
            <div className="pie-card">
              <div
                className="pie-chart"
                style={
                  {
                    ["--pie-fill" as string]: `${peakDaySharePct}%`,
                    ["--pie-color" as string]: "var(--accent-2)",
                  } as React.CSSProperties
                }
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
                  <span
                    className="focus"
                    style={{
                      width: `${Math.round((item.focus / weeklyFocusPeak) * 100)}%`,
                    }}
                  />
                  <span
                    className="tasks"
                    style={{
                      width: `${Math.round((item.completions / weeklyCompletionPeak) * 100)}%`,
                    }}
                  />
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
  );
};
