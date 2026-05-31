import HierarchyPanel from './HierarchyPanel';
import PropertiesPanel from './PropertiesPanel';
import styles from './RightPanel.module.css';

export default function RightPanel() {
  return (
    <aside className={styles.rightPanel}>
      <HierarchyPanel />
      <PropertiesPanel />
    </aside>
  );
}
