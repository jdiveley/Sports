import { clamp, calc, strategyScore } from './calc.js';
import { csvEsc } from './csv.js';

export function findStacks(players, settings) {
  const { stackType: type, stackSalary, stackMin } = settings;
  const maxSal = +stackSalary || 99999, min = +stackMin || 0;
  const qs = players.filter(p => p.pos === 'QB' && p.injury !== 'OUT');
  const rec = players.filter(p => ['WR', 'TE'].includes(p.pos) && p.injury !== 'OUT');
  let all = [];
  qs.forEach(q => {
    const mates = rec.filter(p => p.team === q.team);
    if (type === 'single') mates.forEach(a => all.push([q, a]));
    else for (let i = 0; i < mates.length; i++) for (let j = i + 1; j < mates.length; j++) {
      const core = [q, mates[i], mates[j]];
      if (type === 'bringback') players.filter(p => p.team === q.opp && ['RB', 'WR', 'TE'].includes(p.pos)).forEach(b => all.push([...core, b]));
      else all.push(core);
    }
  });
  all = all.map(line => ({
    line,
    salary: line.reduce((s, p) => s + p.salary, 0),
    proj: line.reduce((s, p) => s + calc(p, settings).proj, 0),
    ceiling: line.reduce((s, p) => s + calc(p, settings).ceiling, 0)
  })).filter(x => x.salary <= maxSal && x.proj >= min).sort((a, b) => b.ceiling - a.ceiling).slice(0, 25);
  return all;
}

function weightedPick(arr, settings) {
  if (!arr.length) return null;
  const weights = arr.map(p => Math.max(.01, strategyScore(p, settings) / Math.max(1, p.salary / 1000)));
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}

function lineupValid(line, settings, states) {
  if (line.some(x => !x) || new Set(line.map(p => p.name)).size !== line.length) return false;
  const cap = +settings.salaryCap, min = +settings.minSpend, sal = line.reduce((s, p) => s + p.salary, 0);
  if (sal > cap || sal < min) return false;
  const max = +settings.maxTeam || 4, ct = {};
  for (const p of line) { ct[p.team] = (ct[p.team] || 0) + 1; if (ct[p.team] > max) return false; }
  const locks = Object.keys(states).filter(k => states[k] === 'locked');
  if (locks.some(n => !line.some(p => p.name === n))) return false;
  if (line.some(p => states[p.name] === 'excluded')) return false;
  const q = line.find(p => p.pos === 'QB');
  if (settings.qbStack && q && !line.some(p => p.team === q.team && ['WR', 'TE'].includes(p.pos))) return false;
  if (settings.bringBack && q && !line.some(p => p.team === q.opp && ['RB', 'WR', 'TE'].includes(p.pos))) return false;
  return true;
}

function randomLine(pool, settings) {
  const pos = x => pool.filter(p => p.pos === x);
  const q = weightedPick(pos('QB'), settings), line = [q];
  const add = x => { const options = x.filter(p => !line.some(z => z.name === p.name)); const p = weightedPick(options, settings); if (p) line.push(p); };
  add(pos('RB')); add(pos('RB')); add(pos('WR')); add(pos('WR')); add(pos('WR')); add(pos('TE'));
  const flex = pool.filter(p => ['RB', 'WR', 'TE'].includes(p.pos));
  add(flex); add(pos('DST'));
  return line;
}

const lineKey = line => line.map(p => p.name).sort().join('|');
function uniqueEnough(a, b, n) { const A = new Set(a.map(p => p.name)); const same = b.filter(p => A.has(p.name)).length; return a.length - same >= n; }

export function optimize(players, settings, states) {
  const pool = players.filter(p => !(settings.excludeOut && p.injury === 'OUT') && states[p.name] !== 'excluded');
  if (['QB', 'RB', 'WR', 'TE', 'DST'].some(x => !pool.some(p => p.pos === x))) return { error: 'Player pool is missing positions' };
  const attempts = clamp(+settings.attempts || 12000, 1000, 50000);
  const cand = new Map();
  const variance = (+settings.variance || 0) / 100;
  for (let z = 0; z < attempts; z++) {
    const line = randomLine(pool, settings);
    if (!lineupValid(line, settings, states)) continue;
    const k = lineKey(line);
    if (cand.has(k)) continue;
    let score = line.reduce((s, p) => s + strategyScore(p, settings), 0);
    if (['gpp', 'leverage'].includes(settings.strategy)) score *= 1 + (Math.random() * 2 - 1) * variance;
    cand.set(k, {
      line, salary: line.reduce((s, p) => s + p.salary, 0), score,
      proj: line.reduce((s, p) => s + calc(p, settings).proj, 0),
      ceiling: line.reduce((s, p) => s + calc(p, settings).ceiling, 0)
    });
  }
  const ordered = [...cand.values()].sort((a, b) => b.score - a.score);
  const want = clamp(+settings.lineupCount || 10, 1, 50);
  const uniq = +settings.uniquePlayers || 2;
  const exp = (+settings.maxExposure || 100) / 100;
  const picked = []; const counts = {};
  for (const c of ordered) {
    if (picked.length >= want) break;
    if (picked.some(x => !uniqueEnough(c.line, x.line, uniq))) continue;
    const lim = Math.ceil(want * exp);
    if (c.line.some(p => (counts[p.name] || 0) >= lim)) continue;
    picked.push(c);
    c.line.forEach(p => counts[p.name] = (counts[p.name] || 0) + 1);
  }
  return { results: picked };
}

export function lineupToSlots(line) {
  const q = line.find(p => p.pos === 'QB'), dst = line.find(p => p.pos === 'DST');
  const rbs = line.filter(p => p.pos === 'RB'), wrs = line.filter(p => p.pos === 'WR'), tes = line.filter(p => p.pos === 'TE');
  if (!q || rbs.length < 2 || wrs.length < 3 || tes.length < 1 || !dst) return null;
  const used = new Set([q.name, rbs[0].name, rbs[1].name, wrs[0].name, wrs[1].name, wrs[2].name, tes[0].name, dst.name]);
  const flex = line.find(p => ['RB', 'WR', 'TE'].includes(p.pos) && !used.has(p.name));
  if (!flex) return null;
  return [q, rbs[0], rbs[1], wrs[0], wrs[1], wrs[2], tes[0], flex, dst];
}

export function dkCell(p, cellFormat) {
  if (cellFormat === 'name') return p.name;
  if (cellFormat === 'nameid') return p.dkId ? `${p.name} (${p.dkId})` : p.name;
  return p.dkId || p.name;
}

export function buildDKExportCSV(results, dkState, exportMode, cellFormat) {
  const classic = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'DST'];
  const headers = (exportMode === 'template' && dkState.templateRoster.length >= 9) ? dkState.templateRoster.slice(0, 9) : classic;
  const rows = [];
  for (const r of results) { const slots = lineupToSlots(r.line); if (slots) rows.push(slots.map(p => dkCell(p, cellFormat))); }
  if (!rows.length) return { error: 'No exportable NFL Classic lineups' };
  const missing = results.flatMap(r => r.line).filter(p => !p.dkId);
  const csv = [headers.map(csvEsc).join(','), ...rows.map(r => r.map(csvEsc).join(','))].join('\n');
  return { csv, warnMissingIds: cellFormat !== 'name' && missing.length > 0 };
}

export function downloadText(name, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
