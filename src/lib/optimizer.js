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

function lineupValid(line, settings, states, sportConfig) {
  if (line.length !== sportConfig.rosterSlots.length) return false;
  if (line.some(x => !x) || new Set(line.map(p => p.name)).size !== line.length) return false;
  const cap = +settings.salaryCap, min = +settings.minSpend, sal = line.reduce((s, p) => s + p.salary, 0);
  if (sal > cap || sal < min) return false;
  if (sportConfig.hasTeams !== false) {
    const max = +settings.maxTeam || 4, ct = {};
    for (const p of line) { ct[p.team] = (ct[p.team] || 0) + 1; if (ct[p.team] > max) return false; }
  }
  const locks = Object.keys(states).filter(k => states[k] === 'locked');
  if (locks.some(n => !line.some(p => p.name === n))) return false;
  if (line.some(p => states[p.name] === 'excluded')) return false;
  if (sportConfig.stackMode === 'passcatcher') {
    const q = line.find(p => p.pos === 'QB');
    if (settings.qbStack && q && !line.some(p => p.team === q.team && ['WR', 'TE'].includes(p.pos))) return false;
    if (settings.bringBack && q && !line.some(p => p.team === q.opp && ['RB', 'WR', 'TE'].includes(p.pos))) return false;
  }
  return true;
}

function randomLine(pool, settings, sportConfig) {
  const line = [];
  for (const slot of sportConfig.rosterSlots) {
    const options = pool.filter(p => slot.elig.includes(p.pos) && !line.some(z => z.name === p.name));
    const p = weightedPick(options, settings);
    if (p) line.push(p);
  }
  return line;
}

const lineKey = line => line.map(p => p.name).sort().join('|');
function uniqueEnough(a, b, n) { const A = new Set(a.map(p => p.name)); const same = b.filter(p => A.has(p.name)).length; return a.length - same >= n; }

// Nudges a randomly-built lineup toward the [minSpend, salaryCap] band via
// like-for-like (same real position) swaps, so the salary shape stays valid.
// Pure random sampling rarely lands in a narrow band on its own — this fixes
// the "optimizer often returns 0 lineups even though valid ones exist" issue.
function repairSalary(line, pool, settings) {
  const cap = +settings.salaryCap, min = +settings.minSpend;
  const total = () => line.reduce((s, p) => s + p.salary, 0);
  let guard = 0;
  while (total() > cap && guard++ < 30) {
    const used = new Set(line.map(p => p.name));
    const order = [...line].sort((a, b) => b.salary - a.salary);
    let swapped = false;
    for (const cur of order) {
      const options = pool.filter(p => p.pos === cur.pos && !used.has(p.name) && p.salary < cur.salary)
        .sort((a, b) => b.salary - a.salary);
      if (!options.length) continue;
      line[line.indexOf(cur)] = options[0];
      swapped = true;
      break;
    }
    if (!swapped) break;
  }
  while (total() < min && guard++ < 30) {
    const used = new Set(line.map(p => p.name));
    const order = [...line].sort((a, b) => a.salary - b.salary);
    let swapped = false;
    for (const cur of order) {
      const options = pool.filter(p => p.pos === cur.pos && !used.has(p.name) && p.salary > cur.salary && total() - cur.salary + p.salary <= cap)
        .sort((a, b) => a.salary - b.salary);
      if (!options.length) continue;
      line[line.indexOf(cur)] = options[0];
      swapped = true;
      break;
    }
    if (!swapped) break;
  }
  return line;
}

export function optimize(players, settings, states, sportConfig) {
  const pool = players.filter(p => !(settings.excludeOut && p.injury === 'OUT') && states[p.name] !== 'excluded');
  if (sportConfig.positions.some(x => !pool.some(p => p.pos === x))) return { error: 'Player pool is missing positions' };
  const attempts = clamp(+settings.attempts || 12000, 1000, 50000);
  const cand = new Map();
  const variance = (+settings.variance || 0) / 100;
  for (let z = 0; z < attempts; z++) {
    const line = repairSalary(randomLine(pool, settings, sportConfig), pool, settings);
    if (!lineupValid(line, settings, states, sportConfig)) continue;
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

// Assigns each roster player to a DK slot, most-specific slot (fewest eligible
// positions) first, so narrow slots (QB, DST) claim their player before wide
// ones (FLEX/UTIL) greedily grab someone who was needed elsewhere.
export function lineupToSlots(line, sportConfig) {
  const order = sportConfig.rosterSlots
    .map((slot, i) => ({ slot, i }))
    .sort((a, b) => a.slot.elig.length - b.slot.elig.length);
  const used = new Set();
  const bySlotIndex = new Array(sportConfig.rosterSlots.length).fill(null);
  for (const { slot, i } of order) {
    const p = line.find(p => p && slot.elig.includes(p.pos) && !used.has(p.name));
    if (!p) return null;
    used.add(p.name);
    bySlotIndex[i] = p;
  }
  return bySlotIndex;
}

export function dkCell(p, cellFormat) {
  if (cellFormat === 'name') return p.name;
  if (cellFormat === 'nameid') return p.dkId ? `${p.name} (${p.dkId})` : p.name;
  return p.dkId || p.name;
}

export function buildDKExportCSV(results, dkState, exportMode, cellFormat, sportConfig) {
  const classic = sportConfig.rosterSlots.map(s => s.label);
  const headers = (exportMode === 'template' && dkState.templateRoster.length >= classic.length) ? dkState.templateRoster.slice(0, classic.length) : classic;
  const rows = [];
  for (const r of results) { const slots = lineupToSlots(r.line, sportConfig); if (slots) rows.push(slots.map(p => dkCell(p, cellFormat))); }
  if (!rows.length) return { error: `No exportable ${sportConfig.label} Classic lineups` };
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
