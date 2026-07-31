import { useDfs } from '../state/DfsContext.jsx';

export default function Header() {
  const { sport, sportConfig, setSport, sportList } = useDfs();
  return (
    <header>
      <div className="brand">
        <div className="logo">{sportConfig.icon}</div>
        <div>
          <h1>Ultimate DFS Generator <span className="badge">v5</span></h1>
          <div className="sub">DraftKings import/export, {sportConfig.label} projections, research & multi-lineup optimization</div>
        </div>
        <div className="sportSwitch">
          <select value={sport} onChange={e => setSport(e.target.value)} aria-label="Sport">
            {sportList.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
          </select>
        </div>
      </div>
    </header>
  );
}
