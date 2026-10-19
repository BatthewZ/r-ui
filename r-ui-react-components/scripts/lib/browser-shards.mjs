// How `browser:check` splits a selection across browser sessions.
//
// Each shard is its own playwright-cli session (its own headless Chromium), all
// against one showcase server. Scripts flagged `timing` (frame or ms windows) are
// held out of the shards and run one after another once the shards are done, so
// no other Chromium competes for the CPU while they measure. The rest are packed
// greedily, longest first, each onto the shard with the least time so far, by
// their last recorded duration, else their `@cost`, else their tier's default.
// Inside a shard the `touch` scripts go last: CDP touch emulation leaves
// `(hover: hover)` false for the rest of the session, which the runner reopens
// after each one.

/** Seconds a script is assumed to take when no run has recorded it and it has no `@cost`. */
export const TIER_COST = { sweep: 60, page: 30, component: 10 };

/**
 * One session's peak memory (daemon + Chromium tree, PSS) by the heaviest tier it
 * runs, as measured: a solo page ~0.9 GB, a whole page ~1.2 GB, the Overview
 * sweeps (every section, screenshots, forced colours) up to 2.8 GB. A renderer
 * never gives memory back between scripts, so a session holds its heaviest.
 */
export const SESSION_GB = { sweep: 2.8, page: 1.2, component: 1.0 };
/** Kept back for the server, the runner and everything else on the machine. */
export const RESERVE_GB = 1.5;
export const MAX_SHARDS = 4;
/** Three Overview-sized sessions are ~8.4 GB; a fourth leaves no margin on a 19 GB VM. */
export const MAX_SHARDS_WITH_SWEEP = 3;

export const isTiming = (script) => script.tags.flags.includes("timing");
export const isTouch = (script) => script.tags.flags.includes("touch");

/** The seconds a script is packed by. */
export const costOf = (script, durations = {}) => durations[script.name] ?? script.tags.cost ?? TIER_COST[script.tags.tier] ?? TIER_COST.component;

/**
 * How many shards the memory allows for `scripts` (the ones that go into shards,
 * not the timing tail): what is available, less the reserve, over one session's
 * peak for the heaviest tier among them, capped at 4 (3 with a sweep) and at the
 * script count. `asked` (`--shards n`) replaces the memory's answer, not the caps.
 */
export function shardCount(scripts, availableGb, asked = null) {
  const tier = ["sweep", "page", "component"].find((t) => scripts.some((s) => s.tags.tier === t)) ?? "component";
  const perSessionGb = SESSION_GB[tier];
  const cap = tier === "sweep" ? MAX_SHARDS_WITH_SWEEP : MAX_SHARDS;
  const fits = Math.max(1, Math.floor((availableGb - RESERVE_GB) / perSessionGb));
  const wanted = Math.min(asked ?? fits, scripts.length || 1);
  return { n: Math.max(1, Math.min(wanted, cap)), tier, perSessionGb, cap, fits, capped: wanted > cap };
}

/** A deterministic shuffle (mulberry32), so a `--shuffle` order can be repeated. */
export function shuffled(list, seed) {
  let a = seed >>> 0;
  const random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The run's plan: `shards` (n lists, each packed longest first and ordered with
 * its touch scripts last) and `timing` (the serial tail). `shuffle` (a seed)
 * reorders every list, touch scripts still last, to prove the scripts do not
 * depend on what ran before them in a session.
 */
export function planShards(scripts, n, { durations = {}, shuffle = null } = {}) {
  const shards = Array.from({ length: n }, () => ({ scripts: [], seconds: 0 }));
  const packed = scripts.filter((s) => !isTiming(s)).sort((a, b) => costOf(b, durations) - costOf(a, durations) || a.name.localeCompare(b.name));
  for (const script of packed) {
    const lightest = shards.reduce((min, shard) => (shard.seconds < min.seconds ? shard : min));
    lightest.scripts.push(script);
    lightest.seconds += costOf(script, durations);
  }
  const order = (list, k) => (shuffle === null ? list : shuffled(list, shuffle + k));
  return {
    shards: shards.map(({ scripts: list, seconds }, k) => ({
      scripts: [...order(list.filter((s) => !isTouch(s)), 2 * k), ...order(list.filter(isTouch), 2 * k + 1)],
      seconds,
    })),
    timing: order(
      scripts.filter(isTiming).sort((a, b) => a.name.localeCompare(b.name)),
      2 * n,
    ),
  };
}
