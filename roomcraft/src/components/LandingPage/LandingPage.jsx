import { Hexagon, FolderOpen, Plus } from 'lucide-react';
import useStore from '../../store/useStore';
import styles from './LandingPage.module.css';

export default function LandingPage() {
  const setCurrentView = useStore((s) => s.setCurrentView);
  const resetProject = useStore((s) => s.resetProject);
  const requestOpenSavedProject = useStore((s) => s.requestOpenSavedProject);
  const createProject = () => {
    resetProject();
    setCurrentView('editor');
  };
  const loadSavedProject = () => {
    window.roomcraftOpenProjectRequested = true;
    requestOpenSavedProject();
  };

  return (
    <div className={styles.landing}>
      <div className={styles.hero}>
        <div className={styles.logo}>
          <Hexagon className={styles.logoIcon} strokeWidth={1.2} />
        </div>
        <h1 className={styles.title}>ROOMCRAFT</h1>
        <p className={styles.subtitle}>3D Room Reconstruction</p>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.card}
          onClick={loadSavedProject}
        >
          <div className={styles.cardIcon}>
            <Plus size={24} strokeWidth={1.5} />
          </div>
          <div className={styles.cardLabel}>Create New Project</div>
          <div className={styles.cardHint}>
            Start from a GLB scene, generated asset, or empty scene
          </div>
        </button>

        <button
          className={styles.card}
          onClick={createProject}
        >
          <div className={styles.cardIcon}>
            <FolderOpen size={24} strokeWidth={1.5} />
          </div>
          <div className={styles.cardLabel}>Open Project</div>
          <div className={styles.cardHint}>
            Continue working on an existing project
          </div>
        </button>
      </div>

      <footer className={styles.footer}>
        <span className={styles.version}>v0.0.0</span>
      </footer>
    </div>
  );
}
