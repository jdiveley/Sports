import { useMemo } from 'react';
import { useDfs } from '../../state/DfsContext.jsx';
import { calc } from '../../lib/calc.js';

export default function LineupsPane() {
  const { results, settings, copyLineups } = useDfs();

  const exposure = useMemo(() => {
    const counts = {};
    results.flatMap(r => r.line).forEach(p => counts[p.name] = (counts[p.name] || 0) + 1);
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [results]);

  return (
    <>
      <div className="card">
        <div className="row">
          <div>
            <h3>Generated lineups</h3>
            <div className="small">{results.length ? `${results.length} lineups · ${settings.strategy.toUpperCase()} strategy` : 'No results yet.'}</div>
          </div>
          <button className="ghost auto" onClick={copyLineups}>Copy</button>
        </div>
        {results.length ? results.map((r, i) => (
          <div className="lineup" key={i}>
            <div className="lineupHead">
              <div><b>Lineup {i + 1}</b><div className="salary">${r.salary.toLocaleString()} · {r.proj.toFixed(1)} projected</div></div>
              <div className="score">{r.ceiling.toFixed(1)}<div className="small">ceiling</div></div>
            </div>
            <div className="playersGrid">
              {r.line.map((p, j) => {
                const x = calc(p, settings);
                return <div className="slot" key={j}><strong>{p.pos}</strong>{p.name} <span className="small">{p.team} vs {p.opp || '—'} · ${p.salary.toLocaleString()} · {x.proj.toFixed(1)}</span></div>;
              })}
            </div>
          </div>
        )) : <div className="small">Generate lineups in the Optimizer.</div>}
      </div>
      <div className="card">
        <h3>Exposure report</h3>
        {exposure.length ? exposure.map(([n, c]) => (
          <div className="rankcard" key={n}>
            <div className="ranknum">{Math.round(c / results.length * 100)}%</div>
            <div className="rankname"><b>{n}</b><span className="small">{c} of {results.length} lineups</span></div>
          </div>
        )) : <div className="small">No exposure data.</div>}
      </div>
    </>
  );
}
