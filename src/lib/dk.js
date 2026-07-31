import { normTeam, normalizeName } from './calc.js';
import { parseCSVMatrix, detectDKHeader, findCol, parseNameID } from './csv.js';

export function mapDK(text, sportConfig) {
  const m = parseCSVMatrix(text), hi = detectDKHeader(m);
  if (hi < 0) return { error: 'Could not find a DraftKings player/salary header row.' };
  const h = m[hi], idx = {
    nameid: findCol(h, ['Name + ID', 'Name+ID', 'Name ID']),
    name: findCol(h, ['Name', 'Player', 'Player Name']),
    id: findCol(h, ['ID', 'Player ID']),
    pos: findCol(h, ['Roster Position', 'Position', 'Pos']),
    salary: findCol(h, ['Salary']),
    game: findCol(h, ['Game Info', 'Game']),
    team: findCol(h, ['TeamAbbrev', 'Team Abbrev', 'Team']),
    avg: findCol(h, ['AvgPointsPerGame', 'Avg Points Per Game', 'FPPG'])
  };
  const rosterNames = [...new Set(sportConfig.rosterSlots.map(s => s.label.toUpperCase()))].concat('CPT');
  const templateRoster = h.filter(x => rosterNames.includes((x || '').trim().toUpperCase()));
  const rows = [];
  for (const r of m.slice(hi + 1)) {
    if (!r.some(x => String(x).trim())) continue;
    const nid = idx.nameid >= 0 ? parseNameID(r[idx.nameid]) : { name: idx.name >= 0 ? r[idx.name] : '', id: '' };
    const name = (idx.name >= 0 ? r[idx.name] : nid.name) || nid.name, id = (idx.id >= 0 ? r[idx.id] : nid.id) || nid.id;
    const sal = idx.salary >= 0 ? +String(r[idx.salary]).replace(/[$,]/g, '') : 0;
    const pos = idx.pos >= 0 ? (r[idx.pos] || '').trim().toUpperCase() : '';
    if (!name || !sal || !pos) continue;
    const team = idx.team >= 0 ? normTeam(r[idx.team]) : '', game = idx.game >= 0 ? (r[idx.game] || '').trim() : '';
    rows.push({ name: name.trim(), dkId: String(id || ''), roster: pos, salary: sal, team, game, avg: idx.avg >= 0 ? +r[idx.avg] || 0 : 0 });
  }
  if (!rows.length) return { error: 'A header was detected, but no player salary rows were found.' };
  return {
    dkState: {
      loaded: true, headerRow: hi, headers: h, mapping: idx, templateRoster, rawRows: m,
      playerRows: rows, games: new Set(rows.map(x => x.game).filter(Boolean))
    },
    rows
  };
}

export function primaryPosFor(roster, sportConfig) {
  const raw = (roster || '').toUpperCase().split('/').map(x => x.trim());
  const p = raw.map(x => sportConfig.posAliases[x] || x);
  for (const cand of sportConfig.posPriority) if (p.includes(cand)) return cand;
  return p[0] || '';
}

export function gameOpponent(game, team) {
  const s = (game || '').split(/\s/)[0], parts = s.split('@');
  if (parts.length !== 2) return '';
  const a = normTeam(parts[0]), b = normTeam(parts[1]), t = normTeam(team);
  return t === a ? b : t === b ? a : '';
}

export function mergeDKPlayers(players, rows, sportConfig) {
  const next = players.map(p => ({ ...p }));
  const existing = {};
  next.forEach(p => existing[normalizeName(p.name)] = p);
  rows.forEach(d => {
    const key = normalizeName(d.name);
    const pos = primaryPosFor(d.roster, sportConfig), opp = gameOpponent(d.game, d.team);
    let p = existing[key];
    if (p) {
      p.salary = d.salary; p.dkId = d.dkId; p.dkRoster = d.roster;
      if (d.team) p.team = d.team;
      if (opp) p.opp = opp;
      p.dkGame = d.game; p.dkAvg = d.avg; p.dkMatched = true;
    } else {
      p = {
        name: d.name, pos, team: d.team, opp, salary: d.salary,
        games: d.avg ? [d.avg, d.avg, d.avg, d.avg, d.avg] : [0, 0, 0, 0, 0],
        rank: 16, injury: '', total: 0, implied: 0, ownership: 0, usage: 0,
        dkId: d.dkId, dkRoster: d.roster, dkGame: d.game, dkAvg: d.avg, dkMatched: true
      };
      next.push(p); existing[key] = p;
    }
  });
  return next;
}

export function rowsFromDraftables(json) {
  return (json.draftables || []).map(d => {
    const avgAttr = (d.draftStatAttributes || []).find(a => a.id === 90);
    const gameName = (d.competition?.name || '').replace(/\s*@\s*/, '@');
    const start = d.competition?.startTime
      ? new Date(d.competition.startTime).toLocaleString('en-US', { month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit' })
      : '';
    return {
      name: d.displayName || `${d.firstName || ''} ${d.lastName || ''}`.trim(),
      dkId: String(d.draftableId || ''),
      roster: (d.position || '').toUpperCase(),
      salary: +d.salary || 0,
      team: normTeam(d.teamAbbreviation || ''),
      game: start ? `${gameName} ${start}` : gameName,
      avg: avgAttr ? +avgAttr.value || 0 : 0
    };
  }).filter(r => r.name && r.salary && r.roster);
}

export async function fetchDKSlates(sportConfig) {
  const r = await fetch(`https://api.draftkings.com/draftgroups/v1/?sport=${sportConfig.dkSport}`);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const seen = new Set();
  const groups = (j.draftGroups || []).filter(g =>
    g.contestType?.gameType === 'SalaryCap' && g.draftGroupState === 'Upcoming' &&
    !seen.has(g.draftGroupId) && seen.add(g.draftGroupId)
  );
  groups.sort((a, b) => new Date(a.minStartTime) - new Date(b.minStartTime));
  return groups;
}

export async function fetchDKDraftables(draftGroupId) {
  const r = await fetch(`https://api.draftkings.com/draftgroups/v1/draftgroups/${draftGroupId}/draftables?format=json`);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
