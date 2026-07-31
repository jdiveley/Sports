// Auto-stats adapter for NBA/WNBA via ESPN box scores (see espnBox.js for
// why: the official NBA stats APIs don't support browser CORS).
import { avg } from '../calc.js';
import { fetchEspnRows } from './espnBox.js';

// ESPN box scores only tag basketball players with a broad G/F/C position,
// not DK's five-way PG/SG/SF/PF/C split — so defense-vs-position ranks are
// grouped down to that same granularity when looking up a player's rank.
export const NBA_DEFENDED_POSITIONS = ['G', 'F', 'C'];
export const nbaPosGroup = pos => ({ PG: 'G', SG: 'G', SF: 'F', PF: 'F' }[pos] || pos);

function bonus(pts, reb, ast, stl, blk) {
  const n = [pts, reb, ast, stl, blk].filter(x => x >= 10).length;
  return n >= 3 ? 3 : n >= 2 ? 1.5 : 0;
}

function parseBasketballBoxscore(sum, rows) {
  const bs = sum.boxscore;
  if (!bs?.players?.length) return;
  const date = sum.header?.competitions?.[0]?.date || '';
  const teamAbbr = bs.players.map(t => t.team.abbreviation);
  bs.players.forEach((t, ti) => {
    const team = t.team.abbreviation, opp = teamAbbr[1 - ti];
    const stat = t.statistics?.[0];
    if (!stat?.names || !stat.athletes) return;
    const idx = k => stat.names.indexOf(k);
    stat.athletes.forEach(a => {
      if (a.didNotPlay || !a.stats?.length) return;
      const val = k => { const i = idx(k); if (i < 0) return 0; const v = a.stats[i]; return v === undefined ? 0 : +v || 0; };
      const min = val('MIN');
      if (!min) return;
      const pts = val('PTS'), reb = val('REB'), ast = val('AST'), stl = val('STL'), blk = val('BLK'), tov = val('TO');
      const threeMade = +((a.stats[idx('3PT')] || '0-0').split('-')[0]) || 0;
      const fpts = pts + threeMade * .5 + reb * 1.25 + ast * 1.5 + stl * 2 + blk * 2 - tov * .5 + bonus(pts, reb, ast, stl, blk);
      rows.push({
        name: a.athlete.displayName, team, opp, date,
        pos: nbaPosGroup(a.athlete.position?.abbreviation || ''),
        fpts, min, pts
      });
    });
  });
}

export function fetchNBARows(sportConfig, days) {
  return fetchEspnRows(sportConfig, days, parseBasketballBoxscore);
}

export function buildNBAUsage(rs) {
  return { nbaMin: avg(rs.map(r => r.min)), nbaPtsAvg: avg(rs.map(r => r.pts)) };
}
