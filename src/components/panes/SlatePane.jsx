import { useDfs } from '../../state/DfsContext.jsx';

export default function SlatePane() {
  const { games, sportConfig, loadSchedule } = useDfs();
  return (
    <>
      <div className="card">
        <div className="row"><h3 style={{ marginRight: 'auto' }}>Weekly {sportConfig.label} slate</h3><button className="ghost auto" onClick={loadSchedule}>Refresh</button></div>
        <div className="grid">
          {games.length ? games.map(g => (
            <div className="game c4" key={g.id}>
              <b>{g.away} @ {g.home}</b>
              <div className="small">{new Date(g.date).toLocaleString()}{g.total ? ` · O/U ${g.total}` : ''}</div>
              <div className="small">{g.odds || g.status || ''}</div>
            </div>
          )) : <div className="small c12">No schedule loaded.</div>}
        </div>
      </div>
      <div className="card">
        <h3>Game environment overrides</h3>
        <p className="note">Online totals are not guaranteed. You can override total/spread information by editing player data or importing it in the CSV. A higher total and team implied score increases offensive projections modestly.</p>
      </div>
    </>
  );
}
