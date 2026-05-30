import TopBar from './components/TopBar/TopBar';
import LeftPanel from './components/LeftPanel/LeftPanel';
import Viewport from './components/Viewport/Viewport';
import RightPanel from './components/RightPanel/RightPanel';

function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopBar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <LeftPanel />
        <Viewport />
        <RightPanel />
      </div>
    </div>
  );
}

export default App;
