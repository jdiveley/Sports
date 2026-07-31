import { useDfs } from '../state/DfsContext.jsx';

export default function Toast() {
  const { toastText, toastVisible } = useDfs();
  return <div id="toast" className={toastVisible ? 'show' : ''}>{toastText}</div>;
}
