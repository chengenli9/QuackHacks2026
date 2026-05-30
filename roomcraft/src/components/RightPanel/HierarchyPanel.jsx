import { useState } from 'react';
import { ChevronRight, Eye, Box, Lightbulb, Camera, Globe } from 'lucide-react';
import useStore from '../../store/useStore';
import styles from './RightPanel.module.css';

const TREE = [
  {
    id: 'Scene', label: 'Scene', icon: '🌐', children: [
      {
        id: 'Room_Mesh', label: 'Room_Mesh', icon: '📦', children: [
          { id: 'Floor',   label: 'Floor',   icon: '🔷' },
          { id: 'Walls',   label: 'Walls',   icon: '🔷' },
          { id: 'Ceiling', label: 'Ceiling', icon: '🔷' },
        ],
      },
      {
        id: 'Lights', label: 'Lights', icon: '💡', children: [
          { id: 'Ambient', label: 'Ambient', icon: '💡' },
          { id: 'Sun',     label: 'Sun',     icon: '💡' },
        ],
      },
      { id: 'Camera', label: 'Camera', icon: '📷' },
    ],
  },
];

function TreeNode({ node, depth = 0, searchQuery }) {
  const { selectedObjectId, setSelectedObject, expandedNodes, toggleNode } = useStore();
  const isExpanded = expandedNodes.includes(node.id);
  const isSelected = selectedObjectId === node.id;
  const hasChildren = node.children?.length > 0;

  // Filter by search
  const matchesSearch = !searchQuery || node.label.toLowerCase().includes(searchQuery.toLowerCase());
  const childrenMatchSearch = node.children?.some(
    (c) => !searchQuery || c.label.toLowerCase().includes(searchQuery.toLowerCase())
  );
  if (!matchesSearch && !childrenMatchSearch) return null;

  return (
    <div>
      <div
        className={`${styles.treeNode} ${isSelected ? styles.selected : ''}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => setSelectedObject(node.id)}
      >
        {hasChildren ? (
          <span
            className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}
            onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}
          >
            <ChevronRight size={10} />
          </span>
        ) : (
          <span className={styles.chevronSpacer} />
        )}
        <span className={styles.nodeIcon}>{node.icon}</span>
        <span className={styles.nodeName}>{node.label}</span>
        <button className={styles.visibilityBtn} onClick={(e) => e.stopPropagation()}>
          <Eye size={11} />
        </button>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} searchQuery={searchQuery} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HierarchyPanel() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className={styles.hierarchyPanel}>
      <div className="panel-header">
        <span>Outliner</span>
      </div>

      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className={styles.hierarchyScroll}>
        {TREE.map((node) => (
          <TreeNode key={node.id} node={node} searchQuery={searchQuery} />
        ))}
      </div>
    </div>
  );
}
