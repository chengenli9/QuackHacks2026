import './App.css';
import useStore from './store/useStore';
import LandingPage from './components/LandingPage/LandingPage';
import TopBar from './components/TopBar/TopBar';
import LeftPanel from './components/LeftPanel/LeftPanel';
import Viewport from './components/Viewport/Viewport';
import RightPanel from './components/RightPanel/RightPanel';

function App() {
  const currentView = useStore((s) => s.currentView);

  if (currentView === 'landing') {
    return <LandingPage />;
  }

  return (
    <div className="appShell">
      <TopBar />
      <div className="editorRow">
        <LeftPanel />
        <Viewport />
        <RightPanel />
      </div>
    </div>
  );
}

export default App;
