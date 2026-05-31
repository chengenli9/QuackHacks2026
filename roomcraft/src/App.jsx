import { useEffect, useRef } from 'react';
import useStore from './store/useStore';
import { openSavedProjectFromStorage } from './lib/projectSession';
import LandingPage from './components/LandingPage/LandingPage';
import TopBar from './components/TopBar/TopBar';
import LeftPanel from './components/LeftPanel/LeftPanel';
import Viewport from './components/Viewport/Viewport';
import RightPanel from './components/RightPanel/RightPanel';

function App() {
  const currentView = useStore((s) => s.currentView);
  const pictureMode = useStore((s) => s.pictureMode);
  const exitPictureMode = useStore((s) => s.exitPictureMode);

  if (currentView === 'landing') {
    return <LandingPage />;
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}
      onClick={pictureMode ? exitPictureMode : undefined}
    >
      <SavedProjectRequestHandler />
      {!pictureMode && <TopBar />}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {!pictureMode && <LeftPanel />}
        <Viewport />
        {!pictureMode && <RightPanel />}
      </div>
    </div>
  );
}

function SavedProjectRequestHandler() {
  const openSavedProjectRequestId = useStore((s) => s.openSavedProjectRequestId);
  const handledOpenSavedProjectRequest = useRef(0);

  useEffect(() => {
    const hasLandingOpenRequest = Boolean(window.roomcraftOpenProjectRequested);
    if (!hasLandingOpenRequest && openSavedProjectRequestId <= handledOpenSavedProjectRequest.current) return;
    window.roomcraftOpenProjectRequested = false;
    handledOpenSavedProjectRequest.current = openSavedProjectRequestId;
    void openSavedProjectFromStorage();
  }, [openSavedProjectRequestId]);

  return null;
}

export default App;
