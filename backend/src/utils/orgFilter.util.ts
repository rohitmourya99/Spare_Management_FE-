import { Request } from 'express';

/**
 * Safely extracts organizationId from request query, headers, req object, or user session.
 * Fallbacks to 'BHEL' if missing, null, undefined, or empty string.
 */
export function extractOrgId(req: Request | any): string {
  if (!req) return 'BHEL';

  const queryOrg = req.query?.organizationId;
  const headerOrg = req.headers ? (req.headers['x-organization-id'] as string) : undefined;
  const reqOrg = req.organizationId;
  const userOrg = req.user?.organizationId;

  const rawCandidate = queryOrg || reqOrg || headerOrg || userOrg;

  if (!rawCandidate) return 'BHEL';

  const strCandidate = String(rawCandidate).trim();
  if (!strCandidate || strCandidate === 'null' || strCandidate === 'undefined') {
    return 'BHEL';
  }

  return strCandidate;
}

/**
 * Generates a Prisma filter clause for organizationId.
 * If active organization is 'BHEL' (or missing/default), it matches records where
 * organizationId is 'BHEL' OR organizationId IS NULL, ensuring legacy un-tagged records are included.
 * For any other organization (e.g. 'JPR'), it strictly matches organizationId = activeOrg.
 */
export function buildOrgFilter(organizationId?: string | null): { OR: Array<{ organizationId: string | null }> } | { organizationId: string } {
  const cleanOrg = (organizationId && String(organizationId).trim() && String(organizationId).trim() !== 'null' && String(organizationId).trim() !== 'undefined')
    ? String(organizationId).trim()
    : 'BHEL';

  if (cleanOrg === 'BHEL') {
    return {
      OR: [
        { organizationId: 'BHEL' },
        { organizationId: null },
      ],
    };
  }

  return { organizationId: cleanOrg };
}
