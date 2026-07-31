import { avg, normTeam, normalizeName } from './calc.js';
import { csvParseSmart } from './csv.js';

export function pick(row, names, def = '') {
  for (const n of names) if (row[n] !== undefined && row[n] !== '') return row[n];
  return def;
}
export function num(v) { const x = +v; return Number.isFinite(x) ? x : 0; }
export const rowPos = r => (pick(r, ['position', 'position_group']) || '').toUpperCase();
export const rowTeam = r => normTeam(pick(r, ['recent_team', 'team', 'posteam']));
export const rowOpp = r => normTeam(pick(r, ['opponent_team', 'opponent', 'defteam']));
export const rowName = r => pick(r, ['player_display_name', 'player_name', 'name']);

export function derivedFantasy(r, mode) {
  const ppr = num(pick(r, ['fantasy_points_ppr', 'fantasy_points']));
  if (ppr && mode === 'ppr') return ppr;
  const passY = num(pick(r, ['passing_yards'])), passTD = num(pick(r, ['passing_tds'])), ints = num(pick(r, ['interceptions', 'passing_interceptions']));
  const rushY = num(pick(r, ['rushing_yards'])), rushTD = num(pick(r, ['rushing_tds']));
  const recY = num(pick(r, ['receiving_yards'])), recTD = num(pick(r, ['receiving_tds'])), rec = num(pick(r, ['receptions']));
  const fum = num(pick(r, ['rushing_fumbles_lost', 'receiving_fumbles_lost', 'fumbles_lost']));
  const base = passY * .04 + passTD * 4 - ints * 1 + rushY * .1 + rushTD * 6 + recY * .1 + recTD * 6 - fum * 2;
  return base + rec * (mode === 'ppr' ? 1 : mode === 'half' ? .5 : 0);
}

export async function fetchNFLVerseRows(season, target, hist) {
  const url = `https://github.com/nflverse/nflverse-data/releases/download/player_stats/stats_player_week_${season}.csv`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const text = await r.text(), rows = csvParseSmart(text);
  const minWeek = Math.max(1, target - hist);
  const use = rows.filter(x => {
    const wk = num(pick(x, ['week'])), st = (pick(x, ['season_type'], 'REG') || 'REG').toUpperCase();
    return wk >= minWeek && wk < target && (st === 'REG' || st === 'POST');
  });
  if (!use.length) throw new Error('No prior-week rows found');
  return { rows: use, minWeek, maxWeek: target - 1, source: url };
}

export function matchAutoStats(players, rows, minWeek, maxWeek, mode) {
  const byName = {};
  rows.forEach(r => { const n = normalizeName(rowName(r)); if (!n) return; (byName[n] ??= []).push(r); });
  let matched = 0;
  const unmatched = [];
  const next = players.map(p => ({ ...p }));
  next.forEach(p => {
    let rs = byName[normalizeName(p.name)] || [];
    if (!rs.length) {
      const last = normalizeName(p.name.split(/\s+/).pop());
      rs = rows.filter(r => rowTeam(r) === p.team && normalizeName(rowName(r)).endsWith(last));
    }
    if (!rs.length) { p.auto = { matched: false }; unmatched.push(p.name); return; }
    rs = [...rs].sort((a, b) => num(a.week) - num(b.week));
    const wkmap = {}; rs.forEach(r => wkmap[num(r.week)] = r);
    const scores = [];
    for (let w = minWeek; w <= maxWeek; w++) scores.push(wkmap[w] ? derivedFantasy(wkmap[w], mode) : 0);
    if (scores.filter(x => x > 0).length) p.games = scores.slice(-5);
    const targets = avg(rs.map(r => num(pick(r, ['targets'])))), carries = avg(rs.map(r => num(pick(r, ['carries', 'rushing_attempts']))));
    const rec = avg(rs.map(r => num(pick(r, ['receptions'])))), attempts = avg(rs.map(r => num(pick(r, ['attempts', 'passing_attempts']))));
    const rushAtt = avg(rs.map(r => num(pick(r, ['carries', 'rushing_attempts']))));
    const tShare = avg(rs.map(r => num(pick(r, ['target_share', 'tgt_sh'])))), airShare = avg(rs.map(r => num(pick(r, ['air_yards_share', 'ay_sh'])))), wopr = avg(rs.map(r => num(pick(r, ['wopr']))));
    p.auto = { matched: true, targets, carries, receptions: rec, attempts, rushAttempts: rushAtt, targetShare: tShare, airShare, wopr, opportunities: carries + targets, weeks: rs.length };
    p.usage = p.pos === 'QB' ? attempts : p.pos === 'RB' ? (carries + targets) : targets;
    const latest = rs[rs.length - 1], op = rowOpp(latest);
    if (op && !p.opp) p.opp = op;
    matched++;
  });
  return { players: next, matched, unmatched };
}

export function buildDefenseRanks(players, rows, scoringMode) {
  const agg = {};
  rows.forEach(r => {
    const opp = rowOpp(r), pos = rowPos(r);
    if (!opp || !['QB', 'RB', 'WR', 'TE'].includes(pos)) return;
    const key = `${opp}|${pos}`;
    (agg[key] ??= { pts: 0, weeks: new Set() });
    agg[key].pts += derivedFantasy(r, scoringMode);
    agg[key].weeks.add(num(r.week));
  });
  const ranks = {};
  ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
    const arr = Object.entries(agg).filter(([k]) => k.endsWith('|' + pos))
      .map(([k, v]) => ({ team: k.split('|')[0], avg: v.pts / Math.max(1, v.weeks.size) }))
      .sort((a, b) => a.avg - b.avg);
    arr.forEach((x, i) => { (ranks[pos] ??= {})[x.team] = { rank: i + 1, avg: x.avg }; });
  });
  const next = players.map(p => {
    const z = ranks[p.pos]?.[p.opp];
    return z ? { ...p, rank: z.rank } : p;
  });
  return { players: next, ranks };
}
