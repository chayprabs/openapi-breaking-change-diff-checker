export const MAX_RENDERED_REPORT_FINDINGS = 100;
export const MAX_RENDERED_REPORT_ENDPOINTS = 50;
export const MAX_RENDERED_REPORT_SCHEMAS = 50;

export function createTooManyFindingsWarning(totalFindings: number) {
  if (totalFindings <= MAX_RENDERED_REPORT_FINDINGS) {
    return null;
  }

  return `This comparison produced ${totalFindings} findings. The browser progressively renders the list in ${MAX_RENDERED_REPORT_FINDINGS}-item chunks to stay responsive, and the CLI can still process the full diff.`;
}
