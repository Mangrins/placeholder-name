import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { getWeeklyTrends, getYearHeatmap } from '../../analytics/selectors';
import {
  completionRateOnFocusDays,
  peakHourDistribution,
  peakDayDistribution,
} from '../../analytics/projections';
import { heatLevel } from '../../utils/appUtils';

interface HeatmapCell {
  date: string;
  minutes: number;
}

interface WeeklyTrendItem {
  date: string;
  focus: number;
  completions: number;
}

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const useAnalyticsTab = (ready: boolean, tasks: any[], quests: any[], character: any) => {
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrendItem[]>([]);
  const [yearHeatmap, setYearHeatmap] = useState<HeatmapCell[]>([]);
  const [peakHours, setPeakHours] = useState<number[]>(Array.from({ length: 24 }, () => 0));
  const [peakDays, setPeakDays] = useState<number[]>(Array.from({ length: 7 }, () => 0));
  const [focusDayCompletionRate, setFocusDayCompletionRate] = useState(0);
  const [analyticsRefreshTick, setAnalyticsRefreshTick] = useState(0);
  const [selectedHeatCell, setSelectedHeatCell] = useState<HeatmapCell | null>(null);

  useEffect(() => {
    const run = async () => {
      const [trend, heat, hourDist, dayDist, rate] = await Promise.all([
        getWeeklyTrends(),
        getYearHeatmap(new Date().getFullYear()),
        peakHourDistribution(),
        peakDayDistribution(),
        completionRateOnFocusDays(),
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
  }, [ready, tasks, quests, character, analyticsRefreshTick]);

  const heatmapMeta = useMemo(() => {
    const year = new Date().getFullYear();
    const byDate = new Map(yearHeatmap.map((row) => [row.date, row.minutes]));
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const cells: Array<HeatmapCell | null> = [];
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
    const monthLabels = Array.from(
      { length: columns },
      (_, col) => monthLabelsByCol.get(col) ?? "",
    );

    return { cells, columns, monthLabels };
  }, [yearHeatmap]);

  const weeklyFocus = weeklyTrend.reduce((sum, day) => sum + day.focus, 0);
  const weeklyCompletions = weeklyTrend.reduce(
    (sum, day) => sum + day.completions,
    0,
  );
  const avgDailyFocus =
    weeklyTrend.length > 0 ? Math.round(weeklyFocus / weeklyTrend.length) : 0;
  const bestFocusDay = weeklyTrend.reduce<{
    date: string;
    focus: number;
  } | null>((best, day) => {
    if (!best || day.focus > best.focus)
      return { date: day.date, focus: day.focus };
    return best;
  }, null);

  const peakHourIndex = peakHours.reduce(
    (best, value, idx, arr) => (value > arr[best] ? idx : best),
    0,
  );
  const peakDayIndex = peakDays.reduce(
    (best, value, idx, arr) => (value > arr[best] ? idx : best),
    0,
  );
  const peakHourMax = Math.max(1, ...peakHours);
  const peakDayTotal = peakDays.reduce((sum, value) => sum + value, 0);
  const peakDaySharePct =
    peakDayTotal > 0
      ? Math.round(((peakDays[peakDayIndex] ?? 0) / peakDayTotal) * 100)
      : 0;
  const weeklyFocusPeak = Math.max(1, ...weeklyTrend.map((item) => item.focus));
  const weeklyCompletionPeak = Math.max(
    1,
    ...weeklyTrend.map((item) => item.completions),
  );

  const refreshAnalytics = () => {
    setAnalyticsRefreshTick((prev) => prev + 1);
  };

  return {
    // State
    selectedHeatCell,
    setSelectedHeatCell,
    analyticsRefreshTick,

    // Computed values
    heatmapMeta,
    dayLabels,
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
    avgDailyFocus,
    bestFocusDay,
    peakHourIndex,
    peakDayIndex,

    // Functions
    refreshAnalytics,
  };
};