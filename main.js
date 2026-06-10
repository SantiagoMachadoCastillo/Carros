// Use the browser-ready ES module build of three.js from a CDN
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x007FFF);
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
// Habilitar sombras
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild( renderer.domElement );
const cameraOffset = new THREE.Vector3(
0,
4,
8
);
const followCameraTarget = new THREE.Vector3();
const loader = new THREE.TextureLoader();
const fbxLoader = new FBXLoader();
const carMaterialSettingsKey = 'threejs-sport-car-material-settings';
const carMaterialSettingsVersion = 2;
let savedCarMaterialSettings = {};

try {
  const parsedSettings = JSON.parse(window.localStorage.getItem(carMaterialSettingsKey) || '{}');
  if ( parsedSettings.__version === carMaterialSettingsVersion ) {
    savedCarMaterialSettings = parsedSettings;
  }
} catch (error) {
  savedCarMaterialSettings = {};
}

const car = new THREE.Group();
car.position.set(13, 0, 17);
car.rotation.y = Math.PI / 2; // orientar el coche hacia el inicio
scene.add(car);

// MATERIALES DEL CARRO
// Aquí se registran las piezas del modelo FBX. Cada fila del panel corresponde
// a un material del coche, normalmente algo como carrocería, cristales, ruedas,
// faros, interior o detalles pequeños, según cómo venga separado el modelo.
// Edita este objeto si quieres poner nombres más claros a cada pieza del coche.
const carPartLabels = {
  // Ejemplos:
  // 'Body': 'Carrocería',
  // 'Glass': 'Cristales',
  // 'Wheel': 'Ruedas',
};

const defaultCarPartColors = {
  'cube 1': { r: 255, g: 0, b: 0 },
  'cube 001 1': { r: 255, g: 0, b: 0 },
  'cube 2': { r: 17, g: 0, b: 255 },
  'cube 002 1': { r: 17, g: 0, b: 255 },
  'cube 3': { r: 0, g: 0, b: 0 },
  'cube 003 1': { r: 0, g: 0, b: 0 },
  'cube 4': { r: 255, g: 221, b: 0 },
  'cube 004 1': { r: 255, g: 221, b: 0 },
  'cube 5': { r: 165, g: 29, b: 29 },
  'cube 005 1': { r: 165, g: 29, b: 29 },
  'cube 6': { r: 36, g: 75, b: 153 },
  'cube 006 1': { r: 36, g: 75, b: 153 },
  'cube 7': { r: 0, g: 76, b: 255 },
  'cube 007 1': { r: 0, g: 76, b: 255 },
  'cube 8': { r: 186, g: 54, b: 54 },
  'cube 008 1': { r: 186, g: 54, b: 54 },
  'cylinder 001 1': { r: 237, g: 12, b: 12 },
  'cylinder 001 2': { r: 0, g: 0, b: 0 },
  'cylinder 001 3': { r: 0, g: 0, b: 0 },
};

function normalizeCarPartKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const carMaterials = [];
const carMaterialBySourceUuid = new Map();

function persistCarMaterialSettings() {
  const payload = {
    __version: carMaterialSettingsVersion,
  };

  carMaterials.forEach((entry) => {
    payload[entry.storageKey] = {
      color: entry.material.color
        ? {
            r: Math.round(entry.material.color.r * 255),
            g: Math.round(entry.material.color.g * 255),
            b: Math.round(entry.material.color.b * 255),
          }
        : undefined,
      opacity: entry.material.opacity,
      transparent: entry.material.transparent,
    };
  });

  window.localStorage.setItem(carMaterialSettingsKey, JSON.stringify(payload));
}

function registerCarMaterial(sourceMaterial, materialLabel, storageKey) {
  if ( carMaterialBySourceUuid.has(sourceMaterial.uuid) ) {
    return carMaterialBySourceUuid.get(sourceMaterial.uuid);
  }

  const material = sourceMaterial.clone();
  const requiresTransparency = Boolean(
    sourceMaterial.transparent ||
    sourceMaterial.opacity < 1 ||
    sourceMaterial.alphaMap ||
    sourceMaterial.alphaTest > 0
  );

  material.transparent = requiresTransparency;
  if ( requiresTransparency ) {
    material.opacity = sourceMaterial.opacity ?? 1;
    material.depthWrite = false;
  }

  const entry = {
    label: carPartLabels[materialLabel] || materialLabel || sourceMaterial.name || `Material ${carMaterials.length + 1}`,
    storageKey,
    sourceMaterial,
    material,
    requiresTransparency,
  };

  const defaultColor = defaultCarPartColors[normalizeCarPartKey(entry.label)];
  if ( entry.material.color && defaultColor && !savedCarMaterialSettings[storageKey] ) {
    entry.material.color.setRGB(
      defaultColor.r / 255,
      defaultColor.g / 255,
      defaultColor.b / 255
    );
  }

  const savedSettings = storageKey ? savedCarMaterialSettings[storageKey] : undefined;
  if ( savedSettings ) {
    if ( entry.material.color && savedSettings.color ) {
      entry.material.color.setRGB(
        (savedSettings.color.r ?? 0) / 255,
        (savedSettings.color.g ?? 0) / 255,
        (savedSettings.color.b ?? 0) / 255
      );
    }

    if ( typeof savedSettings.opacity === 'number' ) {
      entry.material.opacity = savedSettings.opacity;
      entry.material.transparent = savedSettings.opacity < 1 || requiresTransparency;
      entry.material.depthWrite = !(savedSettings.opacity < 1 || requiresTransparency);
    }
  }

  carMaterials.push(entry);
  carMaterialBySourceUuid.set(sourceMaterial.uuid, entry);
  return entry;
}

function buildMaterialEditor() {
  const panel = document.createElement('div');
  panel.style.position = 'fixed';
  panel.style.top = '12px';
  panel.style.right = '12px';
  panel.style.zIndex = '20';
  panel.style.maxWidth = '320px';
  panel.style.maxHeight = 'calc(100vh - 24px)';
  panel.style.overflow = 'auto';
  panel.style.padding = '12px';
  panel.style.borderRadius = '12px';
  panel.style.background = 'rgba(10, 18, 28, 0.78)';
  panel.style.color = '#fff';
  panel.style.fontFamily = 'system-ui, sans-serif';
  panel.style.fontSize = '13px';
  panel.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.25)';
  panel.style.backdropFilter = 'blur(8px)';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.gap = '10px';

  const title = document.createElement('div');
  title.textContent = 'Materiales del coche';
  title.style.fontWeight = '700';
  header.appendChild(title);

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.textContent = 'Cerrar';
  toggleButton.style.border = '0';
  toggleButton.style.borderRadius = '8px';
  toggleButton.style.padding = '6px 10px';
  toggleButton.style.background = 'rgba(255, 255, 255, 0.14)';
  toggleButton.style.color = '#fff';
  toggleButton.style.cursor = 'pointer';
  header.appendChild(toggleButton);

  panel.appendChild(header);

  const content = document.createElement('div');
  content.style.marginTop = '10px';
  panel.appendChild(content);

  carMaterials.forEach((entry) => {
    const card = document.createElement('div');
    card.style.borderTop = '1px solid rgba(255, 255, 255, 0.12)';
    card.style.paddingTop = '10px';
    card.style.marginTop = '10px';

    // Este nombre identifica la pieza o el material que estás editando.
    const name = document.createElement('div');
    name.textContent = entry.label;
    name.style.fontWeight = '600';
    name.style.marginBottom = '8px';
    card.appendChild(name);

    if ( entry.material.color ) {
      // RGB de la pieza: cambia aquí el color base de la parte del carro.
      const rgbRow = document.createElement('div');
      rgbRow.style.display = 'grid';
      rgbRow.style.gridTemplateColumns = 'repeat(3, 1fr)';
      rgbRow.style.gap = '6px';
      rgbRow.style.marginBottom = '8px';

      const createRgbInput = (channelLabel, value, onChange) => {
        const wrapper = document.createElement('label');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.gap = '4px';

        const label = document.createElement('span');
        label.textContent = channelLabel;

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '255';
        input.step = '1';
        input.value = String(value);
        input.addEventListener('input', () => {
          onChange(Number(input.value));
        });

        wrapper.appendChild(label);
        wrapper.appendChild(input);
        return input;
      };

      const redInput = createRgbInput('R', Math.round(entry.material.color.r * 255), (value) => {
        entry.material.color.r = Math.min(255, Math.max(0, value)) / 255;
        entry.material.needsUpdate = true;
        persistCarMaterialSettings();
      });

      const greenInput = createRgbInput('G', Math.round(entry.material.color.g * 255), (value) => {
        entry.material.color.g = Math.min(255, Math.max(0, value)) / 255;
        entry.material.needsUpdate = true;
        persistCarMaterialSettings();
      });

      const blueInput = createRgbInput('B', Math.round(entry.material.color.b * 255), (value) => {
        entry.material.color.b = Math.min(255, Math.max(0, value)) / 255;
        entry.material.needsUpdate = true;
        persistCarMaterialSettings();
      });

      rgbRow.appendChild(redInput.parentElement);
      rgbRow.appendChild(greenInput.parentElement);
      rgbRow.appendChild(blueInput.parentElement);
      card.appendChild(rgbRow);
    }

    if ( entry.requiresTransparency || entry.material.transparent ) {
      // Transparencia: útil para cristales, parabrisas o piezas translúcidas.
      const opacityRow = document.createElement('div');
      opacityRow.style.display = 'flex';
      opacityRow.style.alignItems = 'center';
      opacityRow.style.justifyContent = 'space-between';
      opacityRow.style.gap = '10px';

      const opacityLabel = document.createElement('span');
      opacityLabel.textContent = 'Opacidad';

      const opacityInput = document.createElement('input');
      opacityInput.type = 'range';
      opacityInput.min = '0';
      opacityInput.max = '1';
      opacityInput.step = '0.01';
      opacityInput.value = String(entry.material.opacity ?? 1);
      opacityInput.style.width = '150px';
      opacityInput.addEventListener('input', () => {
        const opacity = Number(opacityInput.value);
        entry.material.opacity = opacity;
        entry.material.transparent = opacity < 1 || entry.requiresTransparency;
        entry.material.depthWrite = !(opacity < 1 || entry.requiresTransparency);
        entry.material.needsUpdate = true;
        persistCarMaterialSettings();
      });

      opacityRow.appendChild(opacityLabel);
      opacityRow.appendChild(opacityInput);
      card.appendChild(opacityRow);
    }

    content.appendChild(card);
  });

  let isCollapsed = false;
  toggleButton.addEventListener('click', () => {
    isCollapsed = !isCollapsed;
    content.style.display = isCollapsed ? 'none' : 'block';
    toggleButton.textContent = isCollapsed ? 'Abrir' : 'Cerrar';
  });

  document.body.appendChild(panel);
}

fbxLoader.load(
  'sport car.fbx',
  (fbx) => {
    fbx.traverse((child) => {
      if ( child.isMesh ) {
        // Cada mesh del FBX representa una pieza distinta del coche.
        // Si el modelo trae nodos separados, aquí quedan mapeados para editarse
        // de forma independiente desde el panel.
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        const clonedMaterials = materials.map((sourceMaterial, index) => {
          const storageKey = `${child.name || child.uuid}:${index}:${sourceMaterial.name || 'material'}`;
          const entry = registerCarMaterial(
            sourceMaterial,
            child.name ? `${child.name} ${index + 1}` : sourceMaterial.name,
            storageKey
          );

          return entry.material;
        });

        child.material = Array.isArray(child.material) ? clonedMaterials : clonedMaterials[0];
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const boundingBox = new THREE.Box3().setFromObject(fbx);
    const size = boundingBox.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z) || 1;
    const targetSize = 2;
    const scale = targetSize / maxDimension;

    fbx.scale.setScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(fbx);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

    fbx.position.x -= scaledCenter.x;
    fbx.position.z -= scaledCenter.z;
    fbx.position.y -= scaledBox.min.y;

    car.add(fbx);
    persistCarMaterialSettings();
    buildMaterialEditor();
  },
  undefined,
  (error) => {
    console.error('No se pudo cargar sport car.fbx', error);
  }
);

// ==========================
// IMAGEN DEL CIRCUITO
// ==========================

const mapWidth = 80;
const mapHeight = 45;

const trackTexture = loader.load('pista carrera.jpg');

const trackPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(mapWidth, mapHeight),
    new THREE.MeshStandardMaterial({
        map: trackTexture
    })
);

trackPlane.rotation.x = -Math.PI / 2;
trackPlane.position.y = 0.01;
trackPlane.receiveShadow = true;

scene.add(trackPlane);

// Cargar coches adicionales `car_1` y `car_2` con sus texturas y colocarlos en escena
function loadCarModel(filePath, texturePath, position, targetSize = 1) {
  const texture = texturePath ? loader.load(texturePath) : null;

  fbxLoader.load(
    filePath,
    (fbx) => {
      fbx.traverse((child) => {
        if ( child.isMesh ) {
          child.castShadow = true;
          child.receiveShadow = true;

          if ( Array.isArray(child.material) ) {
            child.material = child.material.map((m) => {
              const mat = m.clone();
              if ( texture ) mat.map = texture;
              mat.needsUpdate = true;
              return mat;
            });
          } else if ( child.material ) {
            const mat = child.material.clone();
            if ( texture ) mat.map = texture;
            mat.needsUpdate = true;
            child.material = mat;
          }
        }
      });

      const boundingBox = new THREE.Box3().setFromObject(fbx);
      const size = boundingBox.getSize(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z) || 1;
      const scale = targetSize / maxDimension;

      fbx.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(fbx);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

      fbx.position.x -= scaledCenter.x;
      fbx.position.z -= scaledCenter.z;
      fbx.position.y -= scaledBox.min.y;

      // Aplicar la posición solicitada (offset desde el centro)
      fbx.position.add(new THREE.Vector3(position.x || 0, position.y || 0, position.z || 0));

      scene.add(fbx);
    },
    undefined,
    (err) => {
      console.error('No se pudo cargar', filePath, err);
    }
  );
}

// Posicionar dos coches en la escena
loadCarModel('car_1.fbx', 'Car Texture 1.png', { x: -6, y: 0, z: 6 }, 1.2);
loadCarModel('car_2.fbx', 'Car Texture 2.png', { x: 6, y: 0, z: 6 }, 1.2);

// Carga simple de FBX y creación de instancias (sin clase)
// Crear cubos placeholders en las posiciones (devuelve array de meshes)
function createPlaceholderCubes(key, positions, size = 0.8, baseY = 0) {
  const cubes = [];
  const geom = new THREE.BoxGeometry(size, size, size);
  const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
  positions.slice(0, 10).forEach((pos, i) => {
    const cube = new THREE.Mesh(geom.clone(), mat.clone());
    cube.position.set(pos.x, (pos.y ?? baseY) + size / 2, pos.z);
    cube.name = `${key}-placeholder-${i + 1}`;
    cube.userData._placeholderIndex = i;
    cube.castShadow = true;
    cube.receiveShadow = true;
    scene.add(cube);
    cubes.push(cube);
  });
  return cubes;
}

// Carga FBX y reemplaza cubos placeholder con los modelos cuando cargan
function loadAndReplaceInstances(filePath, positions, placeholders, targetSize = 1, baseY = 0.02) {
  fbxLoader.load(
    filePath,
    (fbx) => {
      fbx.traverse((child) => {
        if ( child.isMesh ) {
          child.castShadow = true;
          child.receiveShadow = true;
          if ( Array.isArray(child.material) ) {
            child.material = child.material.map((m) => m.clone());
          } else if ( child.material ) {
            child.material = child.material.clone();
          }
        }
      });

      const boundingBox = new THREE.Box3().setFromObject(fbx);
      const size = boundingBox.getSize(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z) || 1;
      const scale = targetSize / maxDimension;

      fbx.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(fbx);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

      fbx.position.x -= scaledCenter.x;
      fbx.position.z -= scaledCenter.z;
      fbx.position.y -= scaledBox.min.y;

      // Reemplazar cada placeholder por una instancia del modelo
      placeholders.slice(0, 10).forEach((ph, i) => {
        const inst = fbx.clone(true);
        inst.position.copy(ph.position);
        inst.rotation.y = ph.rotation.y || 0;
        inst.name = `${filePath}-${i + 1}`;
        scene.add(inst);
        // remover placeholder
        scene.remove(ph);
      });
    },
    undefined,
    (err) => {
      console.error('No se pudo cargar', filePath, err);
      // marcar placeholders en rojo para indicar fallo
      placeholders.forEach((ph) => {
        if ( ph.material ) ph.material.color.set(0xff5555);
      });
    }
  );
}

const marioPlantPositions = [
  { x: -18, y: 0, z: -14 },
  { x: -12, y: 0, z: -8 },
  { x: -10, y: 0, z: 0 },
  { x: -13, y: 0, z: 6 },
  { x: -2, y: 0, z: 14 },
  { x: 4, y: 0, z: 10 },
  { x: 20, y: 0, z: 5 },
  { x: 14, y: 0, z: -2 },
  { x: 18, y: 0, z: -8 },
  { x: 22, y: 0, z: -14 },
];

const plantaPositions = [
  { x: -20, y: 0, z: 14 },
  { x: -16, y: 0, z: 8 },
  { x: -12, y: 0, z: 2 },
  { x: -8, y: 0, z: -4 },
  { x: -4, y: 0, z: -10 },
  { x: 2, y: 0, z: -12 },
  { x: 8, y: 0, z: -6 },
  { x: 12, y: 0, z: 0 },
  { x: 16, y: 0, z: 6 },
  { x: 20, y: 0, z: 12 },
];

// Primero crear cubos placeholders donde irán los objetos
const marioPlaceholders = createPlaceholderCubes('MARIOPLANT', marioPlantPositions, 1.0, 0);
const plantaPlaceholders = createPlaceholderCubes('planta', plantaPositions, 0.8, 0);

// Luego cargar modelos y reemplazar los cubos por los modelos reales cuando estén listos
loadAndReplaceInstances('MARIOPLANT.fbx', marioPlantPositions, marioPlaceholders, 1.2, 0);
loadAndReplaceInstances('planta.fbx', plantaPositions, plantaPlaceholders, 1, 0);

// Controles de movimiento por teclado (flechas + WASD)
const movement = { forward: false, back: false, left: false, right: false };
const maxSpeed = 15; // unidades por segundo
const accelerationRate = 4; // tarda más en acelerar
const brakingRate = 6.8; // frena más rápido que acelera
const frictionRate = 1.4; // fricción cuando no se pisa ningún pedal
const turnRate = 2; // radianes por segundo
const turnSpeedLossRate = 0.5; // pierde un poco de velocidad al girar
const movingThreshold = 0.001;
let currentSpeed = 0;
let _prevTime = 0;

function handleKey( event, isDown ) {
  switch ( event.key ) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      movement.forward = isDown;
      event.preventDefault();
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      movement.back = isDown;
      event.preventDefault();
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      movement.left = isDown;
      event.preventDefault();
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      movement.right = isDown;
      event.preventDefault();
      break;
  }
}

window.addEventListener('keydown', (e) => handleKey(e, true));
window.addEventListener('keyup', (e) => handleKey(e, false));
const ambientLight = new THREE.AmbientLight(
0xffffff,
1.2
);

scene.add(ambientLight);

const sun = new THREE.DirectionalLight(
0xffffff,
2
);

sun.position.set(50, 80, 50);

sun.castShadow = true;

sun.shadow.mapSize.width = 4096;
sun.shadow.mapSize.height = 4096;

scene.add(sun);


camera.position.z = 5;
camera.position.y = 5;

const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.enabled = false;

let developerViewEnabled = false;

function updateDeveloperViewButton(button) {
  button.textContent = developerViewEnabled ? 'Salir de dev' : 'Vista dev';
}

function setDeveloperViewEnabled(enabled) {
  developerViewEnabled = enabled;
  orbitControls.enabled = enabled;

  if ( enabled ) {
    orbitControls.target.copy(car.position);
    orbitControls.update();
  } else {
    camera.lookAt(
      car.position.x,
      car.position.y + 0.5,
      car.position.z
    );
  }

  updateDeveloperViewButton(developerViewButton);
}

const developerViewButton = document.createElement('button');
developerViewButton.type = 'button';
developerViewButton.style.position = 'fixed';
developerViewButton.style.left = '12px';
developerViewButton.style.top = '12px';
developerViewButton.style.zIndex = '30';
developerViewButton.style.border = '0';
developerViewButton.style.borderRadius = '10px';
developerViewButton.style.padding = '10px 14px';
developerViewButton.style.background = 'rgba(10, 18, 28, 0.78)';
developerViewButton.style.color = '#fff';
developerViewButton.style.fontFamily = 'system-ui, sans-serif';
developerViewButton.style.fontSize = '13px';
developerViewButton.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.25)';
developerViewButton.style.backdropFilter = 'blur(8px)';
developerViewButton.style.cursor = 'pointer';
developerViewButton.addEventListener('click', () => {
  setDeveloperViewEnabled(!developerViewEnabled);
});
document.body.appendChild(developerViewButton);
updateDeveloperViewButton(developerViewButton);

const speedDisplay = document.createElement('div');

speedDisplay.style.position = 'fixed';
speedDisplay.style.bottom = '20px';
speedDisplay.style.right = '20px';
speedDisplay.style.padding = '10px 15px';
speedDisplay.style.background = 'rgba(0,0,0,0.7)';
speedDisplay.style.color = 'white';
speedDisplay.style.fontSize = '24px';
speedDisplay.style.fontWeight = 'bold';
speedDisplay.style.borderRadius = '10px';
speedDisplay.style.fontFamily = 'Arial';

speedDisplay.textContent = '0 km/h';

document.body.appendChild(speedDisplay);

renderer.setAnimationLoop( animate );

function animate( time ) {

  // calcular delta de tiempo
  if ( _prevTime === 0 ) _prevTime = time;
  const delta = ( time - _prevTime ) / 1000;
  _prevTime = time;

  const hasForwardInput = movement.forward && !movement.back;
  const hasReverseInput = movement.back && !movement.forward;

  if ( hasForwardInput ) {
    if ( currentSpeed < 0 ) {
      currentSpeed = Math.min(0, currentSpeed + brakingRate * delta);
    } else {
      currentSpeed = Math.min(maxSpeed, currentSpeed + accelerationRate * delta);
    }
  } else if ( hasReverseInput ) {
    if ( currentSpeed > 0 ) {
      currentSpeed = Math.max(0, currentSpeed - brakingRate * delta);
    } else {
      currentSpeed = Math.max(-maxSpeed, currentSpeed - accelerationRate * delta);
    }
  } else {
    if ( currentSpeed > 0 ) {
      currentSpeed = Math.max(0, currentSpeed - frictionRate * delta);
    } else if ( currentSpeed < 0 ) {
      currentSpeed = Math.min(0, currentSpeed + frictionRate * delta);
    }
  }

  if ( Math.abs(currentSpeed) < movingThreshold ) {
    currentSpeed = 0;
  }

  const isMoving = Math.abs(currentSpeed) > movingThreshold;

  if ( isMoving ) {
    if ( movement.left || movement.right ) {
      currentSpeed *= Math.max(0, 1 - turnSpeedLossRate * delta);
    }

    const turnDirection = currentSpeed >= 0 ? 1 : -1;
    if ( movement.left ) {
      car.rotation.y += turnRate * delta * turnDirection;
    }
    if ( movement.right ) {
      car.rotation.y -= turnRate * delta * turnDirection;
    }
  }

  if ( isMoving ) {
    car.translateZ( -currentSpeed * delta );
  }

  if ( developerViewEnabled ) {
    orbitControls.target.copy(car.position);
    orbitControls.update();
  } else {
    const desiredCameraPosition =
      cameraOffset.clone()
      .applyQuaternion(car.quaternion)
      .add(car.position);

    camera.position.lerp(
        desiredCameraPosition,
        0.08
    );

    followCameraTarget.set(
      car.position.x,
      car.position.y + 0.5,
      car.position.z
    );
    camera.lookAt(followCameraTarget);
  }



  //cube.rotation.x = time / 2000;
  //cube.rotation.y = time / 1000;

  renderer.render( scene, camera );

  const maxKmH = 180; // velocidad máxima mostrada

const speedKmH =
    Math.abs(currentSpeed / maxSpeed) * maxKmH;

speedDisplay.textContent =
    `${Math.round(speedKmH)} km/h`;

}