"use client";

import { Camera, MonitorPlay } from "lucide-react";
import type { BrowserReport } from "@/lib/browser-audit/types";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";

const when = (value?: string) => (value ? new Date(value).toLocaleString("es-ES") : "Sin datos");

export function AuditExperienceView({ reports, runId }: { reports: BrowserReport[]; runId?: number }) {
  const evidenceUrl = (report: BrowserReport, name: string) => `/api/audit/runs/${runId}/evidence?report=${encodeURIComponent(report.id)}&name=${encodeURIComponent(name)}`;

  return (
    <Section
      title="Auditoría renderizada y experiencia"
      detail="Playwright + axe-core; la cobertura automática no certifica WCAG ni conversiones."
      action={<MonitorPlay className="size-4 text-content-faint" />}
    >
      <p className="rounded-lg border border-edge bg-surface-2/40 px-2.5 py-1.5 font-mono text-[10.5px] text-content-muted">
        npm run audit:browser -- --run={runId || "ID"}
      </p>

      {reports.length ? (
        <div className="mt-3 space-y-3">
          {reports.map((report) => {
            const completed = report.scenarios.filter((scenario) => scenario.status === "completed").length;
            return (
              <article key={report.id} className="rounded-lg border border-edge bg-surface-2/30">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-edge/70 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[11.5px] font-medium text-content">{when(report.createdAt)}</p>
                    <p className="text-[10px] text-content-faint">criterios {report.criteriaVersion}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={completed === report.scenarios.length ? "positive" : "caution"}>
                      {completed}/{report.scenarios.length} escenarios
                    </Badge>
                    <Badge tone={report.findings.length ? "caution" : "positive"}>{report.findings.length} hallazgos</Badge>
                  </div>
                </header>

                <div className="grid gap-2 px-3 py-2 sm:grid-cols-3">
                  <Stat label="Recorridos" value={`${report.summary.journeys.passed}/${report.summary.journeys.evaluated}`} detail="pasos verificados" />
                  <Stat label="Fallos automáticos" value={String(report.summary.automaticFailures)} detail="requieren acción" />
                  <Stat label="Para revisión" value={String(report.summary.reviewFindings)} detail="observaciones humanas" />
                </div>

                <details className="border-t border-edge/70 px-3 py-2">
                  <summary className="cursor-pointer text-[11px] font-medium text-content">Escenarios y criterios evaluados</summary>
                  <div className="mt-2 space-y-2">
                    {report.scenarios.map((scenario) => (
                      <div key={scenario.id} className="rounded-md border border-edge/70 bg-surface-1/60 px-2.5 py-1.5">
                        <p className="text-[10.5px] font-medium text-content">
                          {scenario.language} · {scenario.template} · {scenario.viewport} · {scenario.status}
                        </p>
                        <p className="break-all font-mono text-[9.5px] text-content-faint">{scenario.url}</p>
                        {scenario.screenshot && report.persistedArtifacts?.includes(scenario.screenshot) ? (
                          <a href={evidenceUrl(report, scenario.screenshot)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] text-accent hover:underline">
                            <Camera className="size-3" /> Ver captura
                          </a>
                        ) : null}
                        <div className="mt-1 space-y-0.5">
                          {scenario.checks.map((check, index) => (
                            <p key={`${check.criterion}-${index}`} className="text-[9.5px] text-content-faint">
                              <span className="text-content-muted">{check.criterion}</span>: {check.status} · {check.evidence}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>

                {report.findings.length ? (
                  <div className="space-y-1.5 border-t border-edge/70 px-3 py-2">
                    {report.findings.map((finding, index) => (
                      <details key={`${finding.scenario}-${finding.criterion}-${index}`} className="rounded-md border border-edge/70 bg-surface-1/60 px-2.5 py-1.5">
                        <summary className="cursor-pointer text-[11px] text-content">
                          <span className="text-caution">{finding.severity}</span> · {finding.title}
                          {finding.evaluation === "review" ? " · revisión humana" : ""}
                        </summary>
                        <div className="mt-1 space-y-1 text-[10px] text-content-faint">
                          <p className="break-all font-mono">{finding.url} · {finding.viewport} · confianza {finding.confidence}</p>
                          <p>{finding.evidence}</p>
                          <p className="text-content-muted">{finding.recommendation}</p>
                          {finding.artifact ? (
                            report.persistedArtifacts?.includes(finding.artifact) ? (
                              <a href={evidenceUrl(report, finding.artifact)} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                                Ver evidencia: {finding.artifact}
                              </a>
                            ) : (
                              <code>{finding.artifact}</code>
                            )
                          ) : null}
                        </div>
                      </details>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 grid place-items-center rounded-lg border border-dashed border-edge/70 px-4 py-10 text-center">
          <p className="text-[12px] font-medium text-content">Sin escenarios ejecutados</p>
          <p className="mt-1 max-w-md text-[10.5px] leading-relaxed text-content-faint">
            El runner guarda resultados y capturas en esta corrida. Las trazas se conservan como artefactos del runner.
          </p>
        </div>
      )}
    </Section>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-edge bg-surface-2/40 px-2.5 py-1.5">
      <p className="text-[9.5px] uppercase tracking-[0.07em] text-content-faint">{label}</p>
      <p className="mt-0.5 font-mono text-[13px] font-semibold tabular-nums text-content">{value}</p>
      <p className="text-[9.5px] text-content-faint">{detail}</p>
    </div>
  );
}
