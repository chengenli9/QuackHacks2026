import { useState, useCallback, useMemo, useRef } from 'react';
import {
  ArrowDown,
  Box,
  Layers,
  MousePointer2,
  Move,
  RotateCcw,
  Maximize2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  Info,
  ScanLine,
  Sparkles,
  X,
} from 'lucide-react';
import useStore from '../../store/useStore';
import { buildShowtimeSteps } from '../../lib/showtimeDirector';
import { PHYSICS_XRAY_LEGEND } from '../../lib/physicsXray';
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
  const pictureMode = useStore((s) => s.pictureMode);
  const {
    activeTool,
    setActiveTool,
    viewMode,
    setViewMode,
    perspective,
    setPerspective,
    overlaysEnabled,
    toggleOverlays,
    objectLabelsEnabled,
    setObjectLabelsEnabled,
    physicsXrayEnabled,
    setPhysicsXrayEnabled,
    gravityEnabled,
    setGravityEnabled,
    collisionsEnabled,
    setCollisionsEnabled,
    floorEnabled,
    setFloorEnabled,
    sceneBackground,
    backgroundGallery,
    selectSceneBackground,
    sourceImageUrl,
    sceneObjects,
    generatedTasks,
    showtimeEnabled,
    showtimeStepIndex,
    startShowtime,
    stopShowtime,
    advanceShowtime,
  } = useStore();
  const [camPos, setCamPos] = useState({ x: 5.0, y: 3.2, z: 5.0 });
  const [cameraTarget, setCameraTarget] = useState(null);
  const [inputVals, setInputVals] = useState({ x: '5.00', y: '3.20', z: '5.00' });
  const editingAxes = useRef(new Set());
  const [showPerspDrop, setShowPerspDrop] = useState(false);
  const frameRef = useRef(null);
  const cameraTargetNonce = useRef(0);
  const showtimeSteps = useMemo(
    () => buildShowtimeSteps({ sceneObjects, generatedTasks }),
    [sceneObjects, generatedTasks]
  );
  const activeShowtimeIndex = Math.min(showtimeStepIndex, Math.max(showtimeSteps.length - 1, 0));
  const activeShowtimeStep = showtimeSteps[activeShowtimeIndex] ?? null;

  const handleCameraUpdate = useCallback((pos) => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
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
      cameraTargetNonce.current += 1;
      setCameraTarget({
        x: axis === 'x' ? val : camPos.x,
        y: axis === 'y' ? val : camPos.y,
        z: axis === 'z' ? val : camPos.z,
        revision: cameraTargetNonce.current,
      });
    } else {
      setInputVals(prev => ({ ...prev, [axis]: camPos[axis].toFixed(2) }));
    }
    editingAxes.current.delete(axis);
  }

  return (
    <div className={styles.viewport}>
      {sceneBackground?.imageDataUrl && (
        <div
          className={styles.backgroundLayer}
          style={{ backgroundImage: `url("${sceneBackground.imageDataUrl}")` }}
        />
      )}

      <ThreeScene onCameraUpdate={handleCameraUpdate} cameraTarget={cameraTarget} />

      {/* Viewport Top Toolbar */}
      {!pictureMode && (
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
                  onClick={() => { setPerspective(p); setShowPerspDrop(false); setCameraTarget(null); }}
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

        <button
          className={`${styles.toolbarBtn} ${overlaysEnabled ? styles.active : ''}`}
          onClick={toggleOverlays}
        >
          <Grid3x3 size={12} /> Overlays
        </button>

        <button
          className={`${styles.toolbarBtn} ${objectLabelsEnabled ? styles.active : ''}`}
          onClick={() => setObjectLabelsEnabled(!objectLabelsEnabled)}
          aria-pressed={objectLabelsEnabled}
        >
          <Info size={12} /> AI Labels
        </button>

        <button
          className={`${styles.toolbarBtn} ${physicsXrayEnabled ? styles.active : ''}`}
          onClick={() => setPhysicsXrayEnabled(!physicsXrayEnabled)}
          aria-pressed={physicsXrayEnabled}
        >
          <ScanLine size={12} /> Physics X-Ray
        </button>

        <button
          className={`${styles.toolbarBtn} ${gravityEnabled ? styles.active : ''}`}
          onClick={() => setGravityEnabled(!gravityEnabled)}
        >
          <ArrowDown size={12} /> Gravity
        </button>

        <button
          className={`${styles.toolbarBtn} ${collisionsEnabled ? styles.active : ''}`}
          onClick={() => setCollisionsEnabled(!collisionsEnabled)}
        >
          <Box size={12} /> Collisions
        </button>

        <button
          className={`${styles.toolbarBtn} ${floorEnabled ? styles.active : ''}`}
          onClick={() => setFloorEnabled(!floorEnabled)}
        >
          <Layers size={12} /> Floor
        </button>

        <div className={styles.toolbarDivider} />

        <button
          className={`${styles.toolbarBtn} ${showtimeEnabled ? styles.active : ''}`}
          onClick={() => (showtimeEnabled ? stopShowtime() : startShowtime())}
          aria-pressed={showtimeEnabled}
        >
          <Sparkles size={12} /> Showtime
        </button>
      </div>
      )}

      {/* Transform Toolbar */}
      {!pictureMode && (
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
      )}

      {/* Camera Overlay */}
      {!pictureMode && (
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
      )}

      {!pictureMode && sourceImageUrl && (
        <div className={styles.sourcePreview}>
          <img src={sourceImageUrl} alt="Source scene" />
        </div>
      )}

      {!pictureMode && backgroundGallery?.length > 0 && (
        <div className={styles.backgroundGallery} aria-label="Background gallery">
          {backgroundGallery.map((background) => (
            <button
              key={background.id}
              className={`${styles.backgroundThumb} ${
                sceneBackground?.id === background.id ? styles.activeBackground : ''
              }`}
              title={background.prompt ?? 'Generated background'}
              onClick={() => selectSceneBackground(background.id)}
            >
              <img src={background.imageDataUrl} alt="" />
            </button>
          ))}
        </div>
      )}

      {!pictureMode && physicsXrayEnabled && (
        <div className={styles.physicsXrayLegend} aria-label="Physics x-ray legend">
          <strong>Physics X-Ray</strong>
          {PHYSICS_XRAY_LEGEND.map((entry) => (
            <span key={entry.key}>
              <i style={{ background: entry.color }} />
              {entry.label}
            </span>
          ))}
        </div>
      )}

      {!pictureMode && showtimeEnabled && activeShowtimeStep && (
        <ShowtimeOverlay
          step={activeShowtimeStep}
          index={activeShowtimeIndex}
          count={showtimeSteps.length}
          onPrevious={() => advanceShowtime(-1)}
          onNext={() => advanceShowtime(1)}
          onStop={stopShowtime}
        />
      )}
    </div>
  );
}

function ShowtimeOverlay({ step, index, count, onPrevious, onNext, onStop }) {
  const progress = count > 0 ? ((index + 1) / count) * 100 : 0;
  const facts = step.facts?.slice(0, 4) ?? [];

  return (
    <section className={styles.showtimeOverlay} aria-live="polite">
      <div className={styles.showtimeHeader}>
        <div className={styles.showtimeKicker}>
          <Sparkles size={14} />
          <span>Showtime</span>
          <span className={styles.showtimeCount}>{index + 1}/{count}</span>
        </div>
        <button className={styles.showtimeIconBtn} onClick={onStop} title="Exit showtime">
          <X size={14} />
        </button>
      </div>

      <div className={styles.showtimeProgress} aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <h2>{step.title}</h2>
      <p>{step.narrative}</p>

      {step.objectId && (
        <div className={styles.showtimeFocus}>Focused object: {step.title}</div>
      )}

      {facts.length > 0 && (
        <ul className={styles.showtimeFacts}>
          {facts.map((fact, factIndex) => (
            <li key={`${factIndex}-${fact}`}>{fact}</li>
          ))}
        </ul>
      )}

      <div className={styles.showtimeActions}>
        <button onClick={onPrevious}>
          <ChevronLeft size={14} /> Prev
        </button>
        <button onClick={onNext}>
          Next <ChevronRight size={14} />
        </button>
      </div>
    </section>
  );
}
