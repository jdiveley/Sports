import { useMemo } from 'react';
import { useDfs } from '../../state/DfsContext.jsx';
import { usageLabel } from '../../lib/calc.js';

const SOURCE_NOTE = {
  nfl: 'V4 can pull prior-week player stats from nflverse, match them to your DFS salary pool, populate recent fantasy scores and usage metrics, then calculate opponent fantasy-points-allowed ranks by position.',
  mlb: 'Pulls recent hitting and pitching game logs from the official MLB Stats API, matches them to your DFS salary pool, populates recent DK-style fantasy scores, and calculates opponent fantasy-points-allowed ranks by position.',
  nba: 'Scans recent completed games via ESPN box scores, matches players to your DFS salary pool, populates recent DK-style fantasy scores, and calculates opponent fantasy-points-allowed ranks (grouped Guard/Forward/Center). Slower than a single bulk file since it fetches many recent box scores.',
  wnba: 'Scans recent completed games via ESPN box scores, matches players to your DFS salary pool, populates recent DK-style fantasy scores, and calculates opponent fantasy-points-allowed ranks by position. Slower than a single bulk file since it fetches many recent box scores.',
  nhl: 'Scans recent completed games via ESPN box scores, matches skaters and goalies to your DFS salary pool, populates recent DK-style fantasy scores, and calculates opponent fantasy-points-allowed ranks by position. Slower than a single bulk file since it fetches many recent box scores.',
  golf: "Pulls hole-by-hole scoring from recent PGA Tour events via ESPN, matches golfers to your DFS pool, and derives DK-style fantasy scores per round (eagle/birdie/par/bogey buckets plus streak, bogey-free, and sub-70 bonuses). No opponent or team concept in golf, so there's no defense-vs-position ranking — and made-cut/finish-position bonuses aren't included since those need final-leaderboard data."
};

const USAGE_MODEL = {
  nfl: [
    ['QB', 'Attempts · rush attempts · passing/rushing production'],
    ['RB', 'Carries · targets · receptions · opportunity share'],
    ['WR', 'Targets · target share · air-yards share · WOPR'],
    ['TE', 'Targets · target share · receptions · WOPR']
  ],
  mlb: [
    ['Hitters', 'Plate appearances · isolated power (extra-base rate)'],
    ['Pitchers', 'Innings pitched · strikeouts per inning']
  ],
  nba: [['Skaters', 'Minutes played · points per game']],
  wnba: [['Skaters', 'Minutes played · points per game']],
  nhl: [
    ['Skaters', 'Time on ice · shots on goal'],
    ['Goalies', 'Save percentage']
  ],
  golf: [['Golfers', 'Average score to par · recent rounds played']]
};

export default function DataLabPane() {
  const { players, settings, sportConfig, updateSetting, autoData, autoStatus, autoBadge, fetchAutoStatsAction, copyUnmatched } = useDfs();

  const matchedCount = players.filter(p => p.auto?.matched).length;
  const defenseCount = useMemo(() => Object.values(autoData.defenseRanks).reduce((s, x) => s + Object.keys(x).length, 0), [autoData.defenseRanks]);

  const defData = autoData.defenseRanks[settings.defPos] || {};
  const defArr = useMemo(() => Object.entries(defData).sort((a, b) => a[1].rank - b[1].rank), [defData]);
  const unit = sportConfig.id === 'nfl' ? 'weeks' : 'games';
  const defPositions = sportConfig.defendedPositions || [];

  return (
    <>
      <div className="card">
        <h3>⚡ Automatic {sportConfig.label} Data Engine</h3>
        <p className="note">{SOURCE_NOTE[sportConfig.id] || `Automatic stats aren't available for ${sportConfig.label} yet.`}</p>
        <div className="grid">
          <div className="c4"><label>History window</label>
            <select value={settings.historyWeeks} onChange={e => updateSetting('historyWeeks', e.target.value)}>
              <option value="5">Last 5 {unit}</option>
              <option value="4">Last 4 {unit}</option>
              <option value="3">Last 3 {unit}</option>
              <option value="8">Last 8 {unit}</option>
            </select>
          </div>
          {sportConfig.id === 'nfl' && (
            <div className="c4"><label>Fantasy scoring source</label>
              <select value={settings.statScoring} onChange={e => updateSetting('statScoring', e.target.value)}>
                <option value="ppr">PPR / DK-style skill scoring</option>
                <option value="half">Half-PPR derived</option>
                <option value="standard">Standard derived</option>
              </select>
            </div>
          )}
          <div className="c4"><label>&nbsp;</label><button className="primary" style={{ width: '100%' }} onClick={fetchAutoStatsAction}>Download & Match Stats</button></div>
        </div>
        <div className="small" style={{ marginTop: 9 }}>{autoStatus}</div>
        <div className="grid" style={{ marginTop: 12 }}>
          <div className="c3 kpi"><b>{autoData.rows.length.toLocaleString()}</b><span>Historical rows</span></div>
          <div className="c3 kpi"><b>{matchedCount}</b><span>DFS players matched</span></div>
          <div className="c3 kpi"><b>{defenseCount}</b><span>Defense/position models</span></div>
          <div className="c3 kpi"><b>{autoBadge}</b><span>Data status</span></div>
        </div>
      </div>
      <div className="card">
        <h3>Position-specific usage model</h3>
        <div className="grid">
          {(USAGE_MODEL[sportConfig.id] || []).map(([label, desc]) => (
            <div className="c3 kpi" key={label}><b>{label}</b><span>{desc}</span></div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="row"><h3 style={{ marginRight: 'auto' }}>Auto-data match report</h3><button className="ghost auto" onClick={copyUnmatched}>Copy unmatched</button></div>
        {players.length ? (
          <div>
            {players.map((p, i) => (
              <div className="rankcard" key={i}>
                <div className="ranknum">{p.auto?.matched ? '✓' : '!'}</div>
                <div className="rankname"><b>{p.name} <span className="badge">{p.pos}</span></b>
                  <span className="small">{p.auto?.matched ? `${p.auto.weeks} historical rows · ${usageLabel(p)}` : 'No automatic name match — manual stats preserved'}</span>
                </div>
                <div>{p.auto?.matched ? <span className="tag hot">MATCHED</span> : <span className="tag fade">CHECK</span>}</div>
              </div>
            ))}
          </div>
        ) : <div className="small">Import a DFS player pool first, then run automatic stats.</div>}
      </div>
      {defPositions.length > 0 && (
        <div className="card">
          <h3>Defense vs position</h3>
          <div className="grid">
            <div className="c3"><label>Position</label>
              <select value={settings.defPos} onChange={e => updateSetting('defPos', e.target.value)}>
                {defPositions.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="c9"><label>&nbsp;</label><div className="small">Rank 1 = toughest / fewest fantasy points allowed. Highest rank = easiest / most fantasy points allowed.</div></div>
          </div>
          <div style={{ marginTop: 8 }}>
            {defArr.length ? defArr.map(([team, x]) => (
              <div className="rankcard" key={team}>
                <div className="ranknum">{x.rank}</div>
                <div className="rankname"><b>{team}</b><span className="small">{x.avg.toFixed(1)} fantasy points allowed / {unit.slice(0, -1)} to {settings.defPos}</span></div>
                <div className={x.rank <= 8 ? 'good' : x.rank >= 25 ? 'bad' : 'gold'}>{x.rank <= 8 ? 'TOUGH' : x.rank >= 25 ? 'TARGET' : 'MID'}</div>
              </div>
            )) : <div className="small">Run automatic stats to build defense-vs-position rankings.</div>}
          </div>
        </div>
      )}
    </>
  );
}
