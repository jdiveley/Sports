import { normTeam } from './calc.js';

export async function fetchSchedule(season, week, seasonType, sportConfig) {
  const u = `https://site.api.espn.com/apis/site/v2/sports/${sportConfig.espnPath}/scoreboard?dates=${season}&seasontype=${seasonType}&week=${week}&limit=100`;
  const r = await fetch(u);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const d = await r.json();
  return (d.events || []).map(e => {
    const c = e.competitions?.[0], cs = c?.competitors || [];
    const h = cs.find(x => x.homeAway === 'home'), a = cs.find(x => x.homeAway === 'away');
    const od = c?.odds?.[0] || {};
    return {
      id: e.id, date: e.date,
      home: normTeam(h?.team?.abbreviation), away: normTeam(a?.team?.abbreviation),
      total: +od.overUnder || 0, odds: od.details || '', status: e.status?.type?.shortDetail || ''
    };
  });
}

export function applySchedule(players, games) {
  const next = players.map(p => ({ ...p }));
  games.forEach(g => next.forEach(p => {
    if (normTeam(p.team) === g.home) { p.opp = g.away; if (g.total && !p.total) p.total = g.total; }
    else if (normTeam(p.team) === g.away) { p.opp = g.home; if (g.total && !p.total) p.total = g.total; }
  }));
  return next;
}
