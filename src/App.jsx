import { DfsProvider, useDfs } from './state/DfsContext.jsx';
import Header from './components/Header.jsx';
import Tabs from './components/Tabs.jsx';
import Footer from './components/Footer.jsx';
import Toast from './components/Toast.jsx';
import HomePane from './components/panes/HomePane.jsx';
import SlatePane from './components/panes/SlatePane.jsx';
import DKPane from './components/panes/DKPane.jsx';
import DataLabPane from './components/panes/DataLabPane.jsx';
import PoolPane from './components/panes/PoolPane.jsx';
import ResearchPane from './components/panes/ResearchPane.jsx';
import StacksPane from './components/panes/StacksPane.jsx';
import OptimizerPane from './components/panes/OptimizerPane.jsx';
import LineupsPane from './components/panes/LineupsPane.jsx';

const PANES = [
  ['home', HomePane],
  ['slate', SlatePane],
  ['dk', DKPane],
  ['datalab', DataLabPane],
  ['pool', PoolPane],
  ['research', ResearchPane],
  ['stacks', StacksPane],
  ['optimizer', OptimizerPane],
  ['lineups', LineupsPane]
];

function Panes() {
  const { tab } = useDfs();
  return PANES.map(([id, Comp]) => (
    <section key={id} id={id} className={`pane${tab === id ? '' : ' hidden'}`}>
      <Comp />
    </section>
  ));
}

export default function App() {
  return (
    <DfsProvider>
      <Header />
      <main>
        <Tabs />
        <Panes />
      </main>
      <Toast />
      <Footer />
    </DfsProvider>
  );
}
