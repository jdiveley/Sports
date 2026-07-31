// Generic auto-stats matching shared by the non-NFL sport adapters (NFL keeps
// its own week-windowed matcher in lib/nflverse.js). Adapters normalize their
// source data into flat rows of { name, team, opp, pos, date, fpts, ...extra }
// and this module handles name matching, recent-game trends, and
// defense-vs-position ranks the same way regardless of sport.
import { normalizeName } from '../calc.js';

export function matchAutoStats(players, rows, hist, buildUsage) {
  const byName = {};
  rows.forEach(r => { const n = normalizeName(r.name); if (!n) return; (byName[n] ??= []).push(r); });
  let matched = 0;
  const unmatched = [];
  const next = players.map(p => ({ ...p }));
  next.forEach(p => {
    let rs = byName[normalizeName(p.name)] || [];
    if (!rs.length) {
      const last = normalizeName(p.name.split(/\s+/).pop());
      rs = rows.filter(r => r.team === p.team && normalizeName(r.name).endsWith(last));
    }
    if (!rs.length) { p.auto = { matched: false }; unmatched.push(p.name); return; }
    rs = [...rs].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-hist);
    const scores = rs.map(r => r.fpts);
    if (scores.some(x => x > 0)) p.games = scores.slice(-5);
    const extra = buildUsage ? buildUsage(rs) : {};
    p.auto = { matched: true, weeks: rs.length, ...extra };
    const latest = rs[rs.length - 1];
    if (latest?.opp && !p.opp) p.opp = latest.opp;
    matched++;
  });
  return { players: next, matched, unmatched };
}

// `posGroup` optionally collapses a finer position scheme (e.g. DK's
// PG/SG/SF/PF/C) down to the granularity the source data actually supports
// (e.g. ESPN box scores only tag basketball players G/F/C). Rows are expected
// to already carry the grouped position; posGroup is applied when looking up
// a player's rank so the two line up.
export function buildDefenseRanks(players, rows, positions, posGroup = x => x) {
  const agg = {};
  rows.forEach(r => {
    if (!r.opp || !positions.includes(r.pos)) return;
    const key = `${r.opp}|${r.pos}`;
    (agg[key] ??= { pts: 0, n: 0 });
    agg[key].pts += r.fpts;
    agg[key].n++;
  });
  const ranks = {};
  positions.forEach(pos => {
    const arr = Object.entries(agg).filter(([k]) => k.endsWith('|' + pos))
      .map(([k, v]) => ({ team: k.split('|')[0], avg: v.pts / Math.max(1, v.n) }))
      .sort((a, b) => a.avg - b.avg);
    arr.forEach((x, i) => { (ranks[pos] ??= {})[x.team] = { rank: i + 1, avg: x.avg }; });
  });
  const next = players.map(p => {
    const z = ranks[posGroup(p.pos)]?.[p.opp];
    return z ? { ...p, rank: z.rank } : p;
  });
  return { players: next, ranks };
}

// Fetches `urls` with limited concurrency and returns settled JSON bodies,
// silently skipping individual failures — a handful of dropped team/game
// requests shouldn't sink the whole auto-stats download.
export async function fetchAllJson(urls, concurrency = 8) {
  const out = [];
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const idx = i++;
      try {
        const r = await fetch(urls[idx]);
        if (r.ok) out.push(await r.json());
      } catch { /* skip */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return out;
}
