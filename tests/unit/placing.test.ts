import { describe, expect, it } from 'vitest';
import { ADDED_ICON, ADDED_SPOT, hostelAdded, placementApplies, placementPlan } from '../../src/editor/placing.js';
import { remove, tryEdit, type IslandEdit } from '../../src/editor/state.js';
import { project } from '../../src/shared/geo.js';
import { ISLANDS } from '../../src/shared/islands.js';
import { IslandDataSchema, type IslandData } from '../../src/shared/schema.js';

/* Placing (spec §2 "Adding points"): what the banner says while armed, what
   the click does, and what the status line says after it, for every kind. */

const T = ISLANDS.tenerife;
const click = { x: 412.3, y: 655.8 };

function apply(edit: IslandEdit, data: IslandData = T.seed): IslandData {
  const r = tryEdit(data, T, edit);
  if (!r.ok) throw new Error(`refused: ${r.error}`);
  expect(IslandDataSchema.safeParse(r.data).success).toBe(true);
  return r.data;
}

const landsAtClick = (p: { lat: number; lng: number }) => {
  const back = project(T.geometry.projection, p.lat, p.lng);
  expect(Math.abs(back.x - click.x)).toBeLessThan(0.01);
  expect(Math.abs(back.y - click.y)).toBeLessThan(0.01);
};

describe('placement plans', () => {
  it('a spot: the prototype’s banner and status, a New spot at the click', () => {
    const plan = placementPlan({ kind: 'spot' });
    expect(plan.banner).toBe('Click the island to drop a new spot · Esc to cancel');
    expect(plan.done).toBe(ADDED_SPOT);
    expect(ADDED_SPOT).toBe('Added — rename it in the list');
    const spot = apply(plan.edit(click)).attractions.at(-1)!;
    expect(spot).toMatchObject({ id: 'new-spot', label: 'New spot', icon: 'star' });
    landsAtClick(spot);
  });

  it('a decor icon: the prototype’s banner and status, a sun at the click', () => {
    const plan = placementPlan({ kind: 'icon' });
    expect(plan.banner).toBe('Click the map to drop a decor icon · Esc to cancel');
    expect(plan.done).toBe(ADDED_ICON);
    expect(ADDED_ICON).toBe('Icon added — click it in the list to change the icon');
    const icon = apply(plan.edit(click)).decor.at(-1)!;
    expect(icon).toMatchObject({ id: 'sun-2', icon: 'sun', size: 40, showOn: 'both' });
    landsAtClick(icon);
  });

  it('a missing hostel: named in the banner and the status, at the click, unverified', () => {
    const plan = placementPlan({ kind: 'hostel', slug: 'adeje-nest', name: 'Adeje Nest' });
    expect(plan.banner).toBe('Click the island to drop Adeje Nest · Esc to cancel');
    expect(plan.done).toBe(hostelAdded('Adeje Nest'));
    expect(plan.done).toBe('Adeje Nest added');
    const h = apply(plan.edit(click), apply(remove('hostels', 'adeje-nest'))).hostels.find((x) => x.slug === 'adeje-nest')!;
    expect(h).toMatchObject({ label: 'Adeje', coordsVerified: false });
    landsAtClick(h);
  });

  it('moving a row’s point: named in the banner and the status, at the click', () => {
    const plan = placementPlan({ kind: 'move', collection: 'hostels', key: 'puerto-nest', label: 'Puerto' });
    expect(plan.banner).toBe('Click the island to move Puerto · Esc to cancel');
    expect(plan.done).toBe('Puerto moved');
    landsAtClick(apply(plan.edit(click)).hostels.find((x) => x.slug === 'puerto-nest')!);
    const spot = placementPlan({ kind: 'move', collection: 'attractions', key: 'teide', label: 'Teide' });
    landsAtClick(apply(spot.edit(click)).attractions.find((x) => x.id === 'teide')!);
  });
});

describe('whether a placement still applies', () => {
  it('a spot or an icon always does', () => {
    expect(placementApplies({ kind: 'spot' }, T.seed)).toBe(true);
    expect(placementApplies({ kind: 'icon' }, { ...T.seed, decor: [] })).toBe(true);
  });

  it('a missing hostel only while it is still missing', () => {
    const hostel = { kind: 'hostel', slug: 'adeje-nest', name: 'Adeje Nest' } as const;
    expect(placementApplies(hostel, apply(remove('hostels', 'adeje-nest')))).toBe(true);
    expect(placementApplies(hostel, T.seed)).toBe(false);
  });

  it('moving a row’s point only while the row is there', () => {
    const puerto = { kind: 'move', collection: 'hostels', key: 'puerto-nest', label: 'Puerto' } as const;
    const teide = { kind: 'move', collection: 'attractions', key: 'teide', label: 'Teide' } as const;
    expect(placementApplies(puerto, T.seed)).toBe(true);
    expect(placementApplies(teide, T.seed)).toBe(true);
    expect(placementApplies(puerto, apply(remove('hostels', 'puerto-nest')))).toBe(false);
    expect(placementApplies(teide, apply(remove('attractions', 'teide')))).toBe(false);
  });
});
