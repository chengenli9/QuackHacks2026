import { useState, useRef, useEffect, useCallback } from 'react';
import { Hexagon } from 'lucide-react';
import useStore from '../../store/useStore';
import styles from './TopBar.module.css';

const MENUS = {
  File: ['New Scene', 'Open...', 'Save', '---', 'Import .glb', 'Export Scene', '---', 'Quit'],
  Edit: ['Undo', 'Redo', '---', 'Select All', 'Deselect All', '---', 'Preferences'],
  View: ['Toggle Left Panel', 'Toggle Right Panel', '---', 'Fullscreen', '---', 'Reset Layout'],
  Help: ['Documentation', 'Keyboard Shortcuts', '---', 'About RoomCraft'],
};

function MenuDropdown({ label, items, open, onToggle, onItemClick }) {
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
                key={item}
                className={styles.dropdownItem}
                onClick={() => { onItemClick(label, item); onToggle(null); }}
              >
                {item}
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
  const fileInputRef = useRef(null);
  const { addSceneObject, sceneObjects, gravityEnabled } = useStore();

  const handleImportGlb = useCallback((file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.glb$/i, '');
    const id = `imported_${Date.now()}`;
    addSceneObject({
      id,
      label: name,
      type: 'glb',
      visible: true,
      glbUrl: url,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      physics: { massKg: 1, friction: 0.5, restitution: 0.3 },
      meshInfo: null,
    });
    useStore.getState().setSelectedObject(id);
  }, [addSceneObject]);

  const handleExportScene = useCallback(() => {
    // Export scene.physics.json
    const objects = Object.values(sceneObjects).map((o) => {
      const { mass: _drop, massKg, ...restPhy } = o.physics || {};
      return {
        id: o.id,
        label: o.label,
        type: o.type,
        position: o.position,
        rotation: o.rotation,
        scale: o.scale,
        glbUrl: o.glbUrl || null,
        physics: { ...restPhy, massKg: massKg ?? _drop ?? 0 },
      };
    });
    const json = JSON.stringify(
      { version: 1, gravityEnabled, objects },
      null,
      2
    );
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'scene.physics.json';
    a.click();
    URL.revokeObjectURL(a.href);

    // Trigger GLB export from inside the Canvas via event bridge
    window.dispatchEvent(new CustomEvent('roomcraft:export-glb'));
  }, [sceneObjects, gravityEnabled]);

  // Listen for chat-triggered export
  useEffect(() => {
    const handler = () => handleExportScene();
    window.addEventListener('roomcraft:export-scene', handler);
    return () => window.removeEventListener('roomcraft:export-scene', handler);
  }, [handleExportScene]);

  const handleMenuItemClick = (menu, item) => {
    if (menu === 'File' && item === 'Import .glb') {
      fileInputRef.current?.click();
    } else if (menu === 'File' && item === 'Export Scene') {
      handleExportScene();
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
            onItemClick={handleMenuItemClick}
          />
        ))}
      </nav>

      {/* Hidden file input for .glb import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportGlb(file);
          e.target.value = '';
        }}
      />
    </header>
  );
}
