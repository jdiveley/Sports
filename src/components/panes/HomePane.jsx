import { useMemo } from 'react';
import { useDfs } from '../../state/DfsContext.jsx';
import { calc } from '../../lib/calc.js';

export default function HomePane() {
  const { players, games, settings, updateSetting, loadSchedule, scheduleStatus } = useDfs();

  const xs = useMemo(() => players.map(p => calc(p, settings)), [players, settings.recentWeight, settings.matchupImpact]);
  const top = xs.length ? Math.max(...xs.map(x => x.proj)).toFixed(1) : '0';
  const bestValue = xs.length ? Math.max(...xs.map(x => x.value)).toFixed(2) : '0';

  return (
    <>
      <div className="card">
        <h3>Weekly Command Center</h3>
        <div className="grid">
          <div className="c3 kpi"><b>{players.length}</b><span>Players loaded</span></div>
          <div className="c3 kpi"><b>{games.length}</b><span>Games loaded</span></div>
          <div className="c3 kpi"><b>{top}</b><span>Top projection</span></div>
          <div className="c3 kpi"><b>{bestValue}</b><span>Best pts / $1K</span></div>
        </div>
      </div>
      <div className="card">
        <h3>Start your week</h3>
        <div className="grid">
          <div className="c3"><label>Season</label><input type="number" value={settings.season} onChange={e => updateSetting('season', e.target.value)} /></div>
          <div className="c3"><label>NFL Week</label><input type="number" min="1" max="22" value={settings.week} onChange={e => updateSetting('week', e.target.value)} /></div>
          <div className="c3"><label>Season type</label>
            <select value={settings.seasonType} onChange={e => updateSetting('seasonType', e.target.value)}>
              <option value="2">Regular season</option>
              <option value="3">Playoffs</option>
              <option value="1">Preseason</option>
            </select>
          </div>
          <div className="c3"><label>&nbsp;</label><button className="blue" style={{ width: '100%' }} onClick={loadSchedule}>Load schedule</button></div>
        </div>
        <div className="small" style={{ marginTop: 8 }}>{scheduleStatus}</div>
      </div>
      <div className="card">
        <h3>What v3 analyzes</h3>
        <div className="grid">
          <div className="c4 kpi"><b>📈 Form</b><span>Recent production + trend + consistency</span></div>
          <div className="c4 kpi"><b>🎯 Usage</b><span>Auto targets, carries, shares & WOPR</span></div>
          <div className="c4 kpi"><b>⚔️ Matchup</b><span>Opponent rank + game environment</span></div>
          <div className="c4 kpi"><b>💰 Value</b><span>Projection relative to DFS salary</span></div>
          <div className="c4 kpi"><b>🚀 Ceiling</b><span>Volatility-adjusted tournament upside</span></div>
          <div className="c4 kpi"><b>🔗 Correlation</b><span>QB stacks and bring-backs</span></div>
        </div>
      </div>
    </>
  );
}
