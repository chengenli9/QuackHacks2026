import { create } from 'zustand';

const useStore = create((set) => ({
  // App navigation
  currentView: 'landing',
  setCurrentView: (view) => set({ currentView: view }),

  // Panel state
  leftPanelTab: 'video',
  chatSubTab: 'image',
  setLeftPanelTab: (tab) => set({ leftPanelTab: tab }),
  setChatSubTab: (tab) => set({ chatSubTab: tab }),

  // Viewport
  activeTool: 'select',
  viewMode: 'solid',
  setActiveTool: (tool) => set({ activeTool: tool }),
  setViewMode: (mode) => set({ viewMode: mode }),

  // Hierarchy
  selectedObjectId: 'Room_Mesh',
  expandedNodes: ['Scene', 'Room_Mesh', 'Lights'],
  setSelectedObject: (id) => set({ selectedObjectId: id }),
  toggleNode: (id) =>
    set((state) => ({
      expandedNodes: state.expandedNodes.includes(id)
        ? state.expandedNodes.filter((n) => n !== id)
        : [...state.expandedNodes, id],
    })),

  // Upload (mock)
  uploadedVideoName: null,
  uploadedVideoDuration: null,
  setUploadedVideo: (name, duration) =>
    set({ uploadedVideoName: name, uploadedVideoDuration: duration }),

  // Chat (mock)
  chatMessages: [
    { id: 1, sender: 'ai', text: 'Upload an image or describe an asset to generate a 3D model.' },
    { id: 2, sender: 'user', text: 'A wooden chair with a cushion.' },
    { id: 3, sender: 'ai', text: 'Generating a wooden chair mesh... This may take a moment.', loading: false },
    { id: 4, sender: 'ai', text: '✓ Asset ready — wooden_chair.glb added to your scene.' },
  ],
  addChatMessage: (msg) =>
    set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  updateLastMessage: (msg) =>
    set((state) => {
      const msgs = [...state.chatMessages];
      msgs[msgs.length - 1] = msg;
      return { chatMessages: msgs };
    }),
}));

export default useStore;
