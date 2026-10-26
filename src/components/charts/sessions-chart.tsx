"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartEmpty, ChartTooltip } from "./chart-tooltip";

const compact = new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 });

export function SessionsChart({ data }: { data: Array<{ label: string; sessions: number }> }) {
  if (!data.length) return <ChartEmpty label="GA4 no devolvió una serie para esta vista." />;
  return (
    <div className="h-[264px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="wm-sessions-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--wm-chart-2)" stopOpacity={0.38} />
              <stop offset="100%" stopColor="var(--wm-chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--wm-edge)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "var(--wm-content-faint)", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={30} />
          <YAxis tick={{ fill: "var(--wm-content-faint)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => compact.format(value)} width={52} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--wm-edge-strong)", strokeDasharray: "3 4" }} />
          <Area type="monotone" dataKey="sessions" stroke="var(--wm-chart-2)" strokeWidth={2} fill="url(#wm-sessions-fill)" activeDot={{ r: 3.5, strokeWidth: 0, fill: "var(--wm-chart-2)" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
