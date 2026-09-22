/**
 * THE TWO LINKED PARTNERS — שנינו.
 *
 * The link is explicit data (the `Partnership` row), not an inference from the
 * user table. Inferring it — "the two oldest active accounts" — looks fine
 * until a third account exists, and then it fails *asymmetrically*: two people
 * disagree about who their partner is, and in this product that means the
 * reveal rule pairs the wrong rows. An explicit link is also what the brief
 * actually asked for.
 *
 * WHICH SIDE IS WHICH. The two person-colours must mean the same person on both
 * phones — if each partner saw themselves as ember, they could not talk about
 * "the plum line" in the summary. So the side comes from the link
 * (`partnerA` = side a), not from who is looking.
 *
 * Someone who is not in the link (a spare account, a fixture user) has no
 * partner: they can still see the shared list, but there is nobody to close a
 * day with. That is the honest answer, and it is what the screens show.
 */

import { z } from 'zod';

import { assertCan, can } from '@/core/access/can';
import { recordAudit } from '@/core/audit/record';
import type { Actor } from '@/core/auth/actor';
import { inTransaction } from '@/core/db/transaction';
import type { DbClient } from '@/core/db/types';
import { errors } from '@/core/errors/errors';

export const PARTNERSHIP_ID = 'couple';

export interface PartnerRef {
  id: string;
  name: string;
  /** First character of the name, for the round mark. */
  initial: string;
  /** Which person-colour identifies them. The same for both viewers. */
  side: 'a' | 'b';
}

export interface Partners {
  me: PartnerRef;
  /** Null until the second partner has been linked. */
  other: PartnerRef | null;
}

function initialOf(name: string): string {
  // Array.from, not name[0]: a name starting with a surrogate pair would
  // otherwise render half a character.
  return Array.from(name.trim())[0] ?? '?';
}

const LINK_SELECT = {
  partnerAId: true,
  partnerBId: true,
  partnerA: { select: { id: true, name: true, status: true } },
  partnerB: { select: { id: true, name: true, status: true } },
} as const;

export async function partnersOf(client: DbClient, actor: Actor): Promise<Partners> {
  const link = await client.partnership.findUnique({ where: { id: PARTNERSHIP_ID }, select: LINK_SELECT });

  const fallback: Partners = {
    me: { id: actor.id, name: actor.name, initial: initialOf(actor.name), side: 'a' },
    other: null,
  };
  if (!link) return fallback;

  const a: PartnerRef = { id: link.partnerA.id, name: link.partnerA.name, initial: initialOf(link.partnerA.name), side: 'a' };
  const b: PartnerRef = { id: link.partnerB.id, name: link.partnerB.name, initial: initialOf(link.partnerB.name), side: 'b' };

  if (actor.id === a.id) return { me: a, other: b };
  if (actor.id === b.id) return { me: b, other: a };
  // Signed in as somebody who is not in the couple.
  return fallback;
}

/* ── Managing the link ─────────────────────────────────────────────────── */

export const linkPartnerSchema = z.object({ partnerId: z.string() }).strict();
export type LinkPartnerInput = z.infer<typeof linkPartnerSchema>;

export interface PartnershipView {
  linked: boolean;
  partnerA: { id: string; name: string } | null;
  partnerB: { id: string; name: string } | null;
  /** Only the owner may change who the couple is. */
  canManage: boolean;
}

export async function getPartnership(client: DbClient, actor: Actor): Promise<PartnershipView> {
  const link = await client.partnership.findUnique({ where: { id: PARTNERSHIP_ID }, select: LINK_SELECT });

  return {
    linked: link !== null,
    partnerA: link ? { id: link.partnerA.id, name: link.partnerA.name } : null,
    partnerB: link ? { id: link.partnerB.id, name: link.partnerB.name } : null,
    canManage: can(actor, 'users.manage'),
  };
}

/** Active accounts that could be the second partner. */
export async function listLinkableUsers(
  client: DbClient,
  actor: Actor,
): Promise<Array<{ id: string; name: string; username: string }>> {
  assertCan(actor, 'users.manage');

  return client.user.findMany({
    where: { status: 'ACTIVE', id: { not: actor.id } },
    select: { id: true, name: true, username: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

/**
 * Link the second partner. The owner is always side A, because the owner is
 * the person who set the app up; the invited partner is side B.
 *
 * Re-linking replaces the row rather than adding one — the singleton CHECK
 * makes a second row impossible anyway. Existing day entries are NOT touched:
 * they belong to the person who wrote them, and re-linking is rare enough
 * (D-6, a partner leaving) that silently reassigning a diary would be worse
 * than leaving the old rows readable only by their author.
 */
export async function linkPartner(client: DbClient, actor: Actor, input: LinkPartnerInput): Promise<PartnershipView> {
  assertCan(actor, 'users.manage');

  if (input.partnerId === actor.id) {
    throw errors.validation('אי אפשר לקשר אותך לעצמך.', { partnerId: 'בחרו את הפרטנר השני.' });
  }

  return inTransaction(client, async (tx) => {
    const partner = await tx.user.findFirst({
      where: { id: input.partnerId, status: 'ACTIVE' },
      select: { id: true, name: true },
    });
    if (!partner) throw errors.notFound();

    await tx.partnership.upsert({
      where: { id: PARTNERSHIP_ID },
      create: { id: PARTNERSHIP_ID, partnerAId: actor.id, partnerBId: partner.id, linkedById: actor.id },
      update: { partnerAId: actor.id, partnerBId: partner.id, linkedById: actor.id },
    });

    await recordAudit(tx, {
      actor,
      action: 'partnership.linked',
      entityType: 'partnership',
      entityId: PARTNERSHIP_ID,
      subjectUserId: partner.id,
      after: { partnerName: partner.name },
    });

    return getPartnership(tx, actor);
  });
}
