import { useState, useCallback, useRef } from 'react';
import { MousePointer2, Move, RotateCcw, Maximize2, ChevronDown, Grid3x3 } from 'lucide-react';
import useStore from '../../store/useStore';
import ThreeScene from './ThreeScene';
import styles from './Viewport.module.css';

const VIEW_MODES = ['Solid', 'Wireframe', 'Material'];
const PERSPECTIVES = ['Perspective', 'Front', 'Top', 'Right', 'Camera'];

const TOOLS = [
  { id: 'select', icon: MousePointer2, label: 'Select' },
  { id: 'move',   icon: Move,          label: 'Move' },
  { id: 'rotate', icon: RotateCcw,     label: 'Rotate' },
  { id: 'scale',  icon: Maximize2,     label: 'Scale' },
];

export default function Viewport() {
  const { activeTool, setActiveTool, viewMode, setViewMode } = useStore();
  const [camPos, setCamPos] = useState({ x: 5.0, y: 3.2, z: 5.0 });
  const [cameraTarget, setCameraTarget] = useState(null);
  const [inputVals, setInputVals] = useState({ x: '5.00', y: '3.20', z: '5.00' });
  const editingAxes = useRef(new Set());
  const [showPerspDrop, setShowPerspDrop] = useState(false);
  const [perspective, setPerspective] = useState('Perspective');
  const frameRef = useRef(null);

  const handleCameraUpdate = useCallback((pos) => {
    frameRef.current = requestAnimationFrame(() => {
      setCamPos({ x: pos.x, y: pos.y, z: pos.z });
      setInputVals(prev => {
        const next = { ...prev };
        if (!editingAxes.current.has('x')) next.x = pos.x.toFixed(2);
        if (!editingAxes.current.has('y')) next.y = pos.y.toFixed(2);
        if (!editingAxes.current.has('z')) next.z = pos.z.toFixed(2);
        return next;
      });
    });
  }, []);

  function commitAxis(axis) {
    const val = parseFloat(inputVals[axis]);
    if (!isNaN(val)) {
      setCameraTarget({ x: axis === 'x' ? val : camPos.x, y: axis === 'y' ? val : camPos.y, z: axis === 'z' ? val : camPos.z, _t: Date.now() });
    } else {
      setInputVals(prev => ({ ...prev, [axis]: camPos[axis].toFixed(2) }));
    }
    editingAxes.current.delete(axis);
  }

  return (
    <div className={styles.viewport}>
      {/* Three.js Canvas */}
      <ThreeScene onCameraUpdate={handleCameraUpdate} cameraTarget={cameraTarget} />

      {/* Viewport Top Toolbar */}
      <div className={styles.viewportToolbar}>
        <div style={{ position: 'relative' }}>
          <button
            className={`${styles.toolbarBtn}`}
            onClick={() => setShowPerspDrop((v) => !v)}
          >
            {perspective} <ChevronDown size={10} style={{ marginLeft: 2 }} />
          </button>
          {showPerspDrop && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0,
              background: 'var(--bg-panel-alt)', border: '1px solid var(--border)',
              borderRadius: 4, padding: '4px 0', zIndex: 200, minWidth: 120,
            }}>
              {PERSPECTIVES.map((p) => (
                <button
                  key={p}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '5px 12px', fontFamily: 'var(--font-ui)',
                    fontSize: 'var(--font-size-xs)', color: p === perspective ? 'var(--accent)' : 'var(--text-secondary)',
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}
                  onClick={() => { setPerspective(p); setShowPerspDrop(false); }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.toolbarDivider} />

        {VIEW_MODES.map((mode) => (
          <button
            key={mode}
            className={`${styles.toolbarBtn} ${viewMode === mode.toLowerCase() ? styles.active : ''}`}
            onClick={() => setViewMode(mode.toLowerCase())}
          >
            {mode}
          </button>
        ))}

        <div className={styles.toolbarDivider} />

        <button className={styles.toolbarBtn}>
          <Grid3x3 size={12} /> Overlays
        </button>
      </div>

      {/* Transform Toolbar */}
      <div className={styles.transformToolbar}>
        {TOOLS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            title={label}
            className={`${styles.transformBtn} ${activeTool === id ? styles.active : ''}`}
            onClick={() => setActiveTool(id)}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>

      {/* Camera Overlay */}
      <div className={styles.cameraOverlay}>
        <span className={styles.camLabel}>CAM</span>
        {[['x'],['y'],['z']].map(([axis]) => (
          <span key={axis} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <span className={styles.camLabel}>{axis.toUpperCase()}:</span>
            <input
              className={styles.camInput}
              value={inputVals[axis]}
              onChange={e => setInputVals(prev => ({ ...prev, [axis]: e.target.value }))}
              onFocus={() => editingAxes.current.add(axis)}
              onBlur={() => commitAxis(axis)}
              onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); } }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
