import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { parseCSV, csvEsc } from '../lib/csv.js';
import { normTeam } from '../lib/calc.js';
import { fetchSchedule, applySchedule as applyScheduleToPlayers } from '../lib/schedule.js';
import { mapDK, mergeDKPlayers, rowsFromDraftables, fetchDKSlates as fetchDKSlatesApi, fetchDKDraftables } from '../lib/dk.js';
import { fetchNFLVerseRows, matchAutoStats, buildDefenseRanks } from '../lib/nflverse.js';
import { matchAutoStats as matchAutoStatsGeneric, buildDefenseRanks as buildDefenseRanksGeneric } from '../lib/autostats/common.js';
import { fetchMLBRows, buildMLBUsage } from '../lib/autostats/mlb.js';
import { fetchNBARows, buildNBAUsage, NBA_DEFENDED_POSITIONS, nbaPosGroup } from '../lib/autostats/nba.js';
import { fetchNHLRows, buildNHLUsage } from '../lib/autostats/nhl.js';
import { findStacks as findStacksLib, findTeamStacks as findTeamStacksLib, optimize as optimizeLib, buildDKExportCSV, downloadText } from '../lib/optimizer.js';
import { SPORTS, SPORT_LIST, DEFAULT_SPORT, tabsForSport } from '../lib/sports.js';

const SPORT_KEY = 'ultimate_dfs_v3_sport';
const playersKey = sport => `ultimate_dfs_v3_players_${sport}`;

function loadStoredSport() {
  const s = localStorage.getItem(SPORT_KEY);
  return SPORTS[s] ? s : DEFAULT_SPORT;
}

function loadStoredPlayers(sport) {
  try { return JSON.parse(localStorage.getItem(playersKey(sport)) || '[]'); } catch { return []; }
}

const DEFAULT_SETTINGS = {
  season: 2026, week: 1, seasonType: 2,
  historyWeeks: 5, statScoring: 'ppr',
  researchPos: 'ALL', researchSort: 'grade', researchSearch: '',
  stackType: 'double', stackSalary: 30000, stackMin: 35, teamStackSize: 3,
  site: 'dk', salaryCap: 50000, minSpend: 47000, lineupCount: 10, strategy: 'balanced',
  recentWeight: .65, matchupImpact: .10, variance: 8,
  maxTeam: 4, maxExposure: 70, uniquePlayers: 2, attempts: 12000,
  qbStack: true, bringBack: false,
  dkExportMode: 'classic', dkCellFormat: 'id',
  defPos: 'QB'
};

const EMPTY_DK_STATE = { loaded: false, fileName: '', headerRow: 0, headers: [], mapping: {}, templateRoster: [], rawRows: [], playerRows: [], games: new Set() };

const DfsContext = createContext(null);

export function DfsProvider({ children }) {
  const [sport, setSportState] = useState(loadStoredSport);
  const sportConfig = SPORTS[sport];
  const TAB_ORDER = useMemo(() => tabsForSport(sportConfig), [sportConfig]);

  const [players, setPlayers] = useState(() => loadStoredPlayers(sport));
  const [games, setGames] = useState([]);
  const [results, setResults] = useState([]);
  const [stackResults, setStackResults] = useState([]);
  const [lockStates, setLockStates] = useState({});
  const [autoData, setAutoData] = useState({ rows: [], defenseRanks: {}, unmatched: [], loaded: false, source: '' });
  const [dkState, setDkState] = useState(EMPTY_DK_STATE);
  const [settings, setSettingsState] = useState(() => ({ ...DEFAULT_SETTINGS, salaryCap: sportConfig.salaryCap, minSpend: sportConfig.minSpend }));
  const [tab, setTab] = useState('home');

  const [scheduleStatus, setScheduleStatus] = useState('Load the schedule, then import your DFS salary/player CSV.');
  const [dkStatus, setDkStatus] = useState('No DraftKings slate imported.');
  const [dkLiveStatus, setDkLiveStatus] = useState('Not loaded yet.');
  const [dkSlateOptions, setDkSlateOptions] = useState([]);
  const [autoStatus, setAutoStatus] = useState('No automatic stats loaded.');
  const [autoBadge, setAutoBadge] = useState('—');

  const [toastText, setToastText] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    localStorage.setItem(playersKey(sport), JSON.stringify(players));
  }, [players, sport]);

  function setSport(next) {
    if (!SPORTS[next] || next === sport) return;
    const nextConfig = SPORTS[next];
    localStorage.setItem(SPORT_KEY, next);
    setSportState(next);
    setPlayers(loadStoredPlayers(next));
    setGames([]);
    setResults([]);
    setStackResults([]);
    setLockStates({});
    setDkState(EMPTY_DK_STATE);
    setDkStatus('No DraftKings slate imported.');
    setDkLiveStatus('Not loaded yet.');
    setDkSlateOptions([]);
    setAutoData({ rows: [], defenseRanks: {}, unmatched: [], loaded: false, source: '' });
    setSettingsState(s => ({ ...s, salaryCap: nextConfig.salaryCap, minSpend: nextConfig.minSpend, researchPos: 'ALL', defPos: nextConfig.defendedPositions?.[0] || 'QB' }));
    setTab('home');
    toast(`Switched to ${nextConfig.label}`);
  }

  function toast(text) {
    setToastText(text);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 1600);
  }

  function updateSetting(key, value) {
    setSettingsState(s => ({ ...s, [key]: value }));
  }

  function applySchedule(playerList, gameList) {
    return applyScheduleToPlayers(playerList, gameList);
  }

  async function loadSchedule() {
    if (!sportConfig.hasSchedule) { toast(`Schedule import isn't available for ${sportConfig.label} yet`); return; }
    setScheduleStatus('Loading weekly schedule…');
    try {
      const list = await fetchSchedule(+settings.season, +settings.week, +settings.seasonType, sportConfig);
      setGames(list);
      setPlayers(p => applySchedule(p, list));
      setScheduleStatus(`Loaded ${list.length} games for ${settings.season} Week ${settings.week}.`);
      toast('Schedule loaded');
    } catch {
      setScheduleStatus('Online schedule could not be loaded. Manual opponent/CSV data still works.');
      toast('Schedule load failed');
    }
  }

  function importCsv(text) {
    const rows = parseCSV(text);
    if (!rows.length) { toast('No valid CSV rows'); return 0; }
    setPlayers(p => applySchedule([...p, ...rows], games));
    toast(`${rows.length} players imported`);
    return rows.length;
  }

  function addPlayer(fields) {
    const p = {
      name: fields.name.trim(), pos: fields.pos, team: normTeam(fields.team), opp: normTeam(fields.opp),
      salary: +fields.salary, games: fields.games.split(',').map(x => +x.trim()).filter(Number.isFinite),
      rank: +fields.rank || 16, total: +fields.total || 0, implied: +fields.implied || 0,
      ownership: +fields.ownership || 0, usage: +fields.usage || 0, injury: fields.injury
    };
    if (!p.name || !p.salary || !p.games.length) { toast('Name, salary and stats required'); return false; }
    setPlayers(prev => applySchedule([...prev, p], games));
    toast('Player added');
    return true;
  }

  function delPlayer(i) {
    setPlayers(prev => prev.filter((_, idx) => idx !== i));
  }

  function clearPlayers() {
    if (!window.confirm('Clear every player?')) return;
    setPlayers([]);
    setLockStates({});
  }

  function exportCsvToClipboard() {
    const h = 'name,position,team,opponent,salary,g1,g2,g3,g4,g5,opp_rank,injury,game_total,implied,ownership,usage';
    const rows = players.map(p => [p.name, p.pos, p.team, p.opp, p.salary, ...[0, 1, 2, 3, 4].map(i => p.games[i] ?? ''), p.rank, p.injury, p.total, p.implied, p.ownership, p.usage].join(','));
    navigator.clipboard.writeText([h, ...rows].join('\n'));
    toast('CSV copied');
  }

  function cycleState(name) {
    setLockStates(s => {
      const cur = s[name] || 'normal';
      const next = cur === 'normal' ? 'locked' : cur === 'locked' ? 'excluded' : 'normal';
      return { ...s, [name]: next };
    });
  }

  function runFindStacks() {
    if (sportConfig.stackMode === 'passcatcher') { setStackResults(findStacksLib(players, settings)); return; }
    if (sportConfig.stackMode === 'team') { setStackResults(findTeamStacksLib(players, settings, sportConfig)); return; }
    toast(`Stacking isn't applicable for ${sportConfig.label}`);
  }

  function runOptimize() {
    const out = optimizeLib(players, settings, lockStates, sportConfig);
    if (out.error) { toast(out.error); return; }
    setResults(out.results);
    setTab('lineups');
    toast(`${out.results.length} lineups generated`);
  }

  function copyLineups() {
    const t = results.map((r, i) => `LINEUP ${i + 1} | $${r.salary} | ${r.proj.toFixed(1)} proj | ${r.ceiling.toFixed(1)} ceiling\n${r.line.map(p => `${p.pos}: ${p.name} (${p.team})`).join('\n')}`).join('\n\n');
    navigator.clipboard.writeText(t);
    toast('Lineups copied');
  }

  function mergeDkRows(rows) {
    setPlayers(prev => applySchedule(mergeDKPlayers(prev, rows, sportConfig), games));
  }

  function importDkCsv(text, fileName) {
    const out = mapDK(text, sportConfig);
    if (out.error) { setDkStatus(out.error); toast('DK header not detected'); return; }
    setDkState({ ...out.dkState, fileName });
    mergeDkRows(out.rows);
    setDkStatus(`Imported ${out.rows.length} DraftKings players from ${fileName}.`);
    toast(`${out.rows.length} DK players imported`);
  }

  function clearDk() {
    setDkState(EMPTY_DK_STATE);
    setDkStatus('No DraftKings slate imported.');
    toast('DK slate cleared');
  }

  async function fetchDkSlatesAction() {
    setDkLiveStatus(`Loading ${sportConfig.label} slates from DraftKings…`);
    try {
      const groups = await fetchDKSlatesApi(sportConfig);
      const options = groups.map(g => {
        const d = g.minStartTime ? new Date(g.minStartTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
        const label = `${(g.startTimeSuffix || '').trim() || 'Slate ' + g.draftGroupId} · ${d}`;
        return { value: String(g.draftGroupId), label };
      });
      setDkSlateOptions(options);
      setDkLiveStatus(options.length ? `${options.length} upcoming ${sportConfig.label} Classic slates found. Pick one and tap Import slate.` : `No upcoming ${sportConfig.label} Classic slates found right now.`);
    } catch {
      setDkSlateOptions([]);
      setDkLiveStatus('Could not reach DraftKings. Try again later, or use manual CSV import below.');
      toast('DK slate list failed');
    }
  }

  async function loadDkSlateAction(id) {
    if (!id) return;
    setDkLiveStatus('Loading salaries…');
    try {
      const json = await fetchDKDraftables(id);
      const rows = rowsFromDraftables(json);
      if (!rows.length) { setDkLiveStatus('No players found for that slate.'); return; }
      const label = `live slate ${id}`;
      setDkState({ loaded: true, fileName: label, headerRow: 0,
        headers: ['Name', 'ID', 'Roster Position', 'Salary', 'TeamAbbrev', 'Game Info', 'AvgPointsPerGame'],
        mapping: { nameid: -1, name: 0, id: 1, pos: 2, salary: 3, team: 4, game: 5, avg: 6 },
        templateRoster: [], rawRows: [], playerRows: rows, games: new Set(rows.map(x => x.game).filter(Boolean)) });
      mergeDkRows(rows);
      const msg = `Loaded ${rows.length} DraftKings players live from ${label}.`;
      setDkLiveStatus(msg);
      setDkStatus(msg);
      toast(`${rows.length} DK players loaded live`);
    } catch {
      setDkLiveStatus('Could not load that slate. Try again or use manual CSV import below.');
      toast('DK live load failed');
    }
  }

  function exportDkLineups() {
    if (!results.length) { toast('Generate lineups first'); return; }
    const out = buildDKExportCSV(results, dkState, settings.dkExportMode, settings.dkCellFormat, sportConfig);
    if (out.error) { toast(out.error); return; }
    if (out.warnMissingIds) toast('Warning: some players have no DK ID');
    downloadText(`DraftKings_${sportConfig.label}_Lineups_Week_${settings.week}.csv`, out.csv);
  }

  async function fetchAutoStatsAction() {
    if (!sportConfig.hasAutoStats) { toast(`Automatic stats aren't available for ${sportConfig.label} yet`); return; }
    const hist = +settings.historyWeeks || 5;

    if (sport === 'nfl') {
      const target = +settings.week, season = +settings.season;
      if (target <= 1) { setAutoStatus('Week 1 has no current-season prior weeks. Use prior-season data manually or import preseason projections.'); return; }
      setAutoStatus('Downloading nflverse weekly player stats…');
      try {
        const { rows, minWeek, maxWeek, source } = await fetchNFLVerseRows(season, target, hist);
        const m = matchAutoStats(players, rows, minWeek, maxWeek, settings.statScoring);
        const d = buildDefenseRanks(m.players, rows, settings.statScoring);
        setPlayers(d.players);
        setAutoData({ rows, defenseRanks: d.ranks, unmatched: m.unmatched, loaded: true, source });
        setAutoStatus(`Loaded ${rows.length.toLocaleString()} player-week records from nflverse for Weeks ${minWeek}–${maxWeek}.`);
        setAutoBadge('LIVE');
        toast('Historical stats matched');
      } catch (err) {
        console.error(err);
        setAutoStatus('Automatic nflverse download failed. Your imported/manual data is untouched. This can happen before current-season files are published or if a browser blocks the request.');
        setAutoBadge('FALLBACK');
        toast('Auto data unavailable');
      }
      return;
    }

    setAutoStatus(`Downloading recent ${sportConfig.label} game data…`);
    try {
      let fetchResult, usageBuilder, positions, posGroup;
      if (sport === 'mlb') {
        fetchResult = await fetchMLBRows(+settings.season, hist);
        usageBuilder = buildMLBUsage;
        positions = sportConfig.defendedPositions;
      } else if (sport === 'nba' || sport === 'wnba') {
        fetchResult = await fetchNBARows(sportConfig, Math.max(7, hist * 3));
        usageBuilder = buildNBAUsage;
        positions = NBA_DEFENDED_POSITIONS;
        posGroup = nbaPosGroup;
      } else if (sport === 'nhl') {
        fetchResult = await fetchNHLRows(sportConfig, Math.max(7, hist * 3));
        usageBuilder = buildNHLUsage;
        positions = sportConfig.defendedPositions;
      } else {
        toast(`Automatic stats aren't available for ${sportConfig.label} yet`);
        return;
      }
      const { rows, source } = fetchResult;
      const m = matchAutoStatsGeneric(players, rows, hist, usageBuilder);
      const d = buildDefenseRanksGeneric(m.players, rows, positions, posGroup);
      setPlayers(d.players);
      setAutoData({ rows, defenseRanks: d.ranks, unmatched: m.unmatched, loaded: true, source });
      setAutoStatus(`Loaded ${rows.length.toLocaleString()} player-game records from ${source}.`);
      setAutoBadge('LIVE');
      toast('Historical stats matched');
    } catch (err) {
      console.error(err);
      setAutoStatus(`Automatic ${sportConfig.label} data download failed. Your imported/manual data is untouched. This can happen if the source is temporarily unavailable or a browser blocks the request.`);
      setAutoBadge('FALLBACK');
      toast('Auto data unavailable');
    }
  }

  function copyUnmatched() {
    navigator.clipboard.writeText(autoData.unmatched.join('\n'));
    toast('Unmatched names copied');
  }

  function goTo(id) { setTab(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function switchTab(id) { goTo(id); }
  function nextTab() { const i = TAB_ORDER.indexOf(tab); goTo(TAB_ORDER[Math.min(TAB_ORDER.length - 1, i + 1)]); }
  function prevTab() { const i = TAB_ORDER.indexOf(tab); goTo(TAB_ORDER[Math.max(0, i - 1)]); }

  const value = {
    sport, sportConfig, setSport, sportList: SPORT_LIST,
    players, games, results, stackResults, lockStates, autoData, dkState, settings, tab, TAB_ORDER,
    scheduleStatus, dkStatus, dkLiveStatus, dkSlateOptions, autoStatus, autoBadge,
    toastText, toastVisible,
    toast, updateSetting,
    loadSchedule, importCsv, addPlayer, delPlayer, clearPlayers, exportCsvToClipboard, cycleState,
    runFindStacks, runOptimize, copyLineups,
    importDkCsv, clearDk, fetchDkSlatesAction, loadDkSlateAction, exportDkLineups,
    fetchAutoStatsAction, copyUnmatched,
    switchTab, nextTab, prevTab
  };

  return <DfsContext.Provider value={value}>{children}</DfsContext.Provider>;
}

export function useDfs() {
  const ctx = useContext(DfsContext);
  if (!ctx) throw new Error('useDfs must be used within DfsProvider');
  return ctx;
}
