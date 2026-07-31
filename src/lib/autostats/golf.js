// Auto-stats adapter for Golf, via ESPN's PGA Tour scoreboard. Unlike the
// other sports, ESPN embeds full hole-by-hole relative-to-par scoring right
// on the scoreboard response (per player, per round, per hole) — no
// separate box-score fetch needed, and a single date-range request covers
// however many recent tournaments fall in the window.
import { avg } from '../calc.js';

function relToPar(displayValue) {
  if (displayValue === 'E') return 0;
  const n = parseInt(displayValue, 10);
  return Number.isFinite(n) ? n : 2; // 'OTHER' (very bad holes) -> double-bogey-or-worse bucket
}

function holePoints(rel) {
  if (rel <= -2) return 8;   // eagle or better
  if (rel === -1) return 3;  // birdie
  if (rel === 0) return .5;  // par
  if (rel === 1) return -.5; // bogey
  return -1;                 // double bogey or worse
}

// DK Golf Classic scoring, approximated from hole-by-hole relative-to-par
// values: the eagle/birdie/par/bogey/double+ buckets above, plus birdie
// streak, bogey-free-round, sub-70-round, and hole-in-one bonuses. Doesn't
// include made-cut or finish-position bonuses (need final-leaderboard rank
// data) — a derived approximation, same spirit as the other sports' formulas.
function roundFantasy(ls) {
  const holes = ls.linescores || [];
  if (holes.length !== 18) return null; // skip incomplete/in-progress rounds
  let pts = 0, bogeyFree = true, streak = 0;
  holes.forEach(h => {
    const rel = relToPar(h.scoreType?.displayValue);
    pts += holePoints(rel);
    if (rel >= 1) bogeyFree = false;
    if (rel <= -1) { streak++; if (streak % 3 === 0) pts += 3; } else streak = 0;
    if (+h.value === 1) pts += 5;
  });
  if (bogeyFree) pts += 3;
  if (+ls.value < 70) pts += 3;
  return pts;
}

export async function fetchGolfRows(days) {
  const end = new Date();
  const start = new Date(end.getTime() - Math.min(45, days) * 86400000);
  const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=${fmt(start)}-${fmt(end)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const rows = [];
  (j.events || []).forEach(e => {
    const eventStart = new Date(e.date || Date.now());
    (e.competitions?.[0]?.competitors || []).forEach(c => {
      const name = c.athlete?.displayName;
      if (!name) return;
      (c.linescores || []).forEach(ls => {
        const fpts = roundFantasy(ls);
        if (fpts === null) return;
        const toPar = ls.displayValue === 'E' ? 0 : (parseInt(ls.displayValue, 10) || 0);
        const date = new Date(eventStart.getTime() + ((ls.period || 1) - 1) * 86400000).toISOString();
        rows.push({ name, team: '', opp: '', date, pos: 'G', fpts, toPar });
      });
    });
  });
  if (!rows.length) throw new Error('No completed golf rounds found in the selected window');
  return { rows, source: `ESPN PGA Tour scoreboard (${(j.events || []).length} events)` };
}

export function buildGolfUsage(rs) {
  return { golfAvgToPar: avg(rs.map(r => r.toPar)), golfRounds: rs.length };
}
