import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { GeometrySchema, ISLAND_IDS, IslandIdSchema, type Geometry, type IslandId } from '../src/shared/schema.js';
import { compareGeometry } from './geometry/compare.js';
import { CHECK_TOLERANCE } from './geometry/config.js';
import { buildIsland, serializeGeometry } from './geometry/island.js';
import { overlaySvg, type OverlayUnder } from './geometry/overlay.js';

/* Rebuilds every island's coast and halo rings from the raw OSM coastlines
   (handoff README §5), in pure TypeScript (plan decision 10).

   The committed data/geometry files stay the source of truth: this script
   only matters when an island is added. So:
   - `npm run geometry` builds into test-results/geometry/: each .geo.json,
     plus an overlay SVG to judge it by eye;
   - `-- --check` does the same, then holds every path within the Hausdorff
     tolerance of the committed file, and everything else in it byte-equal;
   - `-- --write <island>…` replaces the named islands' files in
     data/geometry/, only when the owner asks for it. It must name them, so
     adding an island never rewrites the ones that exist, and it writes only
     once every island has built.
   A check never writes data/geometry. */

const ROOT = join(import.meta.dirname, '..');
const RAW = 'design_handoff_island_maps/tools/raw-osm-coastlines.json';
const OUT = 'test-results/geometry';
const committedPath = (id: IslandId) => join(ROOT, 'data/geometry', `${id}.geo.json`);
const referencePng = (id: IslandId) => join(ROOT, 'design_handoff_island_maps/reference', `original-${id}.png`);

/* One closed [lng, lat] ring per island; an enum-keyed record requires every island. */
const RawCoastlinesSchema = z.record(IslandIdSchema, z.array(z.tuple([z.number(), z.number()])).min(4));

const vertices = (d: string) => d.split('L').length;

/* A committed file's text (the check compares its bytes) and its validated contents, or null for a new island. */
function readCommitted(id: IslandId): { text: string; geometry: Geometry } | null {
  const file = committedPath(id);
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8');
  return { text, geometry: GeometrySchema.parse(JSON.parse(text)) };
}

/* The original website map where there is one (Tenerife, Gran Canaria), else the committed paths (Ibiza). */
function overlayUnder(id: IslandId, committed: Geometry | undefined): OverlayUnder {
  const png = referencePng(id);
  if (existsSync(png)) return { image: `data:image/png;base64,${readFileSync(png).toString('base64')}` };
  return { paths: committed ? [committed.island, ...committed.rings.map((r) => r.d)] : [] };
}

/** Prints one island's distances; returns how many checks failed. */
function check(built: Geometry, committedText: string | undefined): number {
  if (committedText === undefined) {
    console.error('  FAIL: there is no committed file to check against');
    return 1;
  }
  const { sameOtherwise, paths } = compareGeometry(built, committedText);
  let failures = 0;
  if (!sameOtherwise) {
    console.error('  FAIL: apart from its paths, the file differs from the committed one (projection, name, source, ring offsets or key order)');
    failures++;
  }
  for (const { path, distance, at } of paths) {
    const over = distance > CHECK_TOLERANCE;
    if (over) failures++;
    console.log(`  ${path.padEnd(7)}${distance.toFixed(2).padStart(6)} px  at (${at.x.toFixed(1)}, ${at.y.toFixed(1)})${over ? '  FAIL' : ''}`);
  }
  return failures;
}

/** What a run does: build (the default), check against data/geometry, or write the named islands over their committed files. */
export type Run = { mode: 'build' } | { mode: 'check' } | { mode: 'write'; islands: IslandId[] } | { error: string };

/**
 * Reads the command line after the script name. Anything unexpected is
 * refused rather than guessed at, including a flag npm kept for itself:
 * `npm run geometry --check` (no `--`) hands the script nothing and sets
 * npm_config_check instead, and would otherwise pass as a plain build.
 */
export function parseArgs(argv: readonly string[], env: Record<string, string | undefined> = process.env): Run {
  for (const flag of ['check', 'write'] as const) {
    if (env[`npm_config_${flag}`] !== undefined) return { error: `npm took --${flag} as its own option. Run: npm run geometry -- --${flag}` };
  }
  let checking = false;
  let writing = false;
  const islands: IslandId[] = [];
  for (const arg of argv) {
    const island = IslandIdSchema.safeParse(arg);
    if (arg === '--check') checking = true;
    else if (arg === '--write') writing = true;
    else if (writing && island.success) islands.push(island.data);
    else return { error: `unexpected "${arg}". Use --check, or --write followed by island ids (${ISLAND_IDS.join(', ')}).` };
  }
  if (checking && writing) return { error: 'use --check or --write, not both.' };
  if (!writing) return { mode: checking ? 'check' : 'build' };
  if (!islands.length) return { error: `name the islands to write, e.g. --write ${ISLAND_IDS.at(-1)}: the committed files are the source of truth.` };
  return { mode: 'write', islands };
}

function main() {
  const run = parseArgs(process.argv.slice(2));
  if ('error' in run) {
    console.error(`geometry: ${run.error}`);
    process.exitCode = 1;
    return;
  }
  // Named first, because npm can drop the `--` before a flag, and a check that ran as a plain build would look like a pass.
  console.log(
    run.mode === 'write'
      ? `geometry: WRITE data/geometry for ${run.islands.join(', ')} (replaces their committed files)`
      : run.mode === 'check'
        ? `geometry: check against data/geometry (tolerance ${CHECK_TOLERANCE} px)`
        : 'geometry: build into test-results/geometry',
  );

  const raw = RawCoastlinesSchema.parse(JSON.parse(readFileSync(join(ROOT, RAW), 'utf8')));
  mkdirSync(join(ROOT, OUT), { recursive: true });
  const builds = new Map<IslandId, Geometry>();
  let failures = 0;
  for (const id of ISLAND_IDS) {
    const started = performance.now();
    const built = buildIsland(id, raw[id]);
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    const committed = readCommitted(id);
    builds.set(id, built);
    writeFileSync(join(ROOT, OUT, `${id}.geo.json`), serializeGeometry(built));
    writeFileSync(join(ROOT, OUT, `${id}-overlay.svg`), overlaySvg({ coast: built.island, rings: built.rings.map((r) => r.d), under: overlayUnder(id, committed?.geometry) }));
    console.log(`${id}: coast ${vertices(built.island)} vertices, rings ${built.rings.map((r) => vertices(r.d)).join(' / ')} (${seconds} s)`);
    if (run.mode === 'check') failures += check(built, committed?.text);
  }
  console.log(`wrote ${OUT}/: <island>.geo.json and <island>-overlay.svg`);

  // Only now that every island has built, so a failure can't leave data/geometry half-written.
  if (run.mode === 'write') {
    for (const id of run.islands) {
      writeFileSync(committedPath(id), serializeGeometry(builds.get(id)!));
      console.log(`wrote data/geometry/${id}.geo.json`);
    }
    console.log('Now run `npm run gen`, `npm test` and `npm run test:render`: the seeds, the decor colours and the render goldens follow the geometry.');
  }
  if (run.mode !== 'check') return;
  if (failures) {
    console.error(`geometry: ${failures} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log(`geometry: every path is within ${CHECK_TOLERANCE} px of data/geometry, and the rest of each file is identical.`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
