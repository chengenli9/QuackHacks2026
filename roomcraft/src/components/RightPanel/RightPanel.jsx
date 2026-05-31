import { useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import useStore from '../../store/useStore';
import HierarchyPanel from './HierarchyPanel';
import PropertiesPanel from './PropertiesPanel';
import styles from './RightPanel.module.css';

const PANEL_MIN = 180;
const PANEL_MAX = 500;

export default function RightPanel() {
  const rightPanelMinimized = useStore((s) => s.rightPanelMinimized);
  const toggleRightPanel = useStore((s) => s.toggleRightPanel);
  const rightPanelWidth = useStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = useStore((s) => s.setRightPanelWidth);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeStart = useCallback(
    (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = rightPanelWidth;
      setIsResizing(true);

      const onMouseMove = (ev) => {
        // drag left = panel gets wider, so delta = startX - ev.clientX
        const delta = startX - ev.clientX;
        const newWidth = Math.max(
          PANEL_MIN,
          Math.min(PANEL_MAX, startWidth + delta),
        );
        setRightPanelWidth(newWidth);
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
    [rightPanelWidth, setRightPanelWidth],
  );

  if (rightPanelMinimized) {
    return (
      <aside className={styles.rightPanel} style={{ width: 28, minWidth: 28 }}>
        <button
          className={styles.expandBtn}
          onClick={toggleRightPanel}
          title="Expand right panel"
        >
          <ChevronLeft size={14} />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={styles.rightPanel}
      style={{ width: rightPanelWidth, minWidth: rightPanelWidth }}
    >
      <button
        className={styles.collapseBtn}
        onClick={toggleRightPanel}
        title="Collapse right panel"
      >
        <ChevronRight size={14} />
      </button>

      <div
        className={`${styles.resizeHandle} ${styles.resizeHandleLeft} ${isResizing ? styles.active : ''}`}
        onMouseDown={handleResizeStart}
      />

      <HierarchyPanel />
      <PropertiesPanel />
    </aside>
  );
}
