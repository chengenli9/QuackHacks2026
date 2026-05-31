import { useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import useStore from '../../store/useStore';
import ImportPanel from './ImportPanel';
import ChatPanel from './ChatPanel';
import styles from './LeftPanel.module.css';

const PANEL_MIN = 180;
const PANEL_MAX = 500;

export default function LeftPanel() {
  const leftPanelTab = useStore((s) => s.leftPanelTab);
  const setLeftPanelTab = useStore((s) => s.setLeftPanelTab);
  const leftPanelMinimized = useStore((s) => s.leftPanelMinimized);
  const toggleLeftPanel = useStore((s) => s.toggleLeftPanel);
  const leftPanelWidth = useStore((s) => s.leftPanelWidth);
  const setLeftPanelWidth = useStore((s) => s.setLeftPanelWidth);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeStart = useCallback(
    (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = leftPanelWidth;
      setIsResizing(true);

      const onMouseMove = (ev) => {
        const newWidth = Math.max(
          PANEL_MIN,
          Math.min(PANEL_MAX, startWidth + (ev.clientX - startX)),
        );
        setLeftPanelWidth(newWidth);
      };

      const onMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [leftPanelWidth, setLeftPanelWidth],
  );

  if (leftPanelMinimized) {
    return (
      <aside className={styles.leftPanel} style={{ width: 28, minWidth: 28 }}>
        <button
          className={styles.expandBtn}
          onClick={toggleLeftPanel}
          title="Expand left panel"
        >
          <ChevronRight size={14} />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={styles.leftPanel}
      style={{ width: leftPanelWidth, minWidth: leftPanelWidth }}
    >
      <div className={styles.tabToggle}>
        <button
          className={`${styles.tab} ${leftPanelTab === 'import' ? styles.active : ''}`}
          onClick={() => setLeftPanelTab('import')}
        >
          Import
        </button>
        <button
          className={`${styles.tab} ${leftPanelTab === 'chat' ? styles.active : ''}`}
          onClick={() => setLeftPanelTab('chat')}
        >
          AI Chat
        </button>
        <button
          className={styles.collapseBtn}
          onClick={toggleLeftPanel}
          title="Collapse left panel"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      <div key={leftPanelTab} className={styles.panelContent}>
        {leftPanelTab === 'import' ? <ImportPanel /> : <ChatPanel />}
      </div>

      <div
        className={`${styles.resizeHandle} ${styles.resizeHandleRight} ${isResizing ? styles.active : ''}`}
        onMouseDown={handleResizeStart}
      />
    </aside>
  );
}
