"use client";

import { CartesianGrid, Cell, ReferenceArea, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import type { KeywordRow } from "@/lib/keywords";
import { ChartEmpty, ChartTooltip } from "./chart-tooltip";

const compact = new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 });
const decimal = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function OpportunityChart({ rows }: { rows: KeywordRow[] }) {
  const points = rows
    .filter((row) => row.position > 0 && row.impressions > 0)
    .slice(0, 400)
    .map((row) => ({
      position: Number(row.position.toFixed(2)),
      impressions: row.impressions,
      clicks: row.clicks,
      query: row.query,
      brand: row.brand,
    }));

  if (!points.length) return <ChartEmpty label="Sin datos suficientes para el mapa de oportunidades." />;

  return (
    <div className="h-[264px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 10, bottom: 4, left: -20 }}>
          <CartesianGrid stroke="var(--wm-edge)" strokeDasharray="3 6" />
          <ReferenceArea x1={3} x2={15} fill="var(--wm-accent)" fillOpacity={0.06} />
          <XAxis
            type="number"
            dataKey="position"
            name="Posición"
            domain={[1, 40]}
            tick={{ fill: "var(--wm-content-faint)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => decimal.format(value)}
          />
          <YAxis
            type="number"
            dataKey="impressions"
            name="Impresiones"
            scale="sqrt"
            tick={{ fill: "var(--wm-content-faint)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => compact.format(value)}
            width={52}
          />
          <ZAxis type="number" dataKey="clicks" range={[36, 420]} />
          <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: "3 4", stroke: "var(--wm-edge-strong)" }} />
          <Scatter data={points} name="Keywords">
            {points.map((point, index) => (
              <Cell
                key={`${point.query}-${point.position}-${index}`}
                fill={point.brand === "brand" ? "var(--wm-chart-2)" : "var(--wm-chart-1)"}
                fillOpacity={0.6}
                stroke={point.brand === "brand" ? "var(--wm-chart-2)" : "var(--wm-chart-1)"}
                strokeOpacity={0.9}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
