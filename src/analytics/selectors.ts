import { db } from "../data/db";

export async function getYearHeatmap(year: number): Promise<Array<{ date: string; minutes: number }>> {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const rows = await db.analyticsDaily.where("date").between(from, to, true, true).toArray();
  return rows.map((row) => ({ date: row.date, minutes: row.focusMinutes }));
}

export async function getWeeklyTrends(): Promise<Array<{ date: string; focus: number; completions: number }>> {
  const rows = await db.analyticsDaily.orderBy("date").reverse().limit(8).toArray();
  return rows
    .reverse()
    .map((row) => ({ date: row.date, focus: row.focusMinutes, completions: row.completions }));
}
