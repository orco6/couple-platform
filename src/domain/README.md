# src/domain — this business

Replace per project. Files core depends on (keep their export names):
- `contract.ts` — the only seam core imports (`access`, `auditVocabulary`, `settingDefinitions`)
- `access.ts` — roles and permissions
- `audit.ts` — audit actions, entity labels, field labels/formats
- `settings.ts` — business settings with schema + default

App-level: `navigation.ts`. Entities, rules and calculations live in folders (`sample/` is the worked
example — delete it for a real project; see DOMAIN_IMPLEMENTATION_CHECKLIST.md).
