import Link from 'next/link';
import { requireActorPage } from '@/core/auth/page-guards';
import { db } from '@/core/db/client';
import { runAttentionRules } from '@/core/follow-ups/attention';
import { listOpenFollowUps } from '@/core/follow-ups/follow-ups';
import { cx } from '@/core/ui/cx';
import { PageHeader, Section } from '@/core/ui/components/Layout';
import { EmptyState } from '@/core/ui/components/States';
import { attentionRules } from '@/domain/attention';
import type { FollowUpTargets } from '@/core/follow-ups/targets';
import { followUpTargets } from '@/domain/follow-ups';
import { FollowUpList } from '../_components/FollowUpList';

export const metadata = { title: 'לטיפול' };

const SEVERITY = {
  urgent: { mark: 'bg-danger', label: 'דחוף' },
  attention: { mark: 'bg-warning', label: 'לתשומת לב' },
  info: { mark: 'bg-rule-strong', label: 'לידיעה' },
} as const;

/**
 * Soft exceptions: nothing here is an error. Derived items disappear when the
 * data is fixed; manual follow-ups are closed by a person.
 */
export default async function AttentionPage() {
  const actor = await requireActorPage();
  const [groups, followUps] = await Promise.all([runAttentionRules(db, actor, attentionRules, 25), listOpenFollowUps(db, actor)]);
  // Widened on purpose: a domain may declare no follow-up entities at all.
  const targets: FollowUpTargets = followUpTargets;
  const hrefs = Object.fromEntries(
    followUps.map((item) => [item.id, Object.hasOwn(targets.entities, item.entityType) ? targets.entities[item.entityType]!.href(item.entityId) : null]),
  );

  return (
    <>
      <PageHeader title="לטיפול" description="רשומות תקינות שכדאי לחזור אליהן. פריט נעלם מכאן ברגע שהנתונים מתעדכנים." />

      {groups.length === 0 && followUps.length === 0 && <EmptyState title="אין כרגע דבר שממתין לטיפול" description="כאן יופיעו חריגות שהמערכת מזהה ופריטי מעקב שנפתחו ידנית. כשהנתונים יתוקנו או הפריט ייסגר, הוא ייעלם מהרשימה." />}

      {followUps.length > 0 && (
        <Section title="פריטי מעקב פתוחים" className="scroll-mt-20" description="נפתחו ידנית ונסגרים ידנית.">
          <div id="follow-ups" />
          <FollowUpList items={followUps} kinds={targets.kinds} hrefFor={hrefs} />
        </Section>
      )}

      {groups.map((group) => (
        <Section
          key={group.key}
          className="scroll-mt-20"
          title={
            <span id={group.key} className="flex items-center gap-2">
              <span aria-hidden="true" className={cx('size-2 rounded-full', SEVERITY[group.severity].mark)} />
              {group.label}
              <span className="tnum text-body font-normal text-ink-subtle">{group.total}</span>
              <span className="sr-only">({SEVERITY[group.severity].label})</span>
            </span>
          }
          description={group.description}
        >
          <ul className="surface divide-y divide-rule-faint">
            {group.items.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="block px-4 py-2.5 hover:bg-hover">
                  <span className="block text-row text-ink">{item.title}</span>
                  {item.detail && <span className="block text-label text-ink-muted">{item.detail}</span>}
                </Link>
              </li>
            ))}
          </ul>
          {group.total > group.items.length && (
            <p className="mt-2 text-meta text-ink-subtle">מוצגים {group.items.length} מתוך {group.total}.</p>
          )}
        </Section>
      ))}
    </>
  );
}
