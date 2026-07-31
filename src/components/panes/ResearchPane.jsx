import { useMemo } from 'react';
import { useDfs } from '../../state/DfsContext.jsx';
import { calc, gradeClass } from '../../lib/calc.js';

function metricValue(x, metric) {
  if (metric === 'value') return x.value.toFixed(2);
  if (metric === 'matchup') return x.matchScore;
  if (metric === 'floor') return x.floor.toFixed(1);
  if (metric === 'ceiling') return x.ceiling.toFixed(1);
  if (metric === 'leverage') return x.leverage.toFixed(0);
  if (metric === 'grade') return x.score.toFixed(0);
  return x.proj.toFixed(1);
}

function RankRow({ p, i, metric, settings }) {
  const x = calc(p, settings);
  return (
    <div className="rankcard">
      <div className="ranknum">{i + 1}</div>
      <div className="rankname"><b>{p.name} <span className="badge">{p.pos}</span></b>
        <span className="small">{p.team} vs {p.opp || '—'} · ${(+p.salary).toLocaleString()} · {x.proj.toFixed(1)} proj · {x.value.toFixed(2)}x</span>
      </div>
      <div className="right"><span className={gradeClass(x.letter)}>{x.letter}</span><div className="small">{metricValue(x, metric)}</div></div>
    </div>
  );
}

function RankList({ arr, metric, settings, n = 8 }) {
  const list = arr.slice(0, n);
  if (!list.length) return <div className="small">Import players to see rankings.</div>;
  return list.map((p, i) => <RankRow key={p.name + i} p={p} i={i} metric={metric} settings={settings} />);
}

export default function ResearchPane() {
  const { players, settings, updateSetting } = useDfs();

  const enriched = useMemo(() => players.map(p => ({ p, x: calc(p, settings) })), [players, settings.recentWeight, settings.matchupImpact]);

  const topPlays = useMemo(() => [...enriched].sort((a, b) => b.x.score - a.x.score).map(z => z.p), [enriched]);
  const bestValues = useMemo(() => [...enriched].sort((a, b) => b.x.value - a.x.value).map(z => z.p), [enriched]);
  const cashPlays = useMemo(() => [...enriched].sort((a, b) => (b.x.floor + b.x.consistency * .04) - (a.x.floor + a.x.consistency * .04)).map(z => z.p), [enriched]);
  const gppPlays = useMemo(() => [...enriched].sort((a, b) => b.x.ceiling - a.x.ceiling).map(z => z.p), [enriched]);
  const leveragePlays = useMemo(() => [...enriched].sort((a, b) => b.x.leverage - a.x.leverage).map(z => z.p), [enriched]);
  const fadePlays = useMemo(() => [...enriched].sort((a, b) => (a.x.value + a.x.matchScore / 25) - (b.x.value + b.x.matchScore / 25)).map(z => z.p), [enriched]);

  const fullRankings = useMemo(() => {
    const pos = settings.researchPos, sort = settings.researchSort, q = (settings.researchSearch || '').toLowerCase();
    const arr = players.filter(p => (pos === 'ALL' || p.pos === pos) && (!q || p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)));
    arr.sort((a, b) => {
      const A = calc(a, settings), B = calc(b, settings), key = sort === 'grade' ? 'score' : sort;
      return (B[key] || 0) - (A[key] || 0);
    });
    return arr;
  }, [players, settings]);

  return (
    <>
      <div className="card">
        <div className="grid">
          <div className="c4"><label>Position filter</label>
            <select value={settings.researchPos} onChange={e => updateSetting('researchPos', e.target.value)}>
              <option value="ALL">All positions</option><option>QB</option><option>RB</option><option>WR</option><option>TE</option><option>DST</option>
            </select>
          </div>
          <div className="c4"><label>Sort by</label>
            <select value={settings.researchSort} onChange={e => updateSetting('researchSort', e.target.value)}>
              <option value="grade">DFS Grade</option><option value="proj">Projection</option><option value="ceiling">Ceiling</option>
              <option value="floor">Floor</option><option value="value">Value</option><option value="matchup">Matchup</option><option value="leverage">Leverage</option>
            </select>
          </div>
          <div className="c4"><label>Search player/team</label><input placeholder="KC or Mahomes" value={settings.researchSearch} onChange={e => updateSetting('researchSearch', e.target.value)} /></div>
        </div>
      </div>
      <div className="grid">
        <div className="c6 card"><h3>🔥 Top Plays</h3><RankList arr={topPlays} metric="grade" settings={settings} /></div>
        <div className="c6 card"><h3>💰 Best Values</h3><RankList arr={bestValues} metric="value" settings={settings} /></div>
        <div className="c6 card"><h3>🏦 Cash Plays</h3><RankList arr={cashPlays} metric="floor" settings={settings} /></div>
        <div className="c6 card"><h3>🚀 GPP Plays</h3><RankList arr={gppPlays} metric="ceiling" settings={settings} /></div>
        <div className="c6 card"><h3>🕵️ Leverage</h3><RankList arr={leveragePlays} metric="leverage" settings={settings} /></div>
        <div className="c6 card"><h3>⚠️ Fades / Risk</h3><RankList arr={fadePlays} metric="value" settings={settings} /></div>
      </div>
      <div className="card">
        <h3>Full rankings</h3>
        {fullRankings.length
          ? fullRankings.map((p, i) => <RankRow key={p.name + i} p={p} i={i} metric={settings.researchSort} settings={settings} />)
          : <div className="small">No matching players.</div>}
      </div>
    </>
  );
}
