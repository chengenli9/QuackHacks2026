import { useSceneStore } from '../store/sceneStore'
import type { SceneObject } from '../store/types'
import styles from './Inspector.module.css'

type Props = { selectedId: string | null }

function fmt(n: number): string {
  return n.toFixed(3)
}

function Vec3Row({ label, values }: { label: string; values: [number, number, number] }) {
  return (
    <div className={styles.vec3row}>
      <span className={styles.vecLabel}>{label}</span>
      <div className={styles.vecValues}>
        <span className={styles.axis}>X</span><span>{fmt(values[0])}</span>
        <span className={styles.axis}>Y</span><span>{fmt(values[1])}</span>
        <span className={styles.axis}>Z</span><span>{fmt(values[2])}</span>
      </div>
    </div>
  )
}

function ObjectInspector({ obj }: { obj: SceneObject }) {
  const setPhysics = useSceneStore((s) => s.setPhysics)
  const physics = obj.physics

  return (
    <div className={styles.content}>
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Object</div>
        <div className={styles.field}><span className={styles.fieldKey}>ID</span><span className={styles.fieldVal}>{obj.id}</span></div>
        <div className={styles.field}><span className={styles.fieldKey}>Label</span><span className={styles.fieldVal}>{obj.label}</span></div>
        <div className={styles.field}><span className={styles.fieldKey}>Kind</span><span className={styles.fieldVal}>{obj.kind}</span></div>
        <div className={styles.field}><span className={styles.fieldKey}>Visible</span><span className={styles.fieldVal}>{obj.visible ? 'Yes' : 'No'}</span></div>
        <div className={styles.field}><span className={styles.fieldKey}>Locked</span><span className={styles.fieldVal}>{obj.locked ? 'Yes' : 'No'}</span></div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Transform</div>
        <Vec3Row label="Position" values={obj.transform.position} />
        <Vec3Row label="Rotation" values={obj.transform.rotation} />
        <Vec3Row label="Scale" values={obj.transform.scale} />
      </section>

      {obj.bounds && (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>Bounds</div>
          <Vec3Row label="Size" values={obj.bounds.size} />
          <Vec3Row label="Center" values={obj.bounds.center} />
        </section>
      )}

      {physics && (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>Physics</div>
          <div className={styles.field}><span className={styles.fieldKey}>Category</span><span className={styles.fieldVal}>{physics.category}</span></div>
          <div className={styles.field}><span className={styles.fieldKey}>Material</span><span className={styles.fieldVal}>{physics.material}</span></div>
          <div className={styles.field}><span className={styles.fieldKey}>Mass</span><span className={styles.fieldVal}>{physics.massKg} kg</span></div>
          <div className={styles.field}><span className={styles.fieldKey}>Restitution</span><span className={styles.fieldVal}>{fmt(physics.restitution)}</span></div>
          <div className={styles.field}><span className={styles.fieldKey}>Friction</span><span className={styles.fieldVal}>{fmt(physics.friction)}</span></div>
          <div className={styles.field}><span className={styles.fieldKey}>Static</span><span className={styles.fieldVal}>{physics.static ? 'Yes' : 'No'}</span></div>
          <div className={styles.field}><span className={styles.fieldKey}>Collider</span><span className={styles.fieldVal}>{physics.collider}</span></div>
          <div className={styles.field}><span className={styles.fieldKey}>Confidence</span><span className={styles.fieldVal}>{Math.round(physics.confidence * 100)}%</span></div>
          {physics.notes && (
            <div className={styles.notes}>{physics.notes}</div>
          )}
          <div className={styles.sliderRow}>
            <label className={styles.fieldKey}>Restitution</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={physics.restitution}
              onChange={(e) => setPhysics(obj.id, { ...physics, restitution: parseFloat(e.target.value) })}
              className={styles.slider}
            />
          </div>
          <div className={styles.sliderRow}>
            <label className={styles.fieldKey}>Friction</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={physics.friction}
              onChange={(e) => setPhysics(obj.id, { ...physics, friction: parseFloat(e.target.value) })}
              className={styles.slider}
            />
          </div>
        </section>
      )}
    </div>
  )
}

export default function Inspector({ selectedId }: Props) {
  const objects = useSceneStore((s) => s.objects)
  const obj = selectedId ? objects[selectedId] : null

  return (
    <div className={styles.inspector}>
      <div className={styles.header}>Inspector</div>
      {!obj && (
        <div className={styles.empty}>Select an object to inspect.</div>
      )}
      {obj && <ObjectInspector obj={obj} />}
    </div>
  )
}
