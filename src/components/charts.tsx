"use client";
import { useId } from "react";

function points(values: number[], width = 560, height = 190) { const max = Math.max(...values); const min = Math.min(...values); return values.map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / (max - min || 1)) * (height - 24) - 12}`).join(" "); }

export function LineChart({ values, secondary, color = "#18c5bf", height = 220 }: { values: number[]; secondary?: number[]; color?: string; height?: number }) {
  const id = useId().replaceAll(":", "");
  return <div className="chart-wrap"><svg viewBox="0 0 560 190" role="img" aria-label="Tendencia de datos demo" preserveAspectRatio="none" style={{ height }}><defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs><path d={`M 0,190 L ${points(values)} L 560,190 Z`} fill={`url(#${id})`} /><polyline points={points(values)} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{secondary && <polyline points={points(secondary)} fill="none" stroke="#8b78f6" strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" strokeLinejoin="round" />}</svg><div className="chart-labels"><span>01 Jun</span><span>08 Jun</span><span>15 Jun</span><span>22 Jun</span><span>30 Jun</span></div></div>;
}

export function Bars({ values, color = "#18c5bf" }: { values: number[]; color?: string }) { const max = Math.max(...values); return <div className="bars" aria-label="Distribución de datos demo">{values.map((v, i) => <span key={i} style={{ height: `${(v / max) * 100}%`, background: color }} />)}</div>; }

export function Donut({ value = 87, label = "Health score" }: { value?: number; label?: string }) { return <div className="donut" style={{ background: `conic-gradient(#18c5bf ${value}%, #e7eef0 0)` }}><div><strong>{value}</strong><span>{label}</span></div></div>; }
