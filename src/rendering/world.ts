import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { EquiRectangularCubeTexture } from '@babylonjs/core/Materials/Textures/equiRectangularCubeTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_emissive_strength';
import { CHECKPOINTS, clamp, type Vehicle, type Collider, angleDelta } from '../game/simulation';
export interface WorldData { colliders:Collider[]; roads:number[]; bounds:number }
export interface RenderCar { root:TransformNode; wheels:TransformNode[]; wheelBase:Map<TransformNode,Quaternion>; body:AbstractMesh[]; spin:number }
export interface Npc { car:RenderCar; x:number; z:number; yaw:number; speed:number; police:boolean; waypoint:number; route:{x:number;z:number}[]; repath:number }
export class GameWorld {
  engine:Engine;scene:Scene;camera:FreeCamera;vehicle?:RenderCar; cityMeshes:AbstractMesh[]=[];
  data:WorldData={colliders:[],roads:[],bounds:208}; npcs:Npc[]=[]; gates:TransformNode[]=[];
  sun:DirectionalLight;shadows:ShadowGenerator;glow:GlowLayer;quality='high';cameraShake=0;
  skidTimer=0; skidCursor=0;skids:Mesh[]=[]; private cameraReady=false; private time=0; private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  stats={fps:0,meshes:0,triangles:0};
  constructor(public canvas:HTMLCanvasElement){
    this.engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true,powerPreference:'high-performance'},true);
    this.engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio,1.5));
    this.scene=new Scene(this.engine);this.scene.useRightHandedSystem=true;
    this.scene.clearColor=new Color4(.075,.085,.145,1);this.scene.fogMode=Scene.FOGMODE_EXP2;this.scene.fogDensity=.0018;this.scene.fogColor=new Color3(.17,.19,.29);
    this.scene.environmentIntensity=1.1;
    this.scene.imageProcessingConfiguration.toneMappingEnabled=true;
    this.scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.scene.imageProcessingConfiguration.exposure=1.25;this.scene.imageProcessingConfiguration.contrast=1.1;
    this.camera=new FreeCamera('chase-camera',new Vector3(4,4,166),this.scene);this.camera.minZ=.15;this.camera.maxZ=1300;this.camera.fov=.92;this.camera.setTarget(new Vector3(4,1,140));
    const ambient=new HemisphericLight('twilight-ambient',new Vector3(0,1,0),this.scene);ambient.diffuse=new Color3(.64,.72,1);ambient.groundColor=new Color3(.10,.13,.18);ambient.intensity=1.0;
    this.sun=new DirectionalLight('sunset-key',new Vector3(-.65,-.7,-.3),this.scene);this.sun.diffuse=new Color3(1,.68,.42);this.sun.intensity=1.9;this.sun.position=new Vector3(50,90,20);
    this.sun.shadowMinZ=1;this.sun.shadowMaxZ=230;
    this.shadows=new ShadowGenerator(1024,this.sun);this.shadows.useBlurExponentialShadowMap=true;this.shadows.blurKernel=16;this.shadows.darkness=.5;
    this.glow=new GlowLayer('neon-glow',this.scene,{blurKernelSize:32,mainTextureRatio:.5});this.glow.intensity=.38;
    window.addEventListener('resize',()=>this.engine.resize());
  }
  async load(progress:(text:string)=>void){
    progress('載入 Blender 城市模型…');
    const base=import.meta.env.BASE_URL+'assets/';
    const response=await fetch(base+'world.json');if(!response.ok)throw new Error('World metadata unavailable');this.data=await response.json();
    // Imported Blender geometry preserves its right-handed coordinate system.
    const city=await SceneLoader.ImportMeshAsync('',base,'harbor-city.glb',this.scene);
    this.cityMeshes=city.meshes;
    for(const mesh of city.meshes){mesh.isPickable=false;mesh.receiveShadows=true;mesh.freezeWorldMatrix();}
    for(const mat of this.scene.materials){
      if(mat instanceof PBRMaterial){
        if(mat.name.startsWith('Asphalt')){mat.roughness=.72;mat.metallic=.06;}
        mat.maxSimultaneousLights=2;
        if(mat.name.startsWith('Harbor water')){mat.roughness=.16;mat.metallic=.6;}
      }
    }
    progress('組裝跑車與街道車流…');
    const hero=await SceneLoader.LoadAssetContainerAsync(base,'raven-coupe.glb',this.scene);
    hero.addAllToScene();
    // Instanced cars share geometry and materials rather than downloading per car.
    const loops=[[-90,-90],[-90,90],[90,90],[90,-90]].map(([x,z])=>({x,z}));
    for(let i=0;i<7;i++){
      const instance=hero.instantiateModelsToScene(name=>`traffic-${i}-${name}`,false,{doNotInstantiate:false});
      const car=this.wrapCar(instance.rootNodes as TransformNode[],`traffic-root-${i}`);
      const route=i%2?loops.slice().reverse():loops;const wp=i%4;const p=route[wp];
      this.npcs.push({car,x:p.x+(i%2?-4:4),z:p.z+(i*16)%45,yaw:0,speed:8+i*.65,police:false,waypoint:(wp+1)%4,route,repath:0});
    }
    this.vehicle=this.wrapCar(hero.rootNodes as TransformNode[],'raven-player');
    for(const m of this.vehicle.body)if(m.getTotalVertices()>0)this.shadows.addShadowCaster(m,false);
    const police=await SceneLoader.LoadAssetContainerAsync(base,'pursuit-coupe.glb',this.scene);
    for(let i=0;i<2;i++){
      const instance=police.instantiateModelsToScene(name=>`police-${i}-${name}`,false,{doNotInstantiate:false});
      const car=this.wrapCar(instance.rootNodes as TransformNode[],`police-root-${i}`);car.root.setEnabled(false);
      this.npcs.push({car,x:i?-4:4,z:195,yaw:0,speed:0,police:true,waypoint:0,route:[],repath:0});
    }
    for(const mat of this.scene.materials)if(mat instanceof PBRMaterial){if(mat.name.startsWith('Rear LED')){mat.emissiveColor=new Color3(1,.002,.001);mat.emissiveIntensity=2;}if(mat.name.startsWith('Pearl silver'))mat.roughness=.3;}
    progress('設定導航、暮色與反射…');
    const gate=await SceneLoader.LoadAssetContainerAsync(base,'navigation-gate.glb',this.scene);
    CHECKPOINTS.forEach((c,i)=>{
      const inst=gate.instantiateModelsToScene(name=>`gate-${i}-${name}`,false,{doNotInstantiate:false});const root=new TransformNode(`checkpoint-${i}`,this.scene);
      inst.rootNodes.forEach(n=>n.parent=root);root.position.set(c.x,0,c.z);
      const prev=i?CHECKPOINTS[i-1]:{x:184,z:155};const dx=c.x-prev.x,dz=c.z-prev.z;
      root.rotation.y=Math.abs(dx)>Math.abs(dz)?Math.PI/2:0;this.gates.push(root);
    });
    const env=new EquiRectangularCubeTexture(base+'twilight-sky.jpg',this.scene,256,false,true);
    this.scene.environmentTexture=env;
    const sky=MeshBuilder.CreateBox('twilight-sky',{size:1800},this.scene);
    const skyMat=new PBRMaterial('sky',this.scene);skyMat.backFaceCulling=false;skyMat.reflectionTexture=env.clone();skyMat.reflectionTexture.coordinatesMode=Texture.SKYBOX_MODE;skyMat.microSurface=1;skyMat.disableLighting=true;skyMat.twoSidedLighting=true;sky.material=skyMat;sky.isPickable=false;sky.infiniteDistance=true;sky.applyFog=false;this.glow.addExcludedMesh(sky);
    // Cheap warm pools under the waterfront lamps; geometric lights remain authored in Blender.
    const poolTexture=new DynamicTexture('soft-light',128,this.scene,false);const ctx=poolTexture.getContext();const grad=ctx.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,'rgba(255,255,255,.7)');grad.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);poolTexture.update();
    const poolMat=new StandardMaterial('warm-light-pool',this.scene);poolMat.diffuseTexture=poolTexture;poolMat.diffuseTexture.hasAlpha=true;poolMat.emissiveColor=new Color3(.65,.35,.14);poolMat.disableLighting=true;poolMat.alpha=.22;poolMat.backFaceCulling=false;poolMat.useAlphaFromDiffuseTexture=true;
    for(let z=-200;z<=200;z+=24){const pool=MeshBuilder.CreateGround('promenade-light-pool',{width:6,height:9},this.scene);pool.position.set(209,.04,z);pool.material=poolMat;pool.isPickable=false;pool.freezeWorldMatrix();}
    const skidMat=new StandardMaterial('tire-marks',this.scene);skidMat.diffuseColor=new Color3(.012,.014,.019);skidMat.specularColor=Color3.Black();skidMat.alpha=.65;
    for(let i=0;i<72;i++){const skid=MeshBuilder.CreateGround('skid-'+i,{width:.27,height:1.3},this.scene);skid.material=skidMat;skid.setEnabled(false);skid.isPickable=false;this.skids.push(skid);}
    this.scene.skipPointerMovePicking=true;this.scene.autoClear=true;
    await this.scene.whenReadyAsync();
    this.stats.meshes=this.scene.meshes.length;this.stats.triangles=this.scene.getTotalVertices()/3;
    progress('城市已就緒');
  }
  wrapCar(nodes:TransformNode[],name:string):RenderCar{
    const root=new TransformNode(name,this.scene);nodes.forEach(n=>n.parent=root);
    const wheels=root.getChildTransformNodes().filter(n=>/Wheel_(FL|FR|RL|RR)/.test(n.name));
    const base=new Map(wheels.map(n=>[n,(n.rotationQuaternion??Quaternion.FromEulerVector(n.rotation)).clone()]));
    const body=root.getChildMeshes();for(const m of body){m.isPickable=false;if(m instanceof Mesh)m.receiveShadows=true;}
    return {root,wheels,wheelBase:base,body,spin:0};
  }
  setQuality(quality:string){
    this.quality=quality;this.engine.setHardwareScalingLevel(quality==='low'?Math.max(1,devicePixelRatio):1/Math.min(devicePixelRatio,1.5));
    this.glow.isEnabled=quality==='high';this.shadows.getShadowMap()!.renderList=quality==='high'?this.vehicle?.body??[]:[];
    this.scene.fogDensity=quality==='low'?.0026:.0018;
  }
  renderCar(car:RenderCar,x:number,z:number,yaw:number,speed:number,steer:number,dt:number,lean=0){
    car.root.position.set(x,.035,z);car.root.rotation.set(0,Math.PI-yaw,lean);car.spin+=speed*dt/.46;
    for(const wheel of car.wheels){const front=/Wheel_F/.test(wheel.name);wheel.rotationQuaternion=car.wheelBase.get(wheel)!.multiply(Quaternion.RotationAxis(Vector3.Up(),front?-steer*.38:0)).multiply(Quaternion.RotationAxis(Vector3.Right(),car.spin));}
  }
  render(v:Vehicle,dt:number,index:number,active:boolean,preview=false){
    this.time+=dt;
    this.renderCar(this.vehicle!,v.x,v.z,v.yaw,v.speed,v.steer,dt,clamp(-v.steer*v.speed*.0013,-.04,.04));
    this.gates.forEach((g,i)=>{g.setEnabled(i===index&&index<CHECKPOINTS.length);});
    const forward=new Vector3(Math.sin(v.yaw),0,-Math.cos(v.yaw));
    const desired=preview?new Vector3(v.x-8,4.2,v.z+9.5):new Vector3(v.x-forward.x*(10+v.speed*.045),3.8+v.speed*.013,v.z-forward.z*(10+v.speed*.045));
    if(!this.cameraReady){this.camera.position.copyFrom(desired);this.cameraReady=true;}
    this.camera.position=Vector3.Lerp(this.camera.position,desired,1-Math.exp(-dt*(preview?2:6)));
    const target=preview?new Vector3(v.x+1,1.25,v.z-7):new Vector3(v.x+forward.x*9,1.25,v.z+forward.z*9);
    if(this.cameraShake>0&&!this.reduced){this.camera.position.x+=(Math.random()-.5)*this.cameraShake;this.camera.position.y+=(Math.random()-.5)*this.cameraShake*.4;this.cameraShake*=Math.exp(-dt*12);}
    this.camera.setTarget(target);this.camera.fov+=((.92+(v.boosting&&!this.reduced?.12:0))-this.camera.fov)*Math.min(1,dt*4);
    this.sun.position.set(v.x+65,85,v.z+40);
    if(active&&v.drifting){
      this.skidTimer+=dt;if(this.skidTimer>.05){this.skidTimer=0;for(const side of [-1,1]){const skid=this.skids[this.skidCursor++%this.skids.length];skid.setEnabled(true);skid.position.set(v.x+Math.cos(v.yaw)*side-v.vx*.04,.038,v.z+Math.sin(v.yaw)*side-v.vz*.04);skid.rotation.y=-v.yaw;}}
    }
    this.scene.render();this.stats.fps=this.engine.getFps();
  }
  resetNpcs(){
    for(const n of this.npcs)if(n.police){n.x=n.car.root.name.includes('1')?-4:4;n.z=195;n.yaw=0;n.speed=0;n.route=[];n.waypoint=0;n.repath=0;n.car.root.setEnabled(false);}
    for(const skid of this.skids)skid.setEnabled(false);
    this.cameraReady=false;
  }
  policeRoute(n:Npc,v:Vehicle){
    const roads=this.data.roads,snap=(a:number)=>roads.reduce((best,p)=>Math.abs(p-a)<Math.abs(best-a)?p:best,roads[0]);
    const sx=snap(n.x),sz=snap(n.z),tx=snap(v.x),tz=snap(v.z);
    if(Math.abs(n.x-sx)<12&&Math.abs(v.x-sx)<12)return [{x:sx,z:v.z}];
    if(Math.abs(n.z-sz)<12&&Math.abs(v.z-sz)<12)return [{x:v.x,z:sz}];
    const route=[{x:sx,z:sz}];let x=sx,z=sz;
    while(x!==tx||z!==tz){if(z!==tz)z+=Math.sign(tz-z)*90;else x+=Math.sign(tx-x)*90;route.push({x,z});}
    route.push({x:v.x,z:v.z});if(Math.hypot(n.x-sx,n.z-sz)<22)route.shift();return route;
  }
  updateNpcs(v:Vehicle,dt:number,elapsed:number,active:boolean,onCollision:()=>void){
    for(const n of this.npcs){
      if(n.police){
        if(!active||elapsed<18){n.car.root.setEnabled(false);continue;}
        n.car.root.setEnabled(true);n.repath-=dt;
        if(n.repath<=0||!n.route.length){n.route=this.policeRoute(n,v);n.waypoint=0;n.repath=2.8;}
        n.speed+=((14+Math.min(elapsed/45,6))-n.speed)*dt;
      }
      const target=n.route[n.waypoint%n.route.length];if(!target)continue;
      const dx=target.x-n.x,dz=target.z-n.z;
      if(Math.hypot(dx,dz)<9){n.waypoint++;if(n.police&&n.waypoint>=n.route.length){n.route=this.policeRoute(n,v);n.waypoint=0;}}
      const targetYaw=Math.atan2(dx,-dz),turn=angleDelta(targetYaw,n.yaw);
      n.yaw+=clamp(turn,-dt*1.7,dt*1.7);const speed=n.speed*(1-Math.min(.65,Math.abs(turn)*.25));n.x+=Math.sin(n.yaw)*speed*dt;n.z-=Math.cos(n.yaw)*speed*dt;
      this.renderCar(n.car,n.x,n.z,n.yaw,speed,turn*.5,dt);
      if(active&&Math.hypot(v.x-n.x,v.z-n.z)<3.1){
        const deltaX=v.x-n.x,deltaZ=v.z-n.z,len=Math.hypot(deltaX,deltaZ)||1;
        v.x+=deltaX/len*.3;v.z+=deltaZ/len*.3;v.vx+=deltaX/len*2;v.vz+=deltaZ/len*2;onCollision();
      }
    }
  }
}
