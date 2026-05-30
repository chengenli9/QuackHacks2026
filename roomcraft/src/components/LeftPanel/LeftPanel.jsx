import useStore from '../../store/useStore';
import VideoUploadPanel from './VideoUploadPanel';
import ChatPanel from './ChatPanel';
import styles from './LeftPanel.module.css';

export default function LeftPanel() {
  const { leftPanelTab, setLeftPanelTab } = useStore();

  return (
    <aside className={styles.leftPanel}>
      <div className={styles.tabToggle}>
        <button
          className={`${styles.tab} ${leftPanelTab === 'video' ? styles.active : ''}`}
          onClick={() => setLeftPanelTab('video')}
        >
          Video
        </button>
        <button
          className={`${styles.tab} ${leftPanelTab === 'chat' ? styles.active : ''}`}
          onClick={() => setLeftPanelTab('chat')}
        >
          AI Chat
        </button>
      </div>

      <div key={leftPanelTab} className={styles.panelContent}>
        {leftPanelTab === 'video' ? <VideoUploadPanel /> : <ChatPanel />}
      </div>
    </aside>
  );
}
