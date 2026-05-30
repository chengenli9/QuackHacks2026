import { useState, useRef, useEffect } from 'react';
import { Hexagon } from 'lucide-react';
import useStore from '../../store/useStore';
import styles from './TopBar.module.css';

const MENUS = {
  File: [
    { label: 'New Scene' },
    { label: 'Open...' },
    { label: 'Save' },
    '---',
    { label: 'Import .glb', action: 'importGlb' },
    { label: 'Export Scene' },
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

  const handleMenuAction = (action) => {
    if (action === 'importGlb') {
      requestGlbImport();
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
            onAction={handleMenuAction}
          />
        ))}
      </nav>


    </header>
  );
}
