# Architecture decision records

Short records of decisions that are expensive to reverse or easy to undo by accident. Add one when you
change core, choose between real alternatives, or deliberately accept a limitation.

Format: Context → Decision → Consequences. Status: Accepted / Superseded by NNNN.

| # | Decision |
|---|---|
| [0001](0001-core-domain-brand-split.md) | Core / domain / brand split with a single contract seam |
| [0002](0002-authentication.md) | Database sessions, scrypt, DB-backed throttling |
| [0003](0003-money.md) | Integer minor units, basis points, BigInt rounding |
| [0004](0004-database-conventions-and-migrations.md) | Schema conventions and migration discipline |
| [0005](0005-dates-and-time.md) | Calendar dates vs instants, business timezone |
| [0006](0006-production-safety.md) | Guards against destroying or fabricating real data |
| [0007](0007-authorization-model.md) | Permissions, escalation rule, structural scoping |
| [0008](0008-ui-foundation.md) | Tailwind semantic tokens, native dialog overlays, no motion library |
| [0009](0009-single-tenant-deployments.md) | One deployment per business, no multi-tenancy |
| [0010](0010-testing-strategy.md) | Unit / integration on real Postgres / E2E on production build |
| [0011](0011-stack-versions.md) | Stack and version choices; npm override removal conditions |
| [0012](0012-new-business-workflow.md) | New-business script, blank-domain template, injected seams, role-agnostic core |

See also [stress-tests.md](../stress-tests.md): the dental clinic build and the garage analysis.
