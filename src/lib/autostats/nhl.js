// Auto-stats adapter for NHL via ESPN box scores (the official NHL API
// blocks browser CORS — see espnBox.js).
import { avg } from '../calc.js';
import { fetchEspnRows } from './espnBox.js';

const POS_ALIAS = { LW: 'W', RW: 'W' };
const mapPos = abbr => POS_ALIAS[abbr] || abbr;

function parseHockeyBoxscore(sum, rows) {
  const bs = sum.boxscore;
  if (!bs?.players?.length) return;
  const date = sum.header?.competitions?.[0]?.date || '';
  const teamAbbr = bs.players.map(t => t.team.abbreviation);
  const scoreByTeam = {};
  (sum.header?.competitions?.[0]?.competitors || []).forEach(c => { scoreByTeam[c.team?.abbreviation] = +c.score || 0; });

  bs.players.forEach((t, ti) => {
    const team = t.team.abbreviation, opp = teamAbbr[1 - ti];
    const won = (scoreByTeam[team] ?? 0) > (scoreByTeam[opp] ?? 0);
    (t.statistics || []).forEach(group => {
      if (!group.athletes?.length) return;
      const idx = k => group.keys?.indexOf(k) ?? -1;
      const val = (a, k) => { const i = idx(k); if (i < 0) return 0; const v = a.stats[i]; return v === undefined ? 0 : +v || 0; };
      if (group.name === 'goalies') {
        group.athletes.forEach(a => {
          const saves = val(a, 'saves'), ga = val(a, 'goalsAgainst');
          const toiStr = a.stats[idx('timeOnIce')] || '0:00';
          if (toiStr === '0:00') return;
          const shutout = won && ga === 0;
          const fpts = (won ? 6 : 0) + saves * .7 - ga * 3.5 + (shutout ? 4 : 0);
          rows.push({ name: a.athlete.displayName, team, opp, date, pos: 'G', fpts, saves, ga, savePct: saves + ga ? saves / (saves + ga) : 0 });
        });
        return;
      }
      group.athletes.forEach(a => {
        const toiStr = a.stats[idx('timeOnIce')] || '0:00';
        if (toiStr === '0:00') return;
        const [mm, ss] = toiStr.split(':').map(Number);
        const toi = (mm || 0) + (ss || 0) / 60;
        const goals = val(a, 'goals'), assists = val(a, 'assists'), sog = val(a, 'shotsTotal'), blocked = val(a, 'blockedShots');
        const fpts = goals * 8.5 + assists * 5 + sog * 1.5 + blocked * 1.3 + (goals >= 3 ? 3 : 0);
        rows.push({ name: a.athlete.displayName, team, opp, date, pos: mapPos(a.athlete.position?.abbreviation || ''), fpts, toi, sog });
      });
    });
  });
}

export function fetchNHLRows(sportConfig, days) {
  return fetchEspnRows(sportConfig, days, parseHockeyBoxscore);
}

export function buildNHLUsage(rs) {
  const last = rs[rs.length - 1];
  if (last.pos === 'G') return { nhlSavePct: avg(rs.map(r => r.savePct)) };
  return { nhlToi: avg(rs.map(r => r.toi)), nhlShots: avg(rs.map(r => r.sog)) };
}
