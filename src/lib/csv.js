import { normTeam } from './calc.js';

export function parseCSV(t) {
  const lines = t.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const h = lines[0].split(',').map(x => x.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const a = line.split(',').map(x => x.trim());
    const get = k => { const i = h.indexOf(k); return i >= 0 ? a[i] : ''; };
    return {
      name: get('name'), pos: get('position').toUpperCase(), team: normTeam(get('team')), opp: normTeam(get('opponent')),
      salary: +get('salary'), games: ['g1', 'g2', 'g3', 'g4', 'g5'].map(k => +get(k) || 0),
      rank: +get('opp_rank') || 16, injury: get('injury').toUpperCase(), total: +get('game_total') || 0,
      implied: +get('implied') || 0, ownership: +get('ownership') || 0, usage: +get('usage') || 0
    };
  }).filter(p => p.name && p.pos && p.salary);
}

export function csvEsc(v) {
  v = String(v ?? '');
  return /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}

export function parseCSVMatrix(text) {
  const lines = text.replace(/^﻿/, '').replace(/\r/g, '').split('\n');
  function split(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === ',' && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }
  return lines.map(split);
}

export function normHeader(x) { return (x || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ''); }

export function detectDKHeader(matrix) {
  let best = { i: -1, score: -1 };
  matrix.slice(0, 40).forEach((row, i) => {
    const hs = row.map(normHeader);
    let score = 0;
    if (hs.some(x => ['nameid', 'name', 'player', 'playername'].includes(x))) score += 3;
    if (hs.some(x => x === 'salary')) score += 3;
    if (hs.some(x => ['rosterposition', 'position', 'pos'].includes(x))) score += 2;
    if (hs.some(x => ['id', 'playerid'].includes(x))) score += 2;
    if (hs.some(x => ['teamabbrev', 'team'].includes(x))) score += 1;
    if (hs.some(x => ['gameinfo', 'game'].includes(x))) score += 1;
    if (score > best.score) best = { i, score };
  });
  return best.score >= 5 ? best.i : -1;
}

export function findCol(headers, cands) {
  const n = headers.map(normHeader);
  for (const c of cands) { const i = n.indexOf(normHeader(c)); if (i >= 0) return i; }
  return -1;
}

export function parseNameID(v) {
  v = (v || '').trim();
  const m = v.match(/^(.*?)\s*\((\d+)\)\s*$/);
  return m ? { name: m[1].trim(), id: m[2] } : { name: v, id: '' };
}

export function csvParseSmart(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(x => x.trim());
  if (lines.length < 2) return [];
  function split(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === ',' && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }
  const h = split(lines[0]).map(x => x.trim());
  return lines.slice(1).map(line => {
    const a = split(line), o = {};
    h.forEach((k, i) => o[k] = a[i] ?? '');
    return o;
  });
}
