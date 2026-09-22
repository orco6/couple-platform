/**
 * THE DOMAIN CONTRACT — the single seam between core and domain.
 *
 * Core modules import from here and nowhere else in src/domain (enforced by
 * ESLint). A new business project keeps this file's exports and replaces what
 * they point at.
 *
 *   access           roles and permissions            (src/domain/access.ts)
 *   auditVocabulary  core + domain audit actions       (src/domain/audit.ts)
 *   settings         typed business settings           (src/domain/settings.ts)
 */

import { coreAuditVocabulary, type AuditVocabulary } from '@/core/audit/vocabulary';
import { domainAuditVocabulary } from './audit';

export { access, type Permission, type Role } from './access';
export { settingDefinitions } from './settings';

export const auditVocabulary = {
  entityTypes: { ...coreAuditVocabulary.entityTypes, ...domainAuditVocabulary.entityTypes },
  actions: { ...coreAuditVocabulary.actions, ...domainAuditVocabulary.actions },
  fields: { ...coreAuditVocabulary.fields, ...domainAuditVocabulary.fields },
} satisfies AuditVocabulary;

export type AuditAction = keyof typeof auditVocabulary.actions;
