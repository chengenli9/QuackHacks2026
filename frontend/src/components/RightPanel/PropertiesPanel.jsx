import { useCallback, useState } from 'react';
import useStore from '../../store/useStore';
import styles from './RightPanel.module.css';

const OBJECT_DATA = {
  Scene: { verts: null, polys: null, format: null, color: '#1c1c1c' },
  Room_Mesh: { verts: '12,482', polys: '6,241', format: '.glb', color: '#C8C8C8' },
  Floor: { verts: '4,096', polys: '2,048', format: '.glb', color: '#8a8a8a' },
  Walls: { verts: '6,144', polys: '3,072', format: '.glb', color: '#9a9a9a' },
  Ceiling: { verts: '2,048', polys: '1,024', format: '.glb', color: '#707070' },
  Lights: { verts: null, polys: null, format: null, color: '#ffcc44' },
  Ambient: { verts: null, polys: null, format: null, color: '#ffeeaa' },
  Sun: { verts: null, polys: null, format: null, color: '#ffffff' },
  Camera: { verts: null, polys: null, format: null, color: '#4499ff' },
  ChaoMan: { verts: null, polys: null, format: '.glb', color: '#8a8a8a' },
};

const DEFAULT_DATA = { verts: '-', polys: '-', format: '-', color: '#888888' };
const BODY_TYPES = ['Dynamic', 'Fixed'];
const COLLIDERS = ['cuboid', 'ball', 'cylinder', 'convex_hull'];
const AXIS_COLORS = { X: '#e8524a', Y: '#6abf69', Z: '#4d9de0' };

function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString() : '-';
}

function formatFixed(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

function parseNumber(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function EditableXYZRow({ label, values, onCommit, disabled = false }) {
  const [editing, setEditing] = useState({ X: false, Y: false, Z: false });
  const [draft, setDraft] = useState({ X: '', Y: '', Z: '' });

  const beginEdit = useCallback((axis, currentValue) => {
    if (disabled) return;
    setEditing((prev) => ({ ...prev, [axis]: true }));
    setDraft((prev) => ({ ...prev, [axis]: formatFixed(currentValue) }));
  }, [disabled]);

  const finishEdit = useCallback((axis) => {
    setEditing((prev) => ({ ...prev, [axis]: false }));
    const parsed = Number.parseFloat(draft[axis]);
    if (!Number.isFinite(parsed)) return;
    const next = [...values];
    const index = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;
    next[index] = parsed;
    onCommit(next);
  }, [draft, onCommit, values]);

  const handleKeyDown = useCallback((axis, event) => {
    if (event.key === 'Enter') {
      event.target.blur();
    } else if (event.key === 'Escape') {
      setEditing((prev) => ({ ...prev, [axis]: false }));
    }
  }, []);

  return (
    <div className={styles.transformRow}>
      <span className={styles.transformLabel}>{label}</span>
      <div className={styles.xyzRow} style={{ flex: 1 }}>
        {['X', 'Y', 'Z'].map((axis, index) => (
          <div key={axis} style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 2 }}>
            <span className={styles.xyzLabel} style={{ color: AXIS_COLORS[axis] }}>
              {axis}
            </span>
            <input
              className={styles.xyzInput}
              value={editing[axis] ? draft[axis] : formatFixed(values[index])}
              disabled={disabled}
              aria-label={`${label} ${axis}`}
              onFocus={() => beginEdit(axis, values[index])}
              onChange={(event) => setDraft((prev) => ({ ...prev, [axis]: event.target.value }))}
              onBlur={() => finishEdit(axis)}
              onKeyDown={(event) => handleKeyDown(axis, event)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function EditablePhysicsSection({ object, updateSceneObjectPhysics }) {
  const physics = object.physics;

  return (
    <div className={styles.propSection}>
      <div className={styles.propSectionHeader}>Physics</div>

      <div className={styles.editorRow}>
        <span className={styles.meshInfoKey}>Body</span>
        <select
          className={styles.selectInput}
          value={physics.static ? 'Fixed' : 'Dynamic'}
          onChange={(event) =>
            updateSceneObjectPhysics(object.id, { static: event.target.value === 'Fixed' })
          }
        >
          {BODY_TYPES.map((type) => <option key={type}>{type}</option>)}
        </select>
      </div>

      <div className={styles.editorRow}>
        <span className={styles.meshInfoKey}>Collider</span>
        <select
          className={styles.selectInput}
          value={physics.collider}
          onChange={(event) => updateSceneObjectPhysics(object.id, { collider: event.target.value })}
        >
          {COLLIDERS.map((type) => <option key={type}>{type}</option>)}
        </select>
      </div>

      <NumberSlider
        label="Mass"
        value={physics.massKg}
        min={0.05}
        max={50}
        step={0.05}
        onChange={(massKg) => updateSceneObjectPhysics(object.id, { massKg })}
      />
      <NumberSlider
        label="Friction"
        value={physics.friction}
        min={0}
        max={1}
        step={0.01}
        onChange={(friction) => updateSceneObjectPhysics(object.id, { friction })}
      />
      <NumberSlider
        label="Bounce"
        value={physics.restitution}
        min={0}
        max={1}
        step={0.01}
        onChange={(restitution) => updateSceneObjectPhysics(object.id, { restitution })}
      />

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={Boolean(physics.breakable)}
          onChange={(event) => updateSceneObjectPhysics(object.id, { breakable: event.target.checked })}
        />
        <span>Breakable</span>
      </label>

      <div className={styles.meshInfoRow}>
        <span className={styles.meshInfoKey}>Source</span>
        <span className={styles.meshInfoVal}>{physics.needsVisualEstimate ? 'Needs VLM' : physics.source}</span>
      </div>
    </div>
  );
}

function SemanticMetadataSection({ object }) {
  const physics = object.physics ?? {};
  const appearance = object.appearance ?? {};
  const rows = [
    ['Category', physics.category ?? '-'],
    ['Material', physics.material ?? '-'],
    ['Confidence', Number.isFinite(physics.confidence) ? `${Math.round(physics.confidence * 100)}%` : '-'],
    ['Physics Source', physics.needsVisualEstimate ? 'Needs VLM' : physics.source ?? '-'],
    ['Texture', appearance.textureDescription || '-'],
    ['Appearance Source', appearance.source ?? '-'],
    ['Notes', physics.notes || '-'],
  ];

  return (
    <div className={styles.propSection}>
      <div className={styles.propSectionHeader}>Semantic Metadata</div>
      {rows.map(([key, value]) => (
        <div key={key} className={styles.meshInfoRow}>
          <span className={styles.meshInfoKey}>{key}</span>
          <span className={styles.meshInfoVal}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function NumberSlider({ label, value, min, max, step, onChange, disabled = false }) {
  return (
    <div className={styles.sliderRow}>
      <span className={styles.sliderLabel}>{label}</span>
      <input
        type="range"
        className={styles.slider}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(parseNumber(event.target.value, value))}
      />
      <input
        className={`${styles.xyzInput} ${styles.compactInput}`}
        value={formatFixed(value)}
        disabled={disabled}
        onChange={(event) => onChange(parseNumber(event.target.value, value))}
      />
    </div>
  );
}

export default function PropertiesPanel() {
  const {
    selectedObjectId,
    sceneObjects,
    updateSceneObjectTransform,
    updateSceneObjectAppearance,
    updateSceneObjectPhysics,
  } = useStore();
  const selected = selectedObjectId || 'Room_Mesh';
  const selectedSceneObject = sceneObjects.find((object) => object.id === selected);
  const data = selectedSceneObject
    ? {
        verts: formatNumber(selectedSceneObject.vertexCount),
        polys: formatNumber(selectedSceneObject.triangleCount),
        format: '.glb',
        color: selectedSceneObject.appearance?.baseColor ?? '#8a8a8a',
      }
    : OBJECT_DATA[selected] || DEFAULT_DATA;

  const transform = selectedSceneObject?.transform ?? {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
  const appearance = selectedSceneObject?.appearance ?? {
    baseColor: data.color,
    roughness: 0.8,
    metalness: 0.1,
  };
  const displayBaseColor = appearance.baseColor ?? data.color ?? '#8a8a8a';
  const disabled = !selectedSceneObject;

  const commitPosition = useCallback((position) => {
    if (selectedSceneObject) updateSceneObjectTransform(selectedSceneObject.id, { position });
  }, [selectedSceneObject, updateSceneObjectTransform]);
  const commitRotation = useCallback((rotation) => {
    if (selectedSceneObject) updateSceneObjectTransform(selectedSceneObject.id, { rotation });
  }, [selectedSceneObject, updateSceneObjectTransform]);
  const commitScale = useCallback((scale) => {
    if (selectedSceneObject) updateSceneObjectTransform(selectedSceneObject.id, { scale });
  }, [selectedSceneObject, updateSceneObjectTransform]);

  return (
    <div className={styles.propertiesPanel}>
      <div className="panel-header">
        <span>Properties</span>
        <span style={{ color: 'var(--text-accent)', fontFamily: 'var(--font-ui)', fontSize: 'var(--font-size-xs)' }}>
          {selectedSceneObject?.label ?? selected}
        </span>
      </div>

      <div className={styles.transformScroll}>
        <div className={styles.propSection}>
          <div className={styles.propSectionHeader}>Transform</div>
          <EditableXYZRow label="Location" values={transform.position} disabled={disabled} onCommit={commitPosition} />
          <EditableXYZRow label="Rotation" values={transform.rotation} disabled={disabled} onCommit={commitRotation} />
          <EditableXYZRow label="Scale" values={transform.scale} disabled={disabled} onCommit={commitScale} />
        </div>
      </div>

      <div className={styles.staticSections}>
        <div className={styles.propSection}>
          <div className={styles.propSectionHeader}>Material</div>

          <div className={styles.colorRow}>
            <span className={styles.colorLabel}>Base Color</span>
            <div className={styles.colorSwatch}>
              <input
                type="color"
                value={displayBaseColor}
                disabled={disabled}
                onChange={(event) =>
                  updateSceneObjectAppearance(selectedSceneObject.id, { baseColor: event.target.value })
                }
                title="Pick base color"
              />
            </div>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              {displayBaseColor.toUpperCase()}
            </span>
          </div>

          <NumberSlider
            label="Roughness"
            value={appearance.roughness}
            min={0}
            max={1}
            step={0.01}
            disabled={disabled}
            onChange={(roughness) => selectedSceneObject && updateSceneObjectAppearance(selectedSceneObject.id, { roughness })}
          />
          <NumberSlider
            label="Metalness"
            value={appearance.metalness}
            min={0}
            max={1}
            step={0.01}
            disabled={disabled}
            onChange={(metalness) => selectedSceneObject && updateSceneObjectAppearance(selectedSceneObject.id, { metalness })}
          />
        </div>

        {selectedSceneObject && (
          <>
            <SemanticMetadataSection object={selectedSceneObject} />
            <EditablePhysicsSection object={selectedSceneObject} updateSceneObjectPhysics={updateSceneObjectPhysics} />
          </>
        )}

        {data.verts && (
          <div className={styles.propSection}>
            <div className={styles.propSectionHeader}>Mesh Info</div>
            <div className={styles.meshInfoRow}>
              <span className={styles.meshInfoKey}>Vertices</span>
              <span className={styles.meshInfoVal}>{data.verts}</span>
            </div>
            <div className={styles.meshInfoRow}>
              <span className={styles.meshInfoKey}>Polygons</span>
              <span className={styles.meshInfoVal}>{data.polys}</span>
            </div>
            <div className={styles.meshInfoRow}>
              <span className={styles.meshInfoKey}>Format</span>
              <span className={styles.meshInfoVal}>{data.format}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
