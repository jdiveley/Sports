// Auto-stats adapter for MLB, backed by the official free MLB Stats API
// (statsapi.mlb.com), which allows CORS and needs no API key. We hydrate each
// team's roster with recent-game hitting/pitching logs (`limit=hist` keeps
// the payload small — full-season logs are multiple MB per team).
import { avg } from '../calc.js';
import { fetchAllJson } from './common.js';

const TEAM_ALIAS = { AZ: 'ARI', CWS: 'CHW' };
const normMlbTeam = abbr => TEAM_ALIAS[abbr] || abbr;

function parseIP(ip) {
  const [w, f] = String(ip ?? '0').split('.');
  return (+w || 0) + (+(f || 0)) / 3;
}

function derivedFantasyHit(s) {
  const singles = (+s.hits || 0) - (+s.doubles || 0) - (+s.triples || 0) - (+s.homeRuns || 0);
  return singles * 3 + (+s.doubles || 0) * 5 + (+s.triples || 0) * 8 + (+s.homeRuns || 0) * 10
    + (+s.rbi || 0) * 2 + (+s.runs || 0) * 2 + (+s.baseOnBalls || 0) * 2 + (+s.hitByPitch || 0) * 2 + (+s.stolenBases || 0) * 5;
}

function derivedFantasyPitch(s) {
  const cg = +s.completeGames || 0, sho = +s.shutouts || 0;
  return (+s.wins || 0) * 4 + (+s.strikeOuts || 0) * 2 - (+s.earnedRuns || 0) * 2
    - (+s.hits || 0) * .6 - (+s.baseOnBalls || 0) * .6 - (+s.hitBatsmen || 0) * .6
    + cg * 2.5 + (sho > 0 ? 2.5 : 0);
}

export async function fetchMLBRows(season, hist) {
  const teamsRes = await fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1');
  if (!teamsRes.ok) throw new Error(`HTTP ${teamsRes.status}`);
  const teamsJson = await teamsRes.json();
  const teamAbbr = {};
  (teamsJson.teams || []).forEach(t => { teamAbbr[t.id] = normMlbTeam(t.abbreviation); });
  const ids = Object.keys(teamAbbr);
  if (!ids.length) throw new Error('No MLB teams found');

  const lim = Math.max(3, hist);
  const urls = ids.flatMap(id => ([
    `https://statsapi.mlb.com/api/v1/teams/${id}/roster?hydrate=person(stats(type=gameLog,group=hitting,season=${season},limit=${lim}))`,
    `https://statsapi.mlb.com/api/v1/teams/${id}/roster?hydrate=person(stats(type=gameLog,group=pitching,season=${season},limit=${lim}))`
  ]));
  const bodies = await fetchAllJson(urls, 8);
  if (!bodies.length) throw new Error('MLB Stats API returned no data');

  const rows = [];
  bodies.forEach(body => {
    (body.roster || []).forEach(entry => {
      const person = entry.person;
      (person.stats || []).forEach(stat => {
        const type = stat.group?.displayName === 'pitching' ? 'pitch' : 'hit';
        (stat.splits || []).forEach(split => {
          const s = split.stat || {};
          const team = teamAbbr[split.team?.id] || normMlbTeam(split.team?.abbreviation || '');
          const opp = teamAbbr[split.opponent?.id] || '';
          if (type === 'pitch') {
            rows.push({
              name: person.fullName, team, opp, date: split.date, pos: 'P', type,
              fpts: derivedFantasyPitch(s), ip: parseIP(s.inningsPitched), k: +s.strikeOuts || 0
            });
          } else {
            const pos = { LF: 'OF', CF: 'OF', RF: 'OF' }[person.primaryPosition?.abbreviation] || person.primaryPosition?.abbreviation || '';
            rows.push({
              name: person.fullName, team, opp, date: split.date, pos, type,
              fpts: derivedFantasyHit(s), pa: +s.plateAppearances || 0, ab: +s.atBats || 0,
              doubles: +s.doubles || 0, triples: +s.triples || 0, hr: +s.homeRuns || 0
            });
          }
        });
      });
    });
  });
  if (!rows.length) throw new Error('No MLB game log rows found');
  return { rows, source: 'MLB Stats API (statsapi.mlb.com)' };
}

export function buildMLBUsage(rs) {
  const last = rs[rs.length - 1];
  if (last.type === 'pitch') {
    const ip = rs.filter(r => r.type === 'pitch');
    const ipAvg = avg(ip.map(r => r.ip));
    const kAvg = avg(ip.map(r => r.k));
    return { mlbIP: ipAvg, mlbKrate: ipAvg ? kAvg / ipAvg : 0 };
  }
  const hit = rs.filter(r => r.type === 'hit');
  const paAvg = avg(hit.map(r => r.pa));
  const abSum = hit.reduce((s, r) => s + r.ab, 0);
  const xb = hit.reduce((s, r) => s + r.doubles + r.triples * 2 + r.hr * 3, 0);
  return { mlbPA: paAvg, mlbISO: abSum ? xb / abSum : 0 };
}
