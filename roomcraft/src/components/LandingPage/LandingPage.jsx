import { useEffect } from 'react';
import { Hexagon, FolderOpen, Plus } from 'lucide-react';
import useStore from '../../store/useStore';
import { openSavedProjectFromStorage } from '../../lib/projectSession';
import styles from './LandingPage.module.css';

export default function LandingPage() {
  const setCurrentView = useStore((s) => s.setCurrentView);
  const resetProject = useStore((s) => s.resetProject);
  const loadProjectList = useStore((s) => s.loadProjectList);
  const availableProjects = useStore((s) => s.availableProjects);
  const savedProjectStatus = useStore((s) => s.savedProjectStatus);
  const createProject = () => {
    resetProject();
    setCurrentView('editor');
  };

  useEffect(() => {
    void loadProjectList();
  }, [loadProjectList]);

  return (
    <div className={styles.landing}>
      <div className={styles.hero}>
        <div className={styles.logo}>
          <Hexagon className={styles.logoIcon} strokeWidth={1.2} />
        </div>
        <h1 className={styles.title}>PRISM</h1>
        <p className={styles.subtitle}>Physics-aware Room Import, Segmentation, and Manipulation</p>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.card}
          onClick={createProject}
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
          onClick={() => void loadProjectList()}
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

      <div className={styles.projectList}>
        <div className={styles.projectListHeader}>Saved Projects</div>
        {availableProjects.length > 0 ? (
          availableProjects.map((project) => (
            <button
              key={project.id}
              className={styles.projectRow}
              onClick={async () => {
                setCurrentView('editor');
                await openSavedProjectFromStorage(undefined, project.id);
              }}
            >
              <span>{project.name}</span>
              <small>
                {project.objectCount ?? 0} objects
                {project.savedAt ? ` - ${new Date(project.savedAt).toLocaleString()}` : ''}
              </small>
            </button>
          ))
        ) : (
          <div className={styles.emptyProjects}>
            {savedProjectStatus === 'error' ? 'Could not load projects.' : 'No saved projects yet.'}
          </div>
        )}
      </div>

      <footer className={styles.footer}>
        <span className={styles.version}>v0.0.0</span>
      </footer>
    </div>
  );
}
