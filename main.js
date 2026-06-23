import * as THREE from 'three'; // import * as chips from 'shopkeeper'

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';// for the glb models  -> bird,clouds,grass,trees  

// library for more performance of raycasting -> check on ur current position for calculations
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.7.3/+esm';

// for random nature shapes -> instead of using math.random() // hardware based random number
import SimplexNoise from 'https://cdn.skypack.dev/simplex-noise@3.0.0';

//for bg music 
import { Howl } from 'https://cdn.jsdelivr.net/npm/howler@2.2.3/+esm';

// GPU power for calc the veiw distance/how much items ,clouds, fog ,resolution
import { getGPUTier } from 'https://cdn.jsdelivr.net/npm/detect-gpu@5.0.17/+esm';

const container = document.querySelector('.container');
const canvas    = document.querySelector('.canvas');

let
gpuTier,
   sizes,
    scene,
      camera,
        camY,
          camZ,
            renderer,
              clock,
                raycaster,
                  distance,
                    flyingIn,
                      clouds, 
                        movingCharDueToDistance,
                          movingCharTimeout,            
                            currentPos,
                              currentLookAt,
                                lookAtPosZ,
                                  thirdPerson,
                                    doubleSpeed,
                                      character,
                                        charPosYIncrement,
                                          charRotateYIncrement,
                                            charRotateYMax,
                                              mixer,
                                                charAnimation,
                                                  gliding,
                                                    charAnimationTimeout,
                                                      charNeck,
                                                        charBody, 
                                                          gltfLoader,
                                                            grassMeshes,
                                                        treeMeshes,
                                                      centerTile,
                                                    tileWidth,
                                                  amountOfHexInTile,
                                                simplex,
                                              maxHeight,
                                            snowHeight,
                                          lightSnowHeight,
                                        rockHeight,
                                      forestHeight,
                                    lightForestHeight,
                                  grassHeight,
                                sandHeight,
                              shallowWaterHeight,
                            waterHeight,
                          deepWaterHeight,
                        textures,
                      terrainTiles,
                    activeTile,
                  activeKeysPressed,
                bgMusic,
              muteBgMusic,
            infoModalDisplayed,
          loadingDismissed;
// memo ===================================================================
const setScene = async () => { //async for waiting loading 
  gpuTier = await getGPUTier(); // check the stage size before beginnig the scene //await for stopping 
  console.log(gpuTier.tier);

  sizes = {
    width:  container.offsetWidth,/// real size in pxels
    height: container.offsetHeight
  };

  scene             = new THREE.Scene(); //creating new scene 
  scene.background  = new THREE.Color(0xf5e6d3);/// same color of loadin page for ui/ux

  flyingIn  = true;
  camY      = 90,
  camZ      = -100; //this numbers for bird veiw or third person
  camera    = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 1, 300); //60 = field of veiw //1 for near ,300 for far // sizes.width / sizes.height = aspect ratio
  camera.position.set(0, camY, camZ);
  
  renderer = new THREE.WebGLRenderer({
    canvas:     canvas,
    antialias:  false  // for performance  // def=true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); //reducing resolution for performance 
  renderer.toneMapping = THREE.ACESFilmicToneMapping; //just for simplifying the colors to our screen
  renderer.outputEncoding = THREE.sRGBEncoding; // for srgb colors
  clock = new THREE.Clock(); //virtual clock for game  //as a stop watch

  scene.add(new THREE.HemisphereLight(0xffffbb, 0x080820, 0.7)); // 0xffffbb-> sun, earth ,intensity 

  gltfLoader = new GLTFLoader(); // for loading the models
  
  activeKeysPressed   = []; //for the keys pressed 
  muteBgMusic         = true; //for muting the bg color in the begginng
  infoModalDisplayed  = false; /// flag for info pagr 

  joystick(); 
  setFog();
  setRaycast(); // Raycast on based on gpu
  setTerrainValues(); // evrt thing about the ground
  await setClouds();
  await setCharacter(); // the bird 
  await setGrass();
  await setTrees();
  setCam(); // third person camera 
  createTile(); // the first tile
  createSurroundingTiles(`{"x":${centerTile.xFrom},"y":${centerTile.yFrom}}`); //surrond you not just one tile 
  calcCharPos(); // but our bird on the first tile
  resize(); // responsive 
  listenTo(); // event listeners
  render(); // render the scene
  pauseIconAnimation(); // for the loading page
  checkLoadingPage(); // check for removing the loading page 
  await setCoins(); // for creating coins 
  await setRings(); // for creating rings


}

const joystick = () => {

  const calcJoystickDir = (deg) => {

    activeKeysPressed = [];

    if(deg < 22.5 || deg >= 337.5) activeKeysPressed.push(39); // right
    if(deg >= 22.5 && deg < 67.5) {
      activeKeysPressed.push(38);
      activeKeysPressed.push(39);
    } // up right
    if(deg >= 67.5 && deg < 112.5) activeKeysPressed.push(38); // up
    if(deg >= 112.5 && deg < 157.5) {
      activeKeysPressed.push(38);
      activeKeysPressed.push(37);
    } // up left
    if(deg >= 157.5 && deg < 202.5) activeKeysPressed.push(37); // left
    if(deg >= 202.5 && deg < 247.5) {
      activeKeysPressed.push(40);
      activeKeysPressed.push(37);
    } // down left
    if(deg >= 247.5 && deg < 292.5) activeKeysPressed.push(40); // down
    if(deg >= 292.5 && deg < 337.5) {
      activeKeysPressed.push(40);
      activeKeysPressed.push(39);
    } // down right

  }

  const joystickOptions = {
    zone: document.getElementById('zone-joystick'),
    shape: 'circle',
    color: '#ffffff6b',
    mode: 'dynamic'  //everywhere on the screen
  };

  const manager = nipplejs.create(joystickOptions);

  manager.on('move', (e, data) => calcJoystickDir(data.angle.degree));
  manager.on('end', () => (activeKeysPressed = []));

};

const setFog = () => {

  THREE.ShaderChunk.fog_pars_vertex += `
    #ifdef USE_FOG
      varying vec3 vWorldPosition;
    #endif
  `;

  THREE.ShaderChunk.fog_vertex += `
    #ifdef USE_FOG
      vec4 worldPosition = projectionMatrix * modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
    #endif
  `;

  THREE.ShaderChunk.fog_pars_fragment += `
    #ifdef USE_FOG
      varying vec3 vWorldPosition;
      float fogHeight = 10.0;
    #endif
  `;

  const FOG_APPLIED_LINE = 'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );';
  THREE.ShaderChunk.fog_fragment = THREE.ShaderChunk.fog_fragment.replace(FOG_APPLIED_LINE, `
    float heightStep = smoothstep(fogHeight, 0.0, vWorldPosition.y);
    float fogFactorHeight = smoothstep( fogNear * 0.7, fogFar, vFogDepth );
    float fogFactorMergeHeight = fogFactorHeight * heightStep;
    
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactorMergeHeight );
    ${FOG_APPLIED_LINE}
  `);
  console.log(gpuTier.tier);
  const near = gpuTier.tier === 1 ? 30 : gpuTier.tier === 2 ? 60 : gpuTier.tier === 3 ? 70 : 30 // my own value
  const far = gpuTier.tier === 1 ? 102  : gpuTier.tier === 2 ? 100: gpuTier.tier === 3 ? 115 : 250 // ==="5"    //1000 means no fog

  scene.fog = new THREE.Fog(0xf5e6d3, 30, 250); // 0xf5e6d3 = color of the fog // 30 = near, 250 = far

}
// a function to set the raycast for the objects in the scene
// like a torch for emmiting ray and see when it will hit the ground
const setRaycast = () => {

  THREE.BufferGeometry.prototype.computeBoundsTree  = computeBoundsTree;  //calculating the bounds of the object
  THREE.BufferGeometry.prototype.disposeBoundsTree  = disposeBoundsTree; // removing the virtual bounds of the object to reduce the memory
  THREE.Mesh.prototype.raycast                      = acceleratedRaycast; //use the faster raycast
 //استخدم الكشاف اللي أسرع وذكي أكتر، اسمه BVH Raycast.// بدل ما نستخدم الكشاف العادي بتاع Three.js،
  raycaster = new THREE.Raycaster(); // make a new raycaster
  distance  = 14; // if the distance is less than 14, the bird will move up
  movingCharDueToDistance = false; // for the bird to move up first we define it as false
  raycaster.firstHitOnly = true; // just for the first hit

}

const setTerrainValues = () => {

  const centerTileFromTo =  70  //  35 = 70 x,y

  centerTile = {
    xFrom:  -centerTileFromTo,
    xTo:    centerTileFromTo,
    yFrom:  -centerTileFromTo,
    yTo:    centerTileFromTo
  };
  tileWidth             = centerTileFromTo * 2; // calculating the width of the tile according to the gpu tier
  amountOfHexInTile     = Math.pow((centerTile.xTo + 1) - centerTile.xFrom, 2); // how many hexagons in the tile  //pow 2 ineasted W x H the same
  // we calc the number to use it in the instanced mesh for the performance 
  simplex               = new SimplexNoise(); // the library for the random nature shapes
  maxHeight             = 30; // the max height of the terrain
  snowHeight            = maxHeight * 0.9; // the height of the snow
  lightSnowHeight       = maxHeight * 0.8; // the height of the light snow
  rockHeight            = maxHeight * 0.7; // the height of the rock
  forestHeight          = maxHeight * 0.45; // the height of the forest
  lightForestHeight     = maxHeight * 0.32; // the height of the light forest
  grassHeight           = maxHeight * 0.22; // the height of the grass
  sandHeight            = maxHeight * 0.15; // the height of the sand
  shallowWaterHeight    = maxHeight * 0.1;  // the height of the shallow water
  waterHeight           = maxHeight * 0.05; // the height of the water
  deepWaterHeight       = maxHeight * 0; // the height of the deep water
  textures              = {
    snow:         new THREE.Color(0xE5E5E5), // white
    lightSnow:    new THREE.Color(0x73918F), // light grey
    rock:         new THREE.Color(0x2A2D10), // dark grey
    forest:       new THREE.Color(0x224005), // dark green
    lightForest:  new THREE.Color(0x367308), // light green
    grass:        new THREE.Color(0x98BF06), // light green
    sand:         new THREE.Color(0xE3F272), // light yellow
    shallowWater: new THREE.Color(0x3EA9BF), // light blue
    water:        new THREE.Color(0x00738B), // blue
    deepWater:    new THREE.Color(0x015373) // dark blue
  };
  terrainTiles      = []; // the tiles in the scene
  
}

const setClouds = async () => {

  clouds                = [] // the clouds in the scene
  const amountOfClouds  = 10; 

  const createClouds = async () => {
    
    const cloudModels     = [];
    const cloudModelPaths = [
      'assets/clouds/cloud-one/scene.gltf',
      'assets/clouds/cloud-two/scene.gltf'
        ];
  
    for(let i = 0; i < cloudModelPaths.length; i++)
      cloudModels[i] = await gltfLoader.loadAsync(cloudModelPaths[i]);

    return cloudModels;

  }
// function for random number generation for the spaces between the clouds
  const getRandom = (max, min) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  const cloudModels = await createClouds();

  for(let i = 0; i < Math.floor(amountOfClouds / 2) * 2; i++) {   // half number for each type 10 => 5

    let cloud;

    if(i < Math.floor(amountOfClouds / 2)) { // cloud-one
      cloud = cloudModels[0].scene.clone(); // cloning the model
      cloud.scale.set(5.5, 5.5, 5.5);  // 1=x,2=y,3=z ;
      cloud.rotation.y = cloud.rotation.z = -(Math.PI / 2); // this equation for the rotation of the cloud by 90 degrees
    }
    else { // cloud-two
      cloud = cloudModels[1].scene.clone();
      cloud.scale.set(0.02, 0.02, 0.02);
      cloud.rotation.y = cloud.rotation.z = 0;
    }

    cloud.name = `cloud-${i}`
    cloud.position.set( getRandom(-20, 20), getRandom(camY - 90, camY - 110), getRandom(camZ + 200, camZ + 320) ); // random position for the cloud
    scene.add(cloud);
    clouds.push(cloud);

  }
  
  return;
}

const animateClouds = () => { // some of hexs

  for(let i = 0; i < clouds.length; i++)
    clouds[i].position.x = 
    clouds[i].position.x < 0 
      ? clouds[i].position.x - (clock.getElapsedTime() * 0.04)     // moving the clouds in the x axis  //to the right
      : clouds[i].position.x + (clock.getElapsedTime() * 0.04);   // moving the clouds in the -x axis  //to the left
    } // getElapsedTime() for the time passed since the start of the animation

const cleanUpClouds = () => {

  flyingIn = false; // the clouds are not moving anymore
  playMusic();

  for(let i = 0; i < clouds.length; i++) {
    const cloud = scene.getObjectByProperty('name', `cloud-${i}`);
    cleanUp(cloud);
  }

  clouds = undefined;

}
// memo====================================================================================
const setCharacter = async () => {

  const model = await gltfLoader.loadAsync('assets/bird/scene.gltf');
  const geo   = model.scene.getObjectByName('Cube001_0').geometry.clone(); // cloning the object geometry to use it in the raycast
  character   = model.scene; // cloning the model to use it in the scene

  character.position.set(0, 25, 0); // y = 25 for the  initial height of the bird
  character.scale.set(1.0, 1.0, 1.0);

  charPosYIncrement     = 0;
  charRotateYIncrement  = 0;
  charRotateYMax        = 0.01;

  mixer         = new THREE.AnimationMixer(character); // creating a new animation mixer for the character //more than one animation
  charAnimation = mixer.clipAction(model.animations[0]); //  gathering the first animation from the model //there is an animation inside the model file

  charNeck  = character.getObjectByName('Neck_Armature'); // neck
  charBody  = character.getObjectByName('Armature_rootJoint'); // body

  geo.computeBoundsTree(); // calculating the bounds of the object
  scene.add(character); // adding the character to the scene
  return;

}
// memo====================================================================================
const setCharAnimation = () => {

const min = 3, max = 14 // the min and max time for the animation by seconds 

  if(charAnimationTimeout) clearTimeout(charAnimationTimeout); // clear the timeout for the animation

  const interval = () => {

    if(!gliding) // if the bird is not calm
      charAnimation
        .reset() // reset the animation
        .setEffectiveTimeScale(doubleSpeed ? 2 : 1) // time scale of the animation 2 if double speed is on
        .setEffectiveWeight(1) // weight of the animation
        .setLoop(THREE.LoopRepeat) // loop the animation
        .fadeIn(1) // fade in the animation
        .play();  // play the animation
    else charAnimation.fadeOut(2); // fade out the animation
    gliding = !gliding; // toggle the gliding state

    const randomTime      = Math.floor(Math.random() * (max - min + 1) + min); // random time for the animation
    charAnimationTimeout  = setTimeout(interval, randomTime * 1000); // set the timeout for the animation by 
    
  }

  interval(); // recursive function for the animation
  
}

const setGrass = async () => {

  grassMeshes           = {}; // the grass meshes in the scene in type of instanced mesh 
  const model           = await gltfLoader.loadAsync('assets/grass/scene.gltf'); // loading the grass model
  const grassMeshNames  = [
    {
      varName:  'grassMeshOne',
      meshName: 'Circle015_Grass_0'
    },
    {
      varName:  'grassMeshTwo',
      meshName: 'Circle018_Grass_0'
    } // two types of grass
  ];

  for(let i = 0; i < grassMeshNames.length; i++) {
    const mesh  = model.scene.getObjectByName(grassMeshNames[i].meshName); // getobjectbyname for the grass mesh
    const geo   = mesh.geometry.clone(); // shape
    const mat   = mesh.material.clone(); // material or color
    grassMeshes[grassMeshNames[i].varName] = new THREE.InstancedMesh(geo, mat, Math.floor(amountOfHexInTile / 100)); //for each 40 tile = 1 grass
  }

  return;

}

const setTrees = async () => { // zay el grass 

  treeMeshes          = {};
  const treeMeshNames = [
    {
      varName:    'treeMeshOne',  // pine tree
      modelPath:  'assets/trees/pine/scene.gltf',
      meshName:   'Object_4'
    },
    {
      varName:    'treeMeshTwo', // twisted branches
      modelPath:  'assets/trees/twisted-branches/scene.gltf',
      meshName:   'Tree_winding_01_Material_0'
    }
  ];

  for(let i = 0; i < treeMeshNames.length; i++) {
    const model  = await gltfLoader.loadAsync(treeMeshNames[i].modelPath);
    const mesh  = model.scene.getObjectByName(treeMeshNames[i].meshName);
    const geo   = mesh.geometry.clone();
    const mat   = mesh.material.clone();
    treeMeshes[treeMeshNames[i].varName] = new THREE.InstancedMesh(geo, mat, Math.floor(amountOfHexInTile / 205)); //for each 105 tile = 1 tree
  }

  return;

}

const setCam = () => {

  currentPos    = new THREE.Vector3(); // the current position of the camera
  currentLookAt = new THREE.Vector3(); // the current look at position of the camera
  lookAtPosZ    = -15; // the position of the camera in the z axis
  thirdPerson   = true; 
  doubleSpeed   = false; 

}

const createTile = () => {

  const tileName = JSON.stringify({ // json means stringify the object to a string bec. js cant distinguish by value ,so we string it 
    x: centerTile.xFrom, // the name is the coordinates of the tile from x
    y: centerTile.yFrom // the name is the coordinates of the tile
  });

  if(terrainTiles.some(el => el.name === tileName)) return; // Returns if tile already exists // some like or ,means that one item at least is true // el for element 

  const tileToPosition = (tileX, height, tileY) => {
    return new THREE.Vector3((tileX + (tileY % 2) * 0.5) * 1.68, height / 2, tileY * 1.535);
  }

  const setHexMesh = (geo) => {

    const mat   = new THREE.MeshStandardMaterial();
    const mesh  = new THREE.InstancedMesh(geo, mat, amountOfHexInTile);

    mesh.castShadow     = true;
    mesh.receiveShadow  = true;
  
    return mesh;

  }

  const hexManipulator      = new THREE.Object3D();
  const grassManipulator    = new THREE.Object3D();
  const treeOneManipulator  = new THREE.Object3D();
  const treeTwoManipulator  = new THREE.Object3D();

  const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false);
  const hex = setHexMesh(geo);
  hex.name  = tileName;
  geo.computeBoundsTree();

  const grassOne  = grassMeshes.grassMeshOne.clone();
  grassOne.name   = tileName;
  const grassTwo  = grassMeshes.grassMeshTwo.clone();
  grassTwo.name   = tileName;

  const treeOne = treeMeshes.treeMeshOne.clone();
  treeOne.name  = tileName;
  const treeTwo = treeMeshes.treeMeshTwo.clone();
  treeTwo.name  = tileName;

  terrainTiles.push({
    name:   tileName,
    hex:    hex,
    grass:  [
      grassOne.clone(),
      grassTwo.clone(),
    ],
    trees:  [
      treeOne.clone(),
      treeTwo.clone(),
    ]
  });
  
  let hexCounter      = 0;
  let grassOneCounter = 0;
  let grassTwoCounter = 0;
  let treeOneCounter  = 0;
  let treeTwoCounter  = 0;
  
  for(let i = centerTile.xFrom; i <= centerTile.xTo; i++) {
    for(let j = centerTile.yFrom; j <= centerTile.yTo; j++) {

      let noise1     = (simplex.noise2D(i * 0.015, j * 0.015) + 1.3) * 0.3;
      noise1         = Math.pow(noise1, 1.2);
      let noise2     = (simplex.noise2D(i * 0.015, j * 0.015) + 1) * 0.75;
      noise2         = Math.pow(noise2, 1.2);
      const height   = noise1 * noise2 * maxHeight;

      hexManipulator.scale.y = height >= sandHeight ? height : sandHeight;

      const pos = tileToPosition(i, height >= sandHeight ? height : sandHeight, j);
      hexManipulator.position.set(pos.x, pos.y, pos.z);

      hexManipulator.updateMatrix();
      hex.setMatrixAt(hexCounter, hexManipulator.matrix);

      if(height > snowHeight)               hex.setColorAt(hexCounter, textures.snow);
      else if(height > lightSnowHeight)     hex.setColorAt(hexCounter, textures.lightSnow);
      else if(height > rockHeight)          hex.setColorAt(hexCounter, textures.rock);
      else if(height > forestHeight) {

        hex.setColorAt(hexCounter, textures.forest);
        treeTwoManipulator.scale.set(1.1, 1.2, 1.1);
        treeTwoManipulator.rotation.y = Math.floor(Math.random() * 3);
        treeTwoManipulator.position.set(pos.x, (pos.y * 2) + 5, pos.z);
        treeTwoManipulator.updateMatrix();

        if((Math.floor(Math.random() * 15)) === 0) {
          treeTwo.setMatrixAt(treeTwoCounter, treeTwoManipulator.matrix);
          treeTwoCounter++;
        }

      }
      else if(height > lightForestHeight) {

        hex.setColorAt(hexCounter, textures.lightForest);

        treeOneManipulator.scale.set(0.4, 0.4, 0.4);
        treeOneManipulator.position.set(pos.x, (pos.y * 2), pos.z);
        treeOneManipulator.updateMatrix();

        if((Math.floor(Math.random() * 10)) === 0) {
          treeOne.setMatrixAt(treeOneCounter, treeOneManipulator.matrix);
          treeOneCounter++;
        }

      }
      else if(height > grassHeight) {

        hex.setColorAt(hexCounter, textures.grass);

        grassManipulator.scale.set(0.15, 0.15, 0.15);
        grassManipulator.rotation.x = -(Math.PI / 2);
        grassManipulator.position.set(pos.x, pos.y * 2, pos.z);
        grassManipulator.updateMatrix();

        if((Math.floor(Math.random() * 6)) === 0)
          switch (Math.floor(Math.random() * 2) + 1) {
            case 1:
              grassOne.setMatrixAt(grassOneCounter, grassManipulator.matrix);
              grassOneCounter++;
              break;
            case 2:
              grassTwo.setMatrixAt(grassTwoCounter, grassManipulator.matrix);
              grassTwoCounter++;
              break;
          }

      }
      else if(height > sandHeight)          hex.setColorAt(hexCounter, textures.sand);
      else if(height > shallowWaterHeight)  hex.setColorAt(hexCounter, textures.shallowWater);
      else if(height > waterHeight)         hex.setColorAt(hexCounter, textures.water);
      else if(height > deepWaterHeight)     hex.setColorAt(hexCounter, textures.deepWater);

      hexCounter++;

    }
  }

  scene.add(hex, grassOne, grassTwo, treeOne, treeTwo);

}

const createSurroundingTiles = (newActiveTile) => {

  const setCenterTile = (parsedCoords) => {
    centerTile = {
      xFrom:  parsedCoords.x,
      xTo:    parsedCoords.x + tileWidth,
      yFrom:  parsedCoords.y,
      yTo:    parsedCoords.y + tileWidth
    }
  }

  const parsedCoords = JSON.parse(newActiveTile);

  setCenterTile(parsedCoords);

  tileYNegative();

  tileXPositive();

  tileYPositive();
  tileYPositive();

  tileXNegative();
  tileXNegative();

  tileYNegative();
  tileYNegative();

  setCenterTile(parsedCoords);

  cleanUpTiles();

  activeTile = newActiveTile;

}

const tileYNegative = () => {

  centerTile.yFrom -= tileWidth;
  centerTile.yTo -= tileWidth;
  createTile();

}

const tileYPositive = () => {

  centerTile.yFrom += tileWidth;
  centerTile.yTo += tileWidth;
  createTile();

}

const tileXNegative = () => {

  centerTile.xFrom -= tileWidth;
  centerTile.xTo -= tileWidth;
  createTile();

}

const tileXPositive = () => {

  centerTile.xFrom += tileWidth;
  centerTile.xTo += tileWidth;
  createTile();

}

const cleanUpTiles = () => {

  for(let i = terrainTiles.length - 1; i >= 0; i--) {

    let tileCoords  = JSON.parse(terrainTiles[i].hex.name);
    tileCoords      = {
      xFrom:  tileCoords.x,
      xTo:    tileCoords.x + tileWidth,
      yFrom:  tileCoords.y,
      yTo:    tileCoords.y + tileWidth
    }

    if(
      tileCoords.xFrom < centerTile.xFrom - tileWidth ||
      tileCoords.xTo > centerTile.xTo + tileWidth ||
      tileCoords.yFrom < centerTile.yFrom - tileWidth ||
      tileCoords.yTo > centerTile.yTo + tileWidth
    ) {

      const tile = scene.getObjectsByProperty('name', terrainTiles[i].hex.name);
      for(let o = 0; o < tile.length; o++) cleanUp(tile[o]);

      terrainTiles.splice(i, 1);

    }

  }

}

const resize = () => {

  sizes = {
    width:  container.offsetWidth,
    height: container.offsetHeight
  };

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);

}

const toggleDoubleSpeed = () => {

  if(flyingIn) return;

  doubleSpeed = doubleSpeed ? false : true;
  charRotateYMax = doubleSpeed ? 0.02 : 0.01;
  setCharAnimation();

}

const toggleBirdsEyeView = () => {

  if(flyingIn) return;
  thirdPerson = thirdPerson ? false : true;

}

const keyDown = (event) => {

  if(infoModalDisplayed) return;

  if(!activeKeysPressed.includes(event.keyCode)) 
    activeKeysPressed.push(event.keyCode);
    
}

const keyUp = (event) => {

  if(event.keyCode === 32) toggleInfoModal();
  if(event.keyCode === 88) toggleBirdsEyeView();
  if(event.keyCode === 90) toggleDoubleSpeed();
  if(event.keyCode === 27) updateMusicVolume();

  const index = activeKeysPressed.indexOf(event.keyCode);
  activeKeysPressed.splice(index, 1);

}

const determineMovement = () => {

  character.translateZ(doubleSpeed ? 1.5 : 0.4);

  if(flyingIn) return;

  if(activeKeysPressed.includes(38)) { // up arrow
    if(character.position.y < 90) {
      character.position.y += charPosYIncrement;
      if(charPosYIncrement < 0.3) charPosYIncrement += 0.02;
      if(charNeck.rotation.x > -0.6) charNeck.rotation.x -= 0.06;
      if(charBody.rotation.x > -0.4) charBody.rotation.x -= 0.04;
    }
    else {
      if(charNeck.rotation.x < 0 || charBody.rotation.x < 0) {
        character.position.y += charPosYIncrement;
        charNeck.rotation.x += 0.06;
        charBody.rotation.x += 0.04;
      }
    }
  }
  if(activeKeysPressed.includes(40) && !movingCharDueToDistance) { // down arrow
    if(character.position.y > 27) {
      character.position.y -= charPosYIncrement;
      if(charPosYIncrement < 0.3) charPosYIncrement += 0.02;
      if(charNeck.rotation.x < 0.6) charNeck.rotation.x += 0.06;
      if(charBody.rotation.x < 0.4) charBody.rotation.x += 0.04;
    }
    else {
      if(charNeck.rotation.x > 0 || charBody.rotation.x > 0) {
        character.position.y -= charPosYIncrement;
        charNeck.rotation.x -= 0.06;
        charBody.rotation.x -= 0.04;
      }
    }
  }

  if(activeKeysPressed.includes(37)) { // left arrow
    character.rotateY(charRotateYIncrement);
    if(charRotateYIncrement < charRotateYMax) charRotateYIncrement += 0.0005;
    if(charNeck.rotation.y > -0.7) charNeck.rotation.y -= 0.07;
    if(charBody.rotation.y < 0.4) charBody.rotation.y += 0.04;
  }
  if(activeKeysPressed.includes(39)) { // right arrow
    character.rotateY(-charRotateYIncrement);
    if(charRotateYIncrement < charRotateYMax) charRotateYIncrement += 0.0005;
    if(charNeck.rotation.y < 0.7) charNeck.rotation.y += 0.07;
    if(charBody.rotation.y > -0.4) charBody.rotation.y -= 0.04;
  }

  // Revert

  if(!activeKeysPressed.includes(38) && !activeKeysPressed.includes(40) ||
    activeKeysPressed.includes(38) && activeKeysPressed.includes(40)) {
    if(charPosYIncrement > 0) charPosYIncrement -= 0.02;
    if(charNeck.rotation.x < 0 || charBody.rotation.x < 0) { // reverting from going up
      character.position.y += charPosYIncrement;
      charNeck.rotation.x += 0.06;
      charBody.rotation.x += 0.04;
    }
    if(charNeck.rotation.x > 0 || charBody.rotation.x > 0) { // reverting from going down
      character.position.y -= charPosYIncrement;
      charNeck.rotation.x -= 0.06;
      charBody.rotation.x -= 0.04;
    }
  }

  if(!activeKeysPressed.includes(37) && !activeKeysPressed.includes(39) ||
    activeKeysPressed.includes(37) && activeKeysPressed.includes(39)) {
    if(charRotateYIncrement > 0) charRotateYIncrement -= 0.0005;
    if(charNeck.rotation.y < 0 || charBody.rotation.y > 0) { // reverting from going left
      character.rotateY(charRotateYIncrement);
      charNeck.rotation.y += 0.07;
      charBody.rotation.y -= 0.04;
    }
    if(charNeck.rotation.y > 0 || charBody.rotation.y < 0) { // reverting from going right
      character.rotateY(-charRotateYIncrement);
      charNeck.rotation.y -= 0.07;
      charBody.rotation.y += 0.04;
    }
  }

}

const camUpdate = () => {

  const calcIdealOffset = () => {
    const idealOffset = thirdPerson ? new THREE.Vector3(0, camY, camZ) : new THREE.Vector3(0, 3, 7);
    idealOffset.applyQuaternion(character.quaternion);
    idealOffset.add(character.position);
    return idealOffset;
  }
  
  const calcIdealLookat = () => {
    const idealLookat = thirdPerson ? new THREE.Vector3(0, -1.2, lookAtPosZ) : new THREE.Vector3(0, 0.5, lookAtPosZ + 5);
    idealLookat.applyQuaternion(character.quaternion);
    idealLookat.add(character.position);
    return idealLookat;
  }

  if(!activeKeysPressed.length) {
    if(character.position.y > 60 && lookAtPosZ > 5) lookAtPosZ -= 0.2;
    if(character.position.y <= 60 && lookAtPosZ < 15) lookAtPosZ += 0.2;
  }

  const idealOffset = calcIdealOffset();
  const idealLookat = calcIdealLookat(); 

  currentPos.copy(idealOffset);
  currentLookAt.copy(idealLookat);

  camera.position.lerp(currentPos, 0.14);
  camera.lookAt(currentLookAt);

  if(camY > 7)    camY -= 1.5;
  if(camZ < -10)  camZ += 1.5;
  else {
    if(flyingIn) {
      setCharAnimation();
      cleanUpClouds(); // This statement is called once when the fly in animation is compelte
    }
  }

}

const calcCharPos = () => {

  raycaster.set(character.position, new THREE.Vector3(0, -1, -0.1));

  const intersects = raycaster.intersectObjects(terrainTiles.map(el => el.hex));

  if(activeTile !== intersects[0].object.name) createSurroundingTiles(intersects[0].object.name);

  if (intersects[0].distance < distance) {
    movingCharDueToDistance = true;
    character.position.y += doubleSpeed ? 0.3 : 0.1;
  }
  else {
    if(movingCharDueToDistance && !movingCharTimeout) {
      movingCharTimeout = setTimeout(() => {
        movingCharDueToDistance = false;
        movingCharTimeout = undefined;
      }, 600);
    }
  }

  camUpdate();
  
}

const listenTo = () => {

  window.addEventListener('resize', resize.bind(this));
  window.addEventListener('keydown', keyDown.bind(this));
  window.addEventListener('keyup', keyUp.bind(this));
  document.querySelector('.hex-music')
    .addEventListener('click', () => updateMusicVolume());
  document.querySelector('.hex-info')
    .addEventListener('click', () => toggleInfoModal());
  document.querySelector('.info-close')
    .addEventListener('click', () => toggleInfoModal(false));
  document.querySelector('.hex-speed')
    .addEventListener('click', () => toggleDoubleSpeed());
  document.querySelector('.hex-birds-eye')
    .addEventListener('click', () => toggleBirdsEyeView());

}

const cleanUp = (obj) => {

  if(obj.geometry && obj.material) {
    obj.geometry.dispose();
    obj.material.dispose();
  }
  else {
    obj.traverse(el => {
      if(el.isMesh) {
        el.geometry.dispose();
        el.material.dispose();
      }
    });
  }

  scene.remove(obj);
  renderer.renderLists.dispose();

}
let score = 0;
let coins = [];

const setCoins = () => {
  const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.15, 16); //top radius,bottom radius, height, segments
  const coinMat = new THREE.MeshStandardMaterial({
    color:     0xffd700,
    metalness: 0.5,
    roughness: 0.1
  });

  for (let i = 0; i < 12; i++) {
    const coin = new THREE.Mesh(coinGeo, coinMat);
    coin.rotation.x = Math.PI / 2;
    coin.position.set(
      character.position.x + Math.random() * 30 - 15,
      25 + Math.random() * 5 - 2,
      character.position.z + Math.random() * 50 + 30 
      
    );
    
    scene.add(coin);
    coins.push(coin);
  
  
  }
};

const updateCoins = () => {
  coins = coins.filter(coin => {
    if (coin.position.z < character.position.z - 20) {
      scene.remove(coin);
      return false;
    }
    return true;
  });

  if (coins.length < 20) {
    const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.15, 16); //top radius,bottom radius, height, segments
    const coinMat = new THREE.MeshStandardMaterial({
      color:     0xffd700,
      metalness: 0.1,
      roughness: 0.3
    });

    for (let i = 0; i < 10; i++) {
      const coin = new THREE.Mesh(coinGeo, coinMat);
      coin.rotation.x = Math.PI / 2;
      coin.position.set(
        character.position.x + Math.random() * 300 - 15,
        25 + Math.random() * 50 - 2,
        character.position.z + Math.random() * 100 + 50 
      );
      scene.add(coin);
      coins.push(coin);
    }
  }
};

let level       = 1;
let levelProg   = 0;
const fillEl    = document.getElementById('level-fill');
const levelText = document.getElementById('level-text');

function advanceLevel(amountPercent) {
  levelProg = Math.min(levelProg + amountPercent, 100);
  fillEl.style.width = levelProg + '%';
  if (levelProg >= 100) {
    level++;
    levelText.innerText = 'Level ' + level;
    levelProg = 0;
    fillEl.style.width = '0%';
    showLevelUpAnimation(); // ← هنا

  }
}

const showLevelUpAnimation = () => {
  const el = document.getElementById('level-up');
  el.style.opacity = '1';
  el.style.transform = 'translate(-50%, -50%) scale(1.2)';

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 1500);
};

const checkCoinCollision = () => {
  coins = coins.filter(coin => {
    const distance = character.position.distanceTo(coin.position);
    if (distance < 10) {
      scene.remove(coin);
      score++;
      advanceLevel(10); // Increase level progress by 10% for each coin collected
      coinsCollected++;
      updateTasks();
      document.getElementById('score').innerText = 'Score: ' + score;
      if (score >= 10 && !doubleSpeed) {
        doubleSpeed = true;              // flip into “fast” mode
        charRotateYMax = 0.02;           // match your fast-turn setting
        setCharAnimation();              // restart the wing-flap at new speed
      }
      return false; 
    }
    return true;
  });
};

let rings = [];
const setRings = () => {
  const ringGeo = new THREE.TorusGeometry(8, 0.2, 16, 100);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x00ffff, 
    emissive: 0x007777,
    metalness: 0.1,
    roughness: 0.1
  });

  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.z = Math.PI / 2;
    ring.position.set(
      character.position.x + Math.random() * 300 - 25,
      30 + Math.random() * 15,
      character.position.z + Math.random() * 150 + 100
    );
    ring.name = 'ring';
    scene.add(ring);
    rings.push(ring);
  }
};

const checkRingPass = () => {
  rings = rings.filter(ring => {
    const distance = character.position.distanceTo(ring.position);
    if (distance < 15) {
      scene.remove(ring);
      score += 9;
      advanceLevel(90); // Increase level progress by 90% for each coin collected
      ringsPassed++;
      updateTasks();


      doubleSpeed = true;              // flip into “fast” mode
      document.getElementById('score').innerText = 'Score: ' + score;

      return false;
    }
    if (ring.position.z < character.position.z - 20) {
      scene.remove(ring);
      return false;
    }
    return true;
  });

  if (rings.length < 3) setRings();
};

let coinsCollected = 0;
let ringsPassed = 0;

const updateTasks = () => {
  if (coinsCollected >= 13) {
    document.getElementById('coinTask').classList.add('completed');
  }
  if (ringsPassed >= 3) {
    document.getElementById('ringTask').classList.add('completed');
  }
};

const render = () => {
  if (loadingDismissed) {
    determineMovement();
    calcCharPos();
    checkCoinCollision(); 
    updateCoins();    
    if (flyingIn) animateClouds();
    if (mixer) mixer.update(clock.getDelta());
  }

  checkRingPass();
  renderer.render(scene, camera);
  requestAnimationFrame(render.bind(this))
  
  
}

const playMusic = () => {

  bgMusic = new Howl({
    src: ['assets/sound/bg-music.mp3'],
    autoplay: true,
    loop: true,
    volume: 0,
  });

  bgMusic.play();

}

const updateMusicVolume = () => {
  
  muteBgMusic = !muteBgMusic;
  bgMusic.volume(muteBgMusic ? 0 : 1);

  document.getElementById('sound').src = 
    muteBgMusic ? 
    'assets/icons/sound-off.svg' :
    'assets/icons/sound-on.svg'

};

const pauseIconAnimation = (pause = true) => {

  if(pause) {
    document.querySelector('.hex-music').classList.add('js-loading');
    document.querySelector('.hex-info').classList.add('js-loading');
    document.querySelector('.hex-speed').classList.add('js-loading');
    document.querySelector('.hex-birds-eye').classList.add('js-loading');
    return;
  }

  document.querySelector('.hex-music').classList.remove('js-loading');
  document.querySelector('.hex-info').classList.remove('js-loading');
  document.querySelector('.hex-speed').classList.remove('js-loading');
  document.querySelector('.hex-birds-eye').classList.remove('js-loading');

}

const toggleInfoModal = (display = true) => {

  infoModalDisplayed = display;

  if(display) return gsap.timeline()
    .to('.info-modal-page', {
      zIndex: 100
    })
    .to('.info-modal-page', {
      opacity:  1,
      duration: 0.5
    })
    .to('.info-box', {
      opacity:  1,
      duration: 0.5
    })

  gsap.timeline()
    .to('.info-box', {
      opacity:  0,
      duration: 0.5
    })
    .to('.info-modal-page', {
      opacity:  0,
      duration: 0.5
    })
    .to('.info-modal-page', {
      zIndex: -1
    })

}

const checkLoadingPage = () => {

  let loadingCounter  = 0;
  loadingDismissed    = false;

  const checkAssets = () => {

    let allAssetsLoaded = true;

    if(!scene)                                  allAssetsLoaded = false;
    if(!clouds.length === 2)                    allAssetsLoaded = false;
    if(!character)                              allAssetsLoaded = false;
    if(!Object.keys(grassMeshes).length === 2)  allAssetsLoaded = false;
    if(!Object.keys(treeMeshes).length === 2)   allAssetsLoaded = false;
    if(!activeTile)                             allAssetsLoaded = false;
    if(loadingCounter < 6)                      allAssetsLoaded = false;
    if(loadingCounter > 50)                     allAssetsLoaded = true;
    if(allAssetsLoaded)                         return dismissLoading();
    loadingCounter++;
    setTimeout(checkAssets, 50);

  }


  const dismissLoading = () => {

    gsap.timeline()
      .to('.loader-container', {
        opacity:  0,
        duration: 0.6
      })
      .to('.page-loader', {
        opacity:  0,
        duration: 0.6
      })
      .to('.page-loader', {
        display: 'none'
      })
      .then(() => {
        loadingDismissed = true;
        pauseIconAnimation(false);
      });
    
  }
  

  checkAssets();

}


setScene();