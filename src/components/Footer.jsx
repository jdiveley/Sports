import { useDfs } from '../state/DfsContext.jsx';

export default function Footer() {
  const { prevTab, nextTab } = useDfs();
  return (
    <div className="footer">
      <div>
        <button id="back" className="secondary" onClick={prevTab}>Back</button>
        <button id="next" className="primary" onClick={nextTab}>Next</button>
      </div>
    </div>
  );
}
