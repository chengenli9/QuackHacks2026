import { useState, useRef, useEffect } from 'react';
import { Play, Hexagon } from 'lucide-react';
import styles from './TopBar.module.css';

const MENUS = {
  File: ['New Scene', 'Open...', 'Save', '---', 'Import .glb', 'Export Scene', '---', 'Quit'],
  Edit: ['Undo', 'Redo', '---', 'Select All', 'Deselect All', '---', 'Preferences'],
  View: ['Toggle Left Panel', 'Toggle Right Panel', '---', 'Fullscreen', '---', 'Reset Layout'],
  Help: ['Documentation', 'Keyboard Shortcuts', '---', 'About RoomCraft'],
};

function MenuDropdown({ label, items, open, onToggle }) {
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
              <button key={item} className={styles.dropdownItem}>{item}</button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function TopBar() {
  const [openMenu, setOpenMenu] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);

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
          />
        ))}
      </nav>

      <div style={{ position: 'relative' }}>
        <button
          className={styles.processBtn}
          onClick={(e) => e.preventDefault()}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <Play size={12} />
          Process Video
        </button>
        {showTooltip && (
          <div className={styles.processBtnTooltip}>Backend not connected</div>
        )}
      </div>
    </header>
  );
}
