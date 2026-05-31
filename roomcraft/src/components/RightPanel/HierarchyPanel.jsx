import { useState } from 'react';
import { Box, Camera, ChevronRight, Eye, Globe, Lightbulb } from 'lucide-react';
import useStore from '../../store/useStore';
import styles from './RightPanel.module.css';

const STATIC_TREE = [
  {
    id: 'Scene',
    label: 'Scene',
    icon: Globe,
    children: [
      {
        id: 'Room_Mesh',
        label: 'Room_Mesh',
        icon: Box,
        children: [
          { id: 'Floor', label: 'Floor', icon: Box },
          { id: 'Walls', label: 'Walls', icon: Box },
          { id: 'Ceiling', label: 'Ceiling', icon: Box },
        ],
      },
      {
        id: 'Lights',
        label: 'Lights',
        icon: Lightbulb,
        children: [
          { id: 'Ambient', label: 'Ambient', icon: Lightbulb },
          { id: 'Sun', label: 'Sun', icon: Lightbulb },
        ],
      },
      { id: 'Camera', label: 'Camera', icon: Camera },
    ],
  },
];

function buildTree(sceneObjects) {
  if (!sceneObjects.length) return STATIC_TREE;

  const importedNode = {
    id: 'Imported_GLB',
    label: 'Imported GLB',
    icon: Box,
    children: sceneObjects.map((object) => ({
      id: object.id,
      label: object.label,
      icon: Box,
    })),
  };

  return STATIC_TREE.map((node) =>
    node.id === 'Scene'
      ? { ...node, children: [node.children[0], importedNode, ...node.children.slice(1)] }
      : node
  );
}

function nodeMatchesSearch(node, searchQuery) {
  if (!searchQuery) return true;
  const query = searchQuery.toLowerCase();
  return (
    node.label.toLowerCase().includes(query) ||
    node.children?.some((child) => nodeMatchesSearch(child, searchQuery))
  );
}

function TreeNode({ node, depth = 0, searchQuery }) {
  const { selectedObjectId, setSelectedObject, expandedNodes, toggleNode } = useStore();
  const isExpanded = expandedNodes.includes(node.id);
  const isSelected = selectedObjectId === node.id;
  const hasChildren = node.children?.length > 0;
  const Icon = node.icon;

  if (!nodeMatchesSearch(node, searchQuery)) return null;

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
            onClick={(event) => {
              event.stopPropagation();
              toggleNode(node.id);
            }}
          >
            <ChevronRight size={10} />
          </span>
        ) : (
          <span className={styles.chevronSpacer} />
        )}
        <span className={styles.nodeIcon}>
          <Icon size={12} />
        </span>
        <span className={styles.nodeName}>{node.label}</span>
        <button className={styles.visibilityBtn} onClick={(event) => event.stopPropagation()}>
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
  const sceneObjects = useStore((state) => state.sceneObjects);
  const tree = buildTree(sceneObjects);

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
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>

      <div className={styles.hierarchyScroll}>
        {tree.map((node) => (
          <TreeNode key={node.id} node={node} searchQuery={searchQuery} />
        ))}
      </div>
    </div>
  );
}
