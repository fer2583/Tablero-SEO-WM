"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartEmpty, ChartTooltip } from "./chart-tooltip";

const compact = new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 });
const day = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" }).format(parsed).replace(" de ", " ");
};

export type TrendPoint = { date: string; clicks: number; impressions: number };

export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (!data.length) return <ChartEmpty label="Search Console todavía no devolvió la serie diaria." />;
  return (
    <div className="h-[264px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="wm-clicks-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--wm-chart-1)" stopOpacity={0.38} />
              <stop offset="100%" stopColor="var(--wm-chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--wm-edge)" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={day}
            tick={{ fill: "var(--wm-content-faint)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={30}
          />
          <YAxis
            yAxisId="clicks"
            tick={{ fill: "var(--wm-content-faint)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => compact.format(value)}
            width={52}
          />
          <YAxis yAxisId="impressions" orientation="right" hide />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--wm-edge-strong)", strokeDasharray: "3 4" }} />
          <Area
            yAxisId="clicks"
            type="monotone"
            dataKey="clicks"
            stroke="var(--wm-chart-1)"
            strokeWidth={2}
            fill="url(#wm-clicks-fill)"
            activeDot={{ r: 3.5, strokeWidth: 0, fill: "var(--wm-chart-1)" }}
          />
          <Line
            yAxisId="impressions"
            type="monotone"
            dataKey="impressions"
            stroke="var(--wm-chart-5)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: "var(--wm-chart-5)" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
