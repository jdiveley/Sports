import { useDfs } from '../../state/DfsContext.jsx';

export default function OptimizerPane() {
  const { players, settings, sportConfig, updateSetting, lockStates, cycleState, runOptimize } = useDfs();

  function onSiteChange(v) {
    updateSetting('site', v);
    if (v === 'fd') { updateSetting('salaryCap', 60000); updateSetting('minSpend', 56000); }
    else { updateSetting('salaryCap', 50000); updateSetting('minSpend', 47000); }
  }

  return (
    <>
      <div className="card">
        <h3>Contest & projection strategy</h3>
        <div className="grid">
          <div className="c3"><label>Site</label>
            <select value={settings.site} onChange={e => onSiteChange(e.target.value)}>
              <option value="dk">DraftKings Classic</option><option value="fd">FanDuel</option>
            </select>
          </div>
          <div className="c3"><label>Salary cap</label><input type="number" value={settings.salaryCap} onChange={e => updateSetting('salaryCap', e.target.value)} /></div>
          <div className="c3"><label>Minimum spend</label><input type="number" value={settings.minSpend} onChange={e => updateSetting('minSpend', e.target.value)} /></div>
          <div className="c3"><label>Number of lineups</label><input type="number" min="1" max="50" value={settings.lineupCount} onChange={e => updateSetting('lineupCount', e.target.value)} /></div>
          <div className="c3"><label>Strategy</label>
            <select value={settings.strategy} onChange={e => updateSetting('strategy', e.target.value)}>
              <option value="balanced">Balanced</option><option value="cash">Cash / Floor</option><option value="gpp">GPP / Ceiling</option>
              <option value="leverage">Leverage GPP</option><option value="value">Value</option>
            </select>
          </div>
          <div className="c3"><label>Recent form weight</label><input type="number" step=".05" min=".2" max=".9" value={settings.recentWeight} onChange={e => updateSetting('recentWeight', e.target.value)} /></div>
          <div className="c3"><label>Matchup impact</label><input type="number" step=".01" min="0" max=".30" value={settings.matchupImpact} onChange={e => updateSetting('matchupImpact', e.target.value)} /></div>
          <div className="c3"><label>GPP variance</label><input type="number" min="0" max="30" value={settings.variance} onChange={e => updateSetting('variance', e.target.value)} /></div>
        </div>
      </div>
      <div className="card">
        <h3>Lineup construction</h3>
        <div className="grid">
          {sportConfig.hasTeams !== false && <div className="c3"><label>Max per {sportConfig.label} team</label><input type="number" min="2" max="8" value={settings.maxTeam} onChange={e => updateSetting('maxTeam', e.target.value)} /></div>}
          <div className="c3"><label>Max player exposure %</label><input type="number" min="10" max="100" value={settings.maxExposure} onChange={e => updateSetting('maxExposure', e.target.value)} /></div>
          <div className="c3"><label>Minimum unique players</label><input type="number" min="1" max="6" value={settings.uniquePlayers} onChange={e => updateSetting('uniquePlayers', e.target.value)} /></div>
          <div className="c3"><label>Optimizer attempts</label><input type="number" min="1000" max="50000" step="1000" value={settings.attempts} onChange={e => updateSetting('attempts', e.target.value)} /></div>
          <div className="c4"><div className="switch"><input type="checkbox" checked={settings.excludeOut} onChange={e => updateSetting('excludeOut', e.target.checked)} /><span>Exclude OUT players</span></div></div>
          {sportConfig.stackMode === 'passcatcher' && <>
            <div className="c4"><div className="switch"><input type="checkbox" checked={settings.qbStack} onChange={e => updateSetting('qbStack', e.target.checked)} /><span>Require QB stack</span></div></div>
            <div className="c4"><div className="switch"><input type="checkbox" checked={settings.bringBack} onChange={e => updateSetting('bringBack', e.target.checked)} /><span>Require opponent bring-back</span></div></div>
          </>}
        </div>
      </div>
      <div className="card">
        <h3>Locks & exclusions</h3>
        <p className="small">Tap a player's status in the list below. Locked players must appear; excluded players cannot appear.</p>
        <div className="playersGrid">
          {players.length ? players.map((p, i) => {
            const s = lockStates[p.name] || 'normal';
            const cls = s === 'locked' ? 'hot' : s === 'excluded' ? 'fade' : '';
            return (
              <button key={i} className="slot ghost" onClick={() => cycleState(p.name)}>
                <strong>{p.pos}</strong>{p.name} <span className={`tag ${cls}`}>{s}</span>
              </button>
            );
          }) : <div className="small">No players loaded.</div>}
        </div>
      </div>
      <button className="primary" style={{ width: '100%', padding: 14 }} onClick={runOptimize}>⚡ Generate Ultimate Lineups</button>
    </>
  );
}
