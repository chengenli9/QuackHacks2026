import {
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';

const IMAGE_DATA_URL_RE = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/;

export function dataUrlToImagePayload(dataUrl) {
  const match = IMAGE_DATA_URL_RE.exec(dataUrl);
  if (!match) {
    throw new Error('Expected an image data URL with base64 content.');
  }

  return {
    imageMimeType: match[1],
    imageBase64: match[2],
  };
}

export function renderObjectPreviewToDataUrl(object3d, { width = 384, height = 384 } = {}) {
  if (typeof document === 'undefined') {
    throw new Error('Object preview rendering requires a browser document.');
  }

  const renderer = new WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(width, height, false);
  renderer.setClearColor(new Color('#202226'), 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, width / height, 0.01, 1000);
  const group = new Group();
  const clone = object3d.clone(true);
  group.add(clone);
  scene.add(group);

  clone.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(clone);
  const center = new Vector3();
  const size = new Vector3();
  box.getCenter(center);
  box.getSize(size);
  group.position.sub(center);

  const radius = Math.max(size.x, size.y, size.z, 0.5);
  camera.position.set(radius * 1.5, radius * 0.9, radius * 1.5);
  camera.lookAt(0, 0, 0);

  scene.add(new HemisphereLight('#ffffff', '#6f7680', 2.4));
  const keyLight = new DirectionalLight('#ffffff', 2.2);
  keyLight.position.set(radius, radius * 2, radius);
  scene.add(keyLight);

  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL('image/png');
  renderer.dispose();
  return dataUrl;
}
