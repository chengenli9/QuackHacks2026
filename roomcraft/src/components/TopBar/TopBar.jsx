import { useState, useRef, useEffect } from 'react';
import { Hexagon, RotateCcw } from 'lucide-react';
import useStore from '../../store/useStore';
import { openSavedProjectFromStorage } from '../../lib/projectSession';
import { exportSceneArtifacts } from '../../lib/sceneExport';
import styles from './TopBar.module.css';

const MENUS = {
  File: [
    { label: 'New Scene', action: 'resetProject' },
    { label: 'Open...', action: 'openProject' },
    { label: 'Save', action: 'saveProject' },
    { label: 'Save As...', action: 'saveProjectAs' },
    '---',
    { label: 'Import .glb', action: 'importGlb' },
    { label: 'Export Scene', action: 'exportScene' },
    '---',
    { label: 'Quit' },
  ],
  Edit: ['Undo', 'Redo', '---', 'Select All', 'Deselect All', '---', 'Preferences'],
  View: ['Toggle Left Panel', 'Toggle Right Panel', '---', 'Fullscreen', '---', 'Reset Layout'],
  Help: ['Documentation', 'Keyboard Shortcuts', '---', 'About RoomCraft'],
};

function itemLabel(item) {
  return typeof item === 'string' ? item : item.label;
}

function MenuDropdown({ label, items, open, onToggle, onAction }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onToggle(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onToggle]);

  return (
    <div ref={ref} className={`${styles.menuItem} ${open ? styles.active : ''}`}>
      <button onClick={() => onToggle(open ? null : label)}>{label}</button>
      {open && (
        <div className={styles.dropdown}>
          {items.map((item, i) =>
            item === '---' ? (
              <div key={i} className={styles.dropdownDivider} />
            ) : (
              <button
                key={itemLabel(item)}
                className={`${styles.dropdownItem} ${item.action ? styles.actionable : ''}`}
                disabled={!item.action}
                onClick={() => {
                  if (item.action) {
                    onAction(item.action);
                    onToggle(null);
                  }
                }}
              >
                {itemLabel(item)}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function TopBar() {
  const [openMenu, setOpenMenu] = useState(null);
  const requestGlbImport = useStore((state) => state.requestGlbImport);
  const resetProject = useStore((state) => state.resetProject);
  const saveProject = useStore((state) => state.saveProject);
  const saveProjectAs = useStore((state) => state.saveProjectAs);
  const loadProjectList = useStore((state) => state.loadProjectList);
  const availableProjects = useStore((state) => state.availableProjects);
  const projectPickerOpen = useStore((state) => state.projectPickerOpen);
  const setProjectPickerOpen = useStore((state) => state.setProjectPickerOpen);
  const projectName = useStore((state) => state.projectName);
  const savedProjectError = useStore((state) => state.savedProjectError);
  const addGlbImportWarning = useStore((state) => state.addGlbImportWarning);

  useEffect(() => {
    if (projectPickerOpen) void loadProjectList();
  }, [projectPickerOpen, loadProjectList]);

  const handleMenuAction = async (action) => {
    try {
      if (action === 'importGlb') {
        requestGlbImport();
      }
      if (action === 'exportScene') {
        await exportSceneArtifacts({ sceneObjects: useStore.getState().sceneObjects });
      }
      if (action === 'saveProject') {
        await saveProject();
      }
      if (action === 'saveProjectAs') {
        const name = window.prompt('Project name', projectName || 'RoomCraft Demo');
        if (name?.trim()) await saveProjectAs(name.trim());
      }
      if (action === 'openProject') {
        setProjectPickerOpen(true);
        await loadProjectList();
      }
      if (action === 'resetProject') {
        resetProject();
      }
    } catch (error) {
      addGlbImportWarning(`Project action failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <header className={styles.topbar}>
      <div className={styles.logo}>
        <Hexagon className={styles.logoIcon} strokeWidth={1.5} />
        <span className={styles.logoText}>ROOMCRAFT</span>
      </div>

      <nav className={styles.menuBar}>
        {Object.entries(MENUS).map(([label, items]) => (
          <MenuDropdown
            key={label}
            label={label}
            items={items}
            open={openMenu === label}
            onToggle={setOpenMenu}
            onAction={(action) => void handleMenuAction(action)}
          />
        ))}
      </nav>

      <button className={styles.resetBtn} onClick={resetProject} title="Reset scene">
        <RotateCcw size={13} />
        Reset
      </button>

      {projectPickerOpen && (
        <div className={styles.projectModalBackdrop} onMouseDown={() => setProjectPickerOpen(false)}>
          <div className={styles.projectModal} onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.projectModalHeader}>
              <span>Open Project</span>
              <button onClick={() => setProjectPickerOpen(false)}>Close</button>
            </div>
            <div className={styles.projectModalList}>
              {availableProjects.length > 0 ? (
                availableProjects.map((project) => (
                  <button
                    key={project.id}
                    className={styles.projectModalRow}
                    onClick={async () => {
                      setProjectPickerOpen(false);
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
                <div className={styles.projectModalEmpty}>
                  {savedProjectError ?? 'No saved projects found.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
