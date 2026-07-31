import { useDfs } from '../../state/DfsContext.jsx';
import { calc } from '../../lib/calc.js';

export default function StacksPane() {
  const { settings, updateSetting, stackResults, runFindStacks } = useDfs();

  return (
    <>
      <div className="card">
        <h3>Stack Finder</h3>
        <div className="grid">
          <div className="c4"><label>Stack type</label>
            <select value={settings.stackType} onChange={e => updateSetting('stackType', e.target.value)}>
              <option value="double">QB + 2 pass catchers</option>
              <option value="single">QB + 1 pass catcher</option>
              <option value="bringback">QB + 2 pass catchers + opponent bring-back</option>
            </select>
          </div>
          <div className="c4"><label>Max stack salary</label><input type="number" value={settings.stackSalary} onChange={e => updateSetting('stackSalary', e.target.value)} /></div>
          <div className="c4"><label>Minimum stack projection</label><input type="number" value={settings.stackMin} onChange={e => updateSetting('stackMin', e.target.value)} /></div>
        </div>
        <button className="blue" style={{ width: '100%', marginTop: 9 }} onClick={runFindStacks}>Find best stacks</button>
      </div>
      <div className="card">
        {stackResults.length ? stackResults.map((x, i) => (
          <div className="lineup" key={i}>
            <div className="lineupHead">
              <div><b>#{i + 1} {x.line[0].team} Stack</b><div className="salary">${x.salary.toLocaleString()}</div></div>
              <div className="score">{x.ceiling.toFixed(1)}<div className="small">ceiling</div></div>
            </div>
            <div className="playersGrid">
              {x.line.map((p, j) => (
                <div className="slot" key={j}><strong>{p.pos}</strong>{p.name} <span className="small">{calc(p, settings).proj.toFixed(1)}</span></div>
              ))}
            </div>
          </div>
        )) : <div className="small">Run Stack Finder after importing players.</div>}
      </div>
    </>
  );
}
