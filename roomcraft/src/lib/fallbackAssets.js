const FALLBACK_PROMPTS = {
  rubber_ball: 'rubber ball',
  wooden_crate: 'wooden crate',
  glass_vase: 'glass vase',
  metal_barrel: 'metal barrel',
  duck: 'rubber duck',
};

export function fallbackPromptForAssetKey(fallbackAssetKey) {
  return FALLBACK_PROMPTS[fallbackAssetKey] ?? fallbackAssetKey.replaceAll('_', ' ');
}
