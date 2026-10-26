"use client";

import dynamic from "next/dynamic";

const skeleton = () => <div className="wm-skeleton h-[264px] w-full rounded-lg" />;

export const LazyTrendChart = dynamic(() => import("./trend-chart").then((mod) => mod.TrendChart), {
  ssr: false,
  loading: skeleton,
});

export const LazyPositionChart = dynamic(() => import("./position-chart").then((mod) => mod.PositionChart), {
  ssr: false,
  loading: skeleton,
});

export const LazyOpportunityChart = dynamic(() => import("./opportunity-chart").then((mod) => mod.OpportunityChart), {
  ssr: false,
  loading: skeleton,
});

export const LazySparkline = dynamic(() => import("./sparkline").then((mod) => mod.Sparkline), {
  ssr: false,
  loading: () => <div className="h-8 w-full rounded bg-surface-2/60" />,
});

export const LazySessionsChart = dynamic(() => import("./sessions-chart").then((mod) => mod.SessionsChart), {
  ssr: false,
  loading: skeleton,
});
