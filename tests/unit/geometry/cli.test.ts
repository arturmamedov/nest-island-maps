import { describe, expect, it } from 'vitest';
import { parseArgs } from '../../../scripts/build-geometry.js';

/* The committed geometry is the source of truth, so `--write` must name the
   islands it replaces: adding a fourth island must never silently rewrite
   the three that exist. Anything unexpected is refused, not guessed at. */

describe('parseArgs', () => {
  it('builds by default and checks with --check', () => {
    expect(parseArgs([], {})).toEqual({ mode: 'build' });
    expect(parseArgs(['--check'], {})).toEqual({ mode: 'check' });
  });

  it('writes only the islands named after --write', () => {
    expect(parseArgs(['--write', 'ibiza'], {})).toEqual({ mode: 'write', islands: ['ibiza'] });
    expect(parseArgs(['--write', 'tenerife', 'gran_canaria'], {})).toEqual({ mode: 'write', islands: ['tenerife', 'gran_canaria'] });
  });

  it('refuses a bare --write, an unknown island, an unknown flag, and --check with --write', () => {
    for (const argv of [['--write'], ['--write', 'mallorca'], ['--chek'], ['ibiza'], ['--check', '--write', 'ibiza']]) {
      expect(parseArgs(argv, {}), argv.join(' ')).toHaveProperty('error');
    }
  });

  it('refuses a flag npm took for itself (`npm run geometry --check`, without the `--`) instead of running a plain build', () => {
    expect(parseArgs([], {})).toEqual({ mode: 'build' });
    for (const flag of ['npm_config_check', 'npm_config_write']) {
      const run = parseArgs([], { [flag]: 'true' });
      expect(run, flag).toHaveProperty('error');
      expect((run as { error: string }).error).toContain('npm run geometry -- --');
    }
  });
});
