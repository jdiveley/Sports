export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const sd = a => { const m = avg(a); return a.length ? Math.sqrt(avg(a.map(x => (x - m) ** 2))) : 0; };
export const normTeam = x => ({ WSH: 'WAS', JAC: 'JAX' }[(x || '').toUpperCase()] || (x || '').toUpperCase());
export const normalizeName = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/[^a-z0-9]/g, '');

export function calc(p, settings) {
  let g = (p.games || []).map(Number).filter(Number.isFinite);
  if (!g.length) g = [0];
  while (g.length < 5) g.unshift(g[0]);
  g = g.slice(-5);
  const recent = avg(g.slice(-2)), prior = avg(g.slice(0, 3));
  const rw = +(settings.recentWeight ?? .65);
  const base = recent * rw + prior * (1 - rw);
  const trend = prior ? clamp((recent - prior) / Math.max(prior, 1) * .20, -.12, .12) : 0;
  const rank = clamp(+p.rank || 16, 1, 32), mi = +(settings.matchupImpact ?? .10);
  const matchup = ((rank - 16.5) / 15.5) * mi;
  const game = +p.total || 0, implied = +p.implied || 0;
  const env = (game ? clamp((game - 44) * .008, -.06, .09) : 0) + (implied ? clamp((implied - 22) * .01, -.05, .08) : 0);
  const usage = +p.usage || 0, usageBoost = usage ? clamp((usage - 10) * .002, -.025, .045) : 0;
  const ax = p.auto || {};
  let advanced = 0;
  if (p.pos === 'WR' || p.pos === 'TE') {
    if (+ax.targetShare) advanced += clamp((+ax.targetShare - .16) * .18, -.025, .05);
    if (+ax.wopr) advanced += clamp((+ax.wopr - .45) * .08, -.02, .045);
    if (+ax.airShare) advanced += clamp((+ax.airShare - .22) * .08, -.02, .035);
  }
  if (p.pos === 'RB') {
    if (+ax.opportunities) advanced += clamp((+ax.opportunities - 16) * .003, -.025, .055);
    if (+ax.targets) advanced += clamp((+ax.targets - 3) * .006, -.015, .035);
  }
  if (p.pos === 'QB') {
    if (+ax.attempts) advanced += clamp((+ax.attempts - 32) * .002, -.02, .03);
    if (+ax.rushAttempts) advanced += clamp((+ax.rushAttempts - 3) * .006, -.012, .04);
  }
  // Sport-specific auto-data fields are namespaced (mlb*/nhl*/nba*) so they
  // never collide with NFL's fields or with each other's same-letter
  // positions (e.g. MLB catcher vs NHL/NBA center both use 'C').
  if (ax.mlbPA !== undefined) advanced += clamp((+ax.mlbPA - 4) * .015, -.03, .05) + clamp((+ax.mlbISO - .15) * .3, -.03, .05);
  if (ax.mlbIP !== undefined) advanced += clamp((+ax.mlbIP - 5) * .01, -.03, .05) + clamp((+ax.mlbKrate - 1) * .05, -.02, .05);
  if (ax.nhlToi !== undefined) advanced += clamp((+ax.nhlToi - 15) * .003, -.03, .05) + clamp((+ax.nhlShots - 2) * .015, -.02, .04);
  if (ax.nhlSavePct !== undefined) advanced += clamp((+ax.nhlSavePct - .9) * 1.5, -.04, .06);
  if (ax.nbaMin !== undefined) advanced += clamp((+ax.nbaMin - 28) * .003, -.03, .06) + clamp((+ax.nbaPtsAvg - 14) * .002, -.02, .04);
  const inj = p.injury === 'Q' ? .95 : p.injury === 'D' ? .78 : p.injury === 'OUT' ? .03 : 1;
  const proj = Math.max(0, base * (1 + trend + matchup + env + usageBoost + advanced) * inj);
  const volatility = sd(g), floor = Math.max(0, proj - .72 * volatility), ceiling = proj + 1.15 * volatility;
  const value = p.salary ? proj / (p.salary / 1000) : 0;
  const matchScore = clamp(Math.round(50 + (rank - 16.5) * 2.2 + (game ? game - 44 : 0) + (implied ? 1.3 * (implied - 22) : 0)), 1, 99);
  const consistency = clamp(100 - volatility * 7, 20, 100);
  const own = +p.ownership || 0;
  const leverage = clamp((proj * 3.5 + matchScore * .35 + value * 4) - (own * 1.4), 0, 100);
  const rawGrade = proj * 2.05 + value * 6 + matchScore * .18 + consistency * .07 + (ceiling - proj) * .65;
  const score = clamp(rawGrade, 0, 100);
  const letter = score >= 82 ? 'A' : score >= 70 ? 'B' : score >= 58 ? 'C' : score >= 45 ? 'D' : 'F';
  return { proj, floor, ceiling, value, matchScore, consistency, leverage, score, letter, trend, recent, prior, volatility };
}

export function strategyScore(p, settings) {
  const x = calc(p, settings), s = settings.strategy || 'balanced';
  if (s === 'cash') return x.floor * .66 + x.proj * .34 + x.consistency * .025;
  if (s === 'gpp') return x.ceiling + x.matchScore * .025;
  if (s === 'leverage') return x.ceiling * .72 + x.proj * .28 + x.leverage * .07;
  if (s === 'value') return x.proj * (.72 + .065 * Math.min(6, x.value));
  return x.proj;
}

export const gradeClass = x => 'grade' + x;

export function usageLabel(p) {
  const a = p.auto || {};
  if (a.mlbIP !== undefined) return `${(+a.mlbIP).toFixed(1)} IP · ${(+a.mlbKrate || 0).toFixed(2)} K/IP`;
  if (a.mlbPA !== undefined) return `${(+a.mlbPA).toFixed(1)} PA · ${(+a.mlbISO || 0).toFixed(3)} ISO`;
  if (a.nhlSavePct !== undefined) return `${((+a.nhlSavePct) * 100).toFixed(1)}% SV%`;
  if (a.nhlToi !== undefined) return `${(+a.nhlToi).toFixed(1)} TOI · ${(+a.nhlShots || 0).toFixed(1)} SOG`;
  if (a.nbaMin !== undefined) return `${(+a.nbaMin).toFixed(1)} MIN · ${(+a.nbaPtsAvg || 0).toFixed(1)} PTS`;
  if (p.pos === 'QB') return a.attempts ? `${(+a.attempts).toFixed(1)} att · ${(+a.rushAttempts || 0).toFixed(1)} rush` : (p.usage || '—');
  if (p.pos === 'RB') return a.opportunities ? `${(+a.opportunities).toFixed(1)} opp · ${(+a.targets || 0).toFixed(1)} tgt` : (p.usage || '—');
  if (p.pos === 'WR' || p.pos === 'TE') return a.targets ? `${(+a.targets).toFixed(1)} tgt · ${((+a.targetShare || 0) * 100).toFixed(0)}% share` : (p.usage || '—');
  return '—';
}
