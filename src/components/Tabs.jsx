import { useDfs } from '../state/DfsContext.jsx';

const LABELS = { home: 'Home', slate: 'Slate', dk: 'DraftKings', datalab: 'Data Lab', pool: 'Players', research: 'Research', stacks: 'Stacks', optimizer: 'Optimizer', lineups: 'Lineups' };

export default function Tabs() {
  const { tab, TAB_ORDER, switchTab } = useDfs();
  return (
    <div className="tabs">
      {TAB_ORDER.map(id => (
        <button key={id} className={`tab${tab === id ? ' active' : ''}`} onClick={() => switchTab(id)}>{LABELS[id]}</button>
      ))}
    </div>
  );
}
