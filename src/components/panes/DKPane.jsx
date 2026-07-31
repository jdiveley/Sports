import { useRef, useState } from 'react';
import { useDfs } from '../../state/DfsContext.jsx';
import { normalizeName } from '../../lib/calc.js';

export default function DKPane() {
  const {
    dkState, dkStatus, dkLiveStatus, dkSlateOptions, players, settings, sportConfig, updateSetting,
    importDkCsv, clearDk, fetchDkSlatesAction, loadDkSlateAction, exportDkLineups
  } = useDfs();

  const [pasteText, setPasteText] = useState('');
  const [drag, setDrag] = useState(false);
  const [selectedSlate, setSelectedSlate] = useState('');
  const fileInputRef = useRef(null);

  function readFile(file) {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => importDkCsv(fr.result, file.name);
    fr.readAsText(file);
  }

  return (
    <>
      <div className="card">
        <h3>🔴 Load live from DraftKings</h3>
        <p className="note">Pulls the current {sportConfig.label} Classic slate list and player salaries directly from DraftKings' public API. No login required — this reads the same public data shown on the DK lobby/lineup builder.</p>
        <div className="row">
          <button className="secondary" onClick={fetchDkSlatesAction}>Fetch {sportConfig.label} slates</button>
          <select value={selectedSlate} onChange={e => setSelectedSlate(e.target.value)}>
            {dkSlateOptions.length
              ? dkSlateOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)
              : <option value="">Fetch slates first…</option>}
          </select>
          <button className="primary" disabled={!dkSlateOptions.length} onClick={() => loadDkSlateAction(selectedSlate || dkSlateOptions[0]?.value)}>Import slate</button>
        </div>
        <div className="small" style={{ marginTop: 9 }}>{dkLiveStatus}</div>
      </div>

      <div className="card">
        <h3>👑 DraftKings Slate Import</h3>
        <p className="note">Use the DraftKings CSV/template for the exact contest slate. V5 detects common DK salary headers, preserves DraftKings player IDs and roster eligibility, and can also remember the lineup-template header for export.</p>
        <label
          className={`dropzone${drag ? ' drag' : ''}`}
          onDragEnter={e => { e.preventDefault(); setDrag(true); }}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={e => { e.preventDefault(); setDrag(false); }}
          onDrop={e => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files[0]); }}
        >
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={e => readFile(e.target.files[0])} />
          <b style={{ fontSize: 18 }}>Drop DraftKings CSV here</b>
          <div className="small" style={{ marginTop: 5 }}>or tap to choose the file from your phone/computer</div>
        </label>
        <div className="row" style={{ marginTop: 9 }}>
          <button className="secondary" onClick={() => importDkCsv(pasteText, 'pasted-draftkings.csv')}>Import pasted DK CSV</button>
          <button className="ghost" onClick={clearDk}>Clear DK slate</button>
        </div>
        <textarea style={{ marginTop: 9 }} placeholder="Optional: paste a DraftKings salary CSV here instead of choosing a file." value={pasteText} onChange={e => setPasteText(e.target.value)} />
        <div className="small">{dkStatus}</div>
      </div>

      <div className="card">
        <h3>Detected slate</h3>
        <div className="grid">
          <div className="c3 kpi"><b>{dkState.playerRows.length}</b><span>DK players</span></div>
          <div className="c3 kpi"><b>{dkState.playerRows.filter(x => x.dkId).length}</b><span>Player IDs preserved</span></div>
          <div className="c3 kpi"><b>{dkState.games?.size || 0}</b><span>Games detected</span></div>
          <div className="c3 kpi"><b>{dkState.loaded ? 'DK' : '—'}</b><span>Slate/template</span></div>
        </div>
        <div className="small" style={{ marginTop: 9 }}>
          {dkState.loaded ? `${dkState.fileName} · player header row ${dkState.headerRow + 1}${dkState.templateRoster.length ? ` · roster template: ${dkState.templateRoster.join(', ')}` : ''}` : ''}
        </div>
      </div>

      <div className="card">
        <h3>Import mapping</h3>
        {dkState.loaded ? (
          <div className="codebox">
            {['nameid', 'name', 'id', 'pos', 'salary', 'game', 'team', 'avg'].map(k => (
              <div key={k}>{k}: {dkState.mapping[k] >= 0 ? dkState.headers[dkState.mapping[k]] : 'not found'}</div>
            ))}
          </div>
        ) : <div className="small">Import a CSV to see detected columns.</div>}
      </div>

      <div className="card">
        <h3>DraftKings export</h3>
        <div className="grid">
          <div className="c4"><label>Roster format</label>
            <select value={settings.dkExportMode} onChange={e => updateSetting('dkExportMode', e.target.value)}>
              <option value="classic">{sportConfig.label} Classic: {sportConfig.rosterSlots.map(s => s.label).join(' ')}</option>
              <option value="template">Use detected DK template roster columns</option>
            </select>
          </div>
          <div className="c4"><label>Cell format</label>
            <select value={settings.dkCellFormat} onChange={e => updateSetting('dkCellFormat', e.target.value)}>
              <option value="id">Player ID</option>
              <option value="nameid">Name (ID)</option>
              <option value="name">Player name</option>
            </select>
          </div>
          <div className="c4"><label>&nbsp;</label><button className="primary" style={{ width: '100%' }} onClick={exportDkLineups}>Download DK Lineups CSV</button></div>
        </div>
        <p className="small">For the most reliable upload, V5 preserves the IDs from the same DraftKings slate file you imported. Always review the generated CSV before submitting entries.</p>
      </div>

      <div className="card">
        <h3>DK salary pool</h3>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Name</th><th>ID</th><th>Roster</th><th>Salary</th><th>Team</th><th>Game</th><th>Avg FPTS</th><th>Matched</th></tr></thead>
            <tbody>
              {dkState.playerRows.map((d, i) => {
                const p = players.find(x => x.dkId && x.dkId === d.dkId) || players.find(x => normalizeName(x.name) === normalizeName(d.name));
                return (
                  <tr key={i}>
                    <td>{d.name}</td><td>{d.dkId || '—'}</td><td>{d.roster}</td>
                    <td>${d.salary.toLocaleString()}</td><td>{d.team}</td><td>{d.game}</td>
                    <td>{d.avg ? d.avg.toFixed(1) : '—'}</td>
                    <td>{p ? <span className="tag hot">YES</span> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
