"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { KeywordRow } from "@/lib/keywords";
import { ChartEmpty, ChartTooltip } from "./chart-tooltip";

const BUCKETS = [
  { label: "1–3", min: 0, max: 3, color: "var(--wm-chart-2)" },
  { label: "4–10", min: 3, max: 10, color: "var(--wm-chart-1)" },
  { label: "11–20", min: 10, max: 20, color: "var(--wm-chart-6)" },
  { label: "21–50", min: 20, max: 50, color: "var(--wm-chart-3)" },
  { label: "51+", min: 50, max: Number.POSITIVE_INFINITY, color: "var(--wm-chart-4)" },
];

export function PositionChart({ rows }: { rows: KeywordRow[] }) {
  const data = BUCKETS.map((bucket) => ({
    bucket: bucket.label,
    count: rows.filter((row) => row.position > bucket.min && row.position <= bucket.max).length,
    color: bucket.color,
  }));
  const total = data.reduce((sum, item) => sum + item.count, 0);
  if (!total) return <ChartEmpty label="Sin posiciones para distribuir." />;

  return (
    <div className="h-[264px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: -24 }} barCategoryGap="26%">
          <CartesianGrid stroke="var(--wm-edge)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="bucket" tick={{ fill: "var(--wm-content-faint)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--wm-content-faint)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={46} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--wm-accent-soft)" }} />
          <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={54}>
            {data.map((item) => (
              <Cell key={item.bucket} fill={item.color} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
