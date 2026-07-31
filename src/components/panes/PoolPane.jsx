import { useEffect, useMemo, useState } from 'react';
import { useDfs } from '../../state/DfsContext.jsx';
import { calc, gradeClass, usageLabel } from '../../lib/calc.js';
import { DEMO } from '../../lib/demo.js';

const emptyForm = pos => ({ name: '', pos, team: '', opp: '', salary: '', games: '', rank: '16', total: '', implied: '', ownership: '', usage: '', injury: '' });

export default function PoolPane() {
  const { players, settings, sportConfig, importCsv, addPlayer, delPlayer, clearPlayers, exportCsvToClipboard } = useDfs();
  const [csvText, setCsvText] = useState('');
  const [form, setForm] = useState(() => emptyForm(sportConfig.positions[0]));

  useEffect(() => { setForm(emptyForm(sportConfig.positions[0])); }, [sportConfig]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const rows = useMemo(() => players.map(p => ({ p, x: calc(p, settings) })), [players, settings.recentWeight, settings.matchupImpact]);

  return (
    <>
      <div className="card">
        <h3>Import player pool</h3>
        <div className="small">Paste CSV. Supported columns: name, position, team, opponent, salary, g1–g5, opp_rank, injury, game_total, implied, ownership, usage</div>
        <textarea placeholder="name,position,team,opponent,salary,g1,g2,g3,g4,g5,opp_rank,injury,game_total,implied,ownership,usage" value={csvText} onChange={e => setCsvText(e.target.value)} />
        <div className="row">
          <button className="secondary" onClick={() => setCsvText(DEMO)}>Load demo pool</button>
          <button className="primary" onClick={() => importCsv(csvText)}>Import CSV</button>
        </div>
      </div>
      <div className="card">
        <h3>Add / edit one player</h3>
        <div className="grid">
          <div className="c3"><label>Name</label><input value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div className="c2"><label>Position</label>
            <select value={form.pos} onChange={e => set('pos', e.target.value)}>
              {sportConfig.positions.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="c2"><label>Team</label><input value={form.team} onChange={e => set('team', e.target.value)} /></div>
          <div className="c2"><label>Opponent</label><input value={form.opp} onChange={e => set('opp', e.target.value)} /></div>
          <div className="c3"><label>Salary</label><input type="number" value={form.salary} onChange={e => set('salary', e.target.value)} /></div>
          <div className="c6"><label>Last 5 fantasy scores (oldest → newest)</label><input placeholder="12.5,18.1,14.8,22.0,19.7" value={form.games} onChange={e => set('games', e.target.value)} /></div>
          <div className="c2"><label>Opp rank (1 hard, 32 easy)</label><input type="number" value={form.rank} onChange={e => set('rank', e.target.value)} /></div>
          <div className="c2"><label>Game total</label><input type="number" step=".5" value={form.total} onChange={e => set('total', e.target.value)} /></div>
          <div className="c2"><label>Implied pts</label><input type="number" step=".25" value={form.implied} onChange={e => set('implied', e.target.value)} /></div>
          <div className="c2"><label>Ownership %</label><input type="number" step=".1" value={form.ownership} onChange={e => set('ownership', e.target.value)} /></div>
          <div className="c2"><label>Usage</label><input type="number" step=".1" value={form.usage} onChange={e => set('usage', e.target.value)} /></div>
          <div className="c2"><label>Injury</label>
            <select value={form.injury} onChange={e => set('injury', e.target.value)}>
              <option value="">Healthy</option><option>Q</option><option>D</option><option>OUT</option>
            </select>
          </div>
          <div className="c4"><label>&nbsp;</label><button className="primary" style={{ width: '100%' }} onClick={() => addPlayer(form)}>Add player</button></div>
        </div>
      </div>
      <div className="card">
        <div className="row"><h3 style={{ marginRight: 'auto' }}>Player pool</h3><button className="ghost auto" onClick={exportCsvToClipboard}>Copy CSV</button><button className="danger auto" onClick={clearPlayers}>Clear</button></div>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Name</th><th>Pos</th><th>Team</th><th>Opp</th><th>Salary</th><th>Proj</th><th>Floor</th><th>Ceil</th><th>Value</th><th>Match</th><th>Grade</th><th>Own</th><th>Usage+</th><th>Auto</th><th>Injury</th><th></th></tr></thead>
            <tbody>
              {rows.map(({ p, x }, i) => (
                <tr key={i}>
                  <td>{p.name}</td><td><span className="badge">{p.pos}</span></td><td>{p.team}</td><td>{p.opp || '—'}</td>
                  <td>${(+p.salary).toLocaleString()}</td>
                  <td className="good">{x.proj.toFixed(1)}</td><td>{x.floor.toFixed(1)}</td><td>{x.ceiling.toFixed(1)}</td><td>{x.value.toFixed(2)}</td>
                  <td>{x.matchScore}</td><td><span className={gradeClass(x.letter)}>{x.letter}</span></td><td>{p.ownership || 0}%</td>
                  <td>{usageLabel(p)}</td><td>{p.auto?.matched ? <span className="tag hot">YES</span> : '—'}</td>
                  <td className={p.injury ? 'gold' : ''}>{p.injury || '—'}</td>
                  <td><button className="danger" onClick={() => delPlayer(i)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
