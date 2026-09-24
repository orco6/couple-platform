/**
 * A partner's own photo: only its owner sets or removes it, only the two of
 * them can see it, the bytes are checked, and the couple's refs carry it.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type { Actor } from '@/core/auth/actor';
import { db } from '@/core/db/client';
import { partnersOf } from '@/domain/partners';
import { getProfilePhoto, removeProfilePhoto, setProfilePhoto } from '@/domain/profile-photos';

import { caught, makeUser } from '../../support/factories';
import { makeCouple, type Couple } from './factories';

const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(100).fill(9)]);

let couple: Couple;
let outsider: Actor;

beforeEach(async () => {
  couple = await makeCouple();
  outsider = await makeUser({ role: 'PARTNER', name: 'זר' });
});

describe('a profile photo', () => {
  it('its owner sets it; both partners see it, and the couple refs carry its version', async () => {
    const { version } = await setProfilePhoto(db, couple.partner, { bytes: jpeg(), declaredType: 'image/jpeg' });

    expect((await getProfilePhoto(db, couple.owner, couple.partner.id)).bytes.length).toBe(104);
    expect((await getProfilePhoto(db, couple.partner, couple.partner.id)).mimeType).toBe('image/jpeg');

    const { me, other } = await partnersOf(db, couple.owner);
    expect(other?.photo).toBe(version);
    expect(me.photo).toBeNull();
  });

  it('someone outside the couple cannot see it — not found', async () => {
    await setProfilePhoto(db, couple.owner, { bytes: jpeg(), declaredType: 'image/jpeg' });
    expect((await caught(() => getProfilePhoto(db, outsider, couple.owner.id))).status).toBe(404);
  });

  it('replacing keeps one photo; removing takes it away', async () => {
    await setProfilePhoto(db, couple.owner, { bytes: jpeg(), declaredType: 'image/jpeg' });
    await setProfilePhoto(db, couple.owner, { bytes: jpeg(), declaredType: 'image/jpeg' });
    expect(await db.profilePhoto.count({ where: { userId: couple.owner.id } })).toBe(1);

    expect((await removeProfilePhoto(db, couple.owner)).removed).toBe(true);
    expect((await caught(() => getProfilePhoto(db, couple.partner, couple.owner.id))).status).toBe(404);
  });

  it('refuses what is not an image', async () => {
    const html = new TextEncoder().encode('<svg onload=alert(1)>');
    expect((await caught(() => setProfilePhoto(db, couple.owner, { bytes: html, declaredType: 'image/jpeg' }))).status).toBe(400);
  });
});
