import { useRef } from 'react';
import useStore from '../../store/useStore';
import styles from './RightPanel.module.css';

function NumInput({ value, onChange }) {
  const inputRef = useRef(null);

  // Sync DOM value when external value changes without focus
  const displayVal = parseFloat((value ?? 0).toFixed(3));

  const handleBlur = (e) => {
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      onChange(parsed);
    } else {
      e.target.value = String(displayVal);
    }
  };

  return (
    <input
      ref={inputRef}
      className={styles.xyzInput}
      defaultValue={displayVal}
      key={displayVal}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const parsed = parseFloat(e.target.value);
          if (!isNaN(parsed)) onChange(parsed);
        }
      }}
    />
  );
}

function XYZRow({ label, values, onChange }) {
  return (
    <div className={styles.transformRow}>
      <span className={styles.transformLabel}>{label}</span>
      <div className={styles.xyzRow} style={{ flex: 1 }}>
        {['X', 'Y', 'Z'].map((axis, i) => (
          <div key={axis} style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 2 }}>
            <span className={styles.xyzLabel}>{axis}</span>
            <NumInput
              value={values?.[i] ?? (label === 'Scale' ? 1 : 0)}
              onChange={(v) => {
                const next = [...(values || [0, 0, 0])];
                next[i] = v;
                onChange(next);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PropertiesPanel() {
  const { selectedObjectId, sceneObjects, setObjectTransform, setObjectPhysics, updateSceneObject } = useStore();
  const obj = selectedObjectId ? sceneObjects[selectedObjectId] : null;

  if (!obj) {
    return (
      <div className={styles.propertiesPanel}>
        <div className="panel-header"><span>Properties</span></div>
        <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-ui)' }}>
          No object selected
        </div>
      </div>
    );
  }

  const physics = obj.physics || {};
  const meshInfo = obj.meshInfo;
  const color = obj.color || '#888888';

  return (
    <div className={styles.propertiesPanel}>
      <div className="panel-header">
        <span>Properties</span>
        <span style={{ color: 'var(--text-accent)', fontFamily: 'var(--font-ui)', fontSize: 'var(--font-size-xs)' }}>
          {obj.label}
        </span>
      </div>

      {/* Transform */}
      <div className={styles.transformScroll}>
        <div className={styles.propSection}>
          <div className={styles.propSectionHeader}>Transform</div>
          <XYZRow
            label="Location"
            values={obj.position}
            onChange={(v) => setObjectTransform(obj.id, v, undefined, undefined)}
          />
          <XYZRow
            label="Rotation"
            values={obj.rotation}
            onChange={(v) => setObjectTransform(obj.id, undefined, v, undefined)}
          />
          <XYZRow
            label="Scale"
            values={obj.scale}
            onChange={(v) => setObjectTransform(obj.id, undefined, undefined, v)}
          />
        </div>
      </div>

      <div className={styles.staticSections}>
        {/* Material color for placeholder objects */}
        {obj.type === 'placeholder' && (
          <div className={styles.propSection}>
            <div className={styles.propSectionHeader}>Material</div>
            <div className={styles.colorRow}>
              <span className={styles.colorLabel}>Base Color</span>
              <div className={styles.colorSwatch}>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => updateSceneObject(obj.id, { color: e.target.value })}
                  title="Pick base color"
                />
              </div>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                {color.toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {/* Physics */}
        <div className={styles.propSection}>
          <div className={styles.propSectionHeader}>Physics</div>
          {[
            { key: 'massKg', label: 'Mass (kg)', min: 0, max: 1000, step: 0.1 },
            { key: 'friction', label: 'Friction', min: 0, max: 1, step: 0.01 },
            { key: 'restitution', label: 'Restitution', min: 0, max: 1, step: 0.01 },
          ].map(({ key, label, min, max, step }) => {
            const rawVal = key === 'massKg'
              ? (physics.massKg ?? physics.mass ?? 0)
              : (physics[key] ?? 0);
            return (
              <div key={key} className={styles.sliderRow}>
                <span className={styles.sliderLabel}>{label}</span>
                <input
                  type="range"
                  className={styles.slider}
                  min={min} max={max} step={step}
                  value={rawVal}
                  onChange={(e) => setObjectPhysics(obj.id, { [key]: parseFloat(e.target.value) })}
                />
                <span className={styles.sliderVal}>
                  {rawVal.toFixed(key === 'massKg' ? 1 : 2)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Mesh Info */}
        {meshInfo && (
          <div className={styles.propSection}>
            <div className={styles.propSectionHeader}>Mesh Info</div>
            <div className={styles.meshInfoRow}>
              <span className={styles.meshInfoKey}>Vertices</span>
              <span className={styles.meshInfoVal}>{meshInfo.vertices?.toLocaleString() ?? '—'}</span>
            </div>
            <div className={styles.meshInfoRow}>
              <span className={styles.meshInfoKey}>Polygons</span>
              <span className={styles.meshInfoVal}>{meshInfo.polygons?.toLocaleString() ?? '—'}</span>
            </div>
            <div className={styles.meshInfoRow}>
              <span className={styles.meshInfoKey}>Format</span>
              <span className={styles.meshInfoVal}>{meshInfo.format ?? '—'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
