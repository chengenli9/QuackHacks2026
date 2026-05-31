import useStore from '../../store/useStore';
import ImportPanel from './ImportPanel';
import ChatPanel from './ChatPanel';
import styles from './LeftPanel.module.css';

export default function LeftPanel() {
  const { leftPanelTab, setLeftPanelTab } = useStore();

  return (
    <aside className={styles.leftPanel}>
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
      </div>

      <div key={leftPanelTab} className={styles.panelContent}>
        {leftPanelTab === 'import' ? <ImportPanel /> : <ChatPanel />}
      </div>
    </aside>
  );
}
