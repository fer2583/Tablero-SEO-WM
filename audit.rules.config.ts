// Version changes whenever rules, weights, thresholds or exceptions change.
// Exceptions require a reason and an expiry date; they remain visible in the report.
const rules = {
  version: "2026-10-24.1",
  titleWarningLength: 60,
  shortEditorialWords: 150,
  disabled: [] as string[],
  exceptions: [] as Array<{ rule: string; url: string; reason: string; expiresAt: string }>,
};
export default rules;
