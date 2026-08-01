// Per-sport configuration: roster construction, DK/ESPN API params, and which
// features apply. Adding a sport is mostly data here — the optimizer, DK
// import/export, and pane UIs all read from this rather than hardcoding NFL.

export const SPORTS = {
  nfl: {
    id: 'nfl', label: 'NFL', icon: '🏈',
    dkSport: 'NFL', espnPath: 'football/nfl',
    hasSchedule: true, hasAutoStats: true, stackMode: 'passcatcher',
    positions: ['QB', 'RB', 'WR', 'TE', 'DST'],
    posPriority: ['QB', 'RB', 'WR', 'TE', 'DST'],
    posAliases: { 'D/ST': 'DST' },
    defendedPositions: ['QB', 'RB', 'WR', 'TE'],
    rosterSlots: [
      { label: 'QB', elig: ['QB'] },
      { label: 'RB', elig: ['RB'] },
      { label: 'RB', elig: ['RB'] },
      { label: 'WR', elig: ['WR'] },
      { label: 'WR', elig: ['WR'] },
      { label: 'WR', elig: ['WR'] },
      { label: 'TE', elig: ['TE'] },
      { label: 'FLEX', elig: ['RB', 'WR', 'TE'] },
      { label: 'DST', elig: ['DST'] }
    ],
    salaryCap: 50000, minSpend: 47000
  },
  mlb: {
    id: 'mlb', label: 'MLB', icon: '⚾',
    dkSport: 'MLB', espnPath: 'baseball/mlb',
    hasSchedule: true, hasAutoStats: true, stackMode: 'team', stackExcludePos: ['P'],
    positions: ['P', 'C', '1B', '2B', '3B', 'SS', 'OF'],
    posPriority: ['P', 'C', '1B', '2B', '3B', 'SS', 'OF'],
    posAliases: { SP: 'P', RP: 'P' },
    defendedPositions: ['C', '1B', '2B', '3B', 'SS', 'OF'],
    rosterSlots: [
      { label: 'P', elig: ['P'] },
      { label: 'P', elig: ['P'] },
      { label: 'C', elig: ['C'] },
      { label: '1B', elig: ['1B'] },
      { label: '2B', elig: ['2B'] },
      { label: '3B', elig: ['3B'] },
      { label: 'SS', elig: ['SS'] },
      { label: 'OF', elig: ['OF'] },
      { label: 'OF', elig: ['OF'] },
      { label: 'OF', elig: ['OF'] }
    ],
    salaryCap: 50000, minSpend: 46000
  },
  nba: {
    id: 'nba', label: 'NBA', icon: '🏀',
    dkSport: 'NBA', dkLeague: 'NBA', espnPath: 'basketball/nba',
    hasSchedule: true, hasAutoStats: true, stackMode: 'none',
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    posPriority: ['PG', 'SG', 'SF', 'PF', 'C'],
    posAliases: {},
    defendedPositions: ['G', 'F', 'C'],
    rosterSlots: [
      { label: 'PG', elig: ['PG'] },
      { label: 'SG', elig: ['SG'] },
      { label: 'SF', elig: ['SF'] },
      { label: 'PF', elig: ['PF'] },
      { label: 'C', elig: ['C'] },
      { label: 'G', elig: ['PG', 'SG'] },
      { label: 'F', elig: ['SF', 'PF'] },
      { label: 'UTIL', elig: ['PG', 'SG', 'SF', 'PF', 'C'] }
    ],
    salaryCap: 50000, minSpend: 45000
  },
  wnba: {
    id: 'wnba', label: 'WNBA', icon: '🏀',
    // DraftKings' draftgroups API tags every WNBA slate with contestType.sport
    // 'NBA' too (never 'WNBA') — only leagues[0].leagueAbbreviation tells them
    // apart, hence dkLeague below.
    dkSport: 'NBA', dkLeague: 'WNBA', espnPath: 'basketball/wnba',
    hasSchedule: true, hasAutoStats: true, stackMode: 'none',
    positions: ['G', 'F'],
    posPriority: ['G', 'F'],
    // DK's WNBA draftables list positions as PG/SG/SF/PF combos (like NBA),
    // even though WNBA roster slots are only G/F/UTIL — map down to match.
    posAliases: { PG: 'G', SG: 'G', SF: 'F', PF: 'F' },
    defendedPositions: ['G', 'F'],
    rosterSlots: [
      { label: 'G', elig: ['G'] },
      { label: 'G', elig: ['G'] },
      { label: 'F', elig: ['F'] },
      { label: 'F', elig: ['F'] },
      { label: 'F', elig: ['F'] },
      { label: 'UTIL', elig: ['G', 'F'] }
    ],
    salaryCap: 50000, minSpend: 45000
  },
  nhl: {
    id: 'nhl', label: 'NHL', icon: '🏒',
    dkSport: 'NHL', espnPath: 'hockey/nhl',
    hasSchedule: true, hasAutoStats: true, stackMode: 'team', stackExcludePos: ['G'],
    positions: ['C', 'W', 'D', 'G'],
    posPriority: ['C', 'W', 'D', 'G'],
    posAliases: { LW: 'W', RW: 'W' },
    defendedPositions: ['C', 'W', 'D'],
    rosterSlots: [
      { label: 'C', elig: ['C'] },
      { label: 'C', elig: ['C'] },
      { label: 'W', elig: ['W'] },
      { label: 'W', elig: ['W'] },
      { label: 'W', elig: ['W'] },
      { label: 'D', elig: ['D'] },
      { label: 'D', elig: ['D'] },
      { label: 'UTIL', elig: ['C', 'W', 'D'] },
      { label: 'G', elig: ['G'] }
    ],
    salaryCap: 50000, minSpend: 46000
  },
  golf: {
    id: 'golf', label: 'Golf', icon: '⛳',
    dkSport: 'GOLF', espnPath: 'golf/pga',
    hasSchedule: false, hasAutoStats: true, stackMode: 'none', hasTeams: false,
    positions: ['G'],
    posPriority: ['G'],
    posAliases: {},
    defendedPositions: [],
    rosterSlots: [
      { label: 'G', elig: ['G'] },
      { label: 'G', elig: ['G'] },
      { label: 'G', elig: ['G'] },
      { label: 'G', elig: ['G'] },
      { label: 'G', elig: ['G'] },
      { label: 'G', elig: ['G'] }
    ],
    salaryCap: 50000, minSpend: 45000
  }
};

export const SPORT_LIST = Object.values(SPORTS);
export const DEFAULT_SPORT = 'nfl';

export function tabsForSport(s) {
  return [
    'home',
    ...(s.hasSchedule ? ['slate'] : []),
    'dk',
    ...(s.hasAutoStats ? ['datalab'] : []),
    'pool', 'research',
    ...(s.stackMode !== 'none' ? ['stacks'] : []),
    'optimizer', 'lineups'
  ];
}
