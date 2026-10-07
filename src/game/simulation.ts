/** Fixed-step arcade bicycle model. Domain state is independent of Babylon. */
export interface Input { steer: number; throttle: number; brake: number; handbrake: boolean; nitro: boolean }
export const ZERO_INPUT: Input = { steer: 0, throttle: 0, brake: 0, handbrake: false, nitro: false };
export interface Collider { x: number; z: number; hx: number; hz: number }
export interface Vehicle { x: number; z: number; yaw: number; vx: number; vz: number; speed: number; steer: number; health: number; nitro: number; drifting: boolean; boosting: boolean; distance: number }
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(a-b), Math.cos(a-b));
export const createVehicle = (): Vehicle => ({x:184,z:155,yaw:0,vx:0,vz:0,speed:0,steer:0,health:100,nitro:100,drifting:false,boosting:false,distance:0});
export function stepVehicle(v: Vehicle, input: Input, dt: number, colliders: Collider[], onHit?: (force: number) => void) {
  dt=clamp(dt,0,1/30);
  v.steer += (clamp(input.steer,-1,1)-v.steer) * Math.min(1,dt*8);
  let fx=Math.sin(v.yaw), fz=-Math.cos(v.yaw), rx=Math.cos(v.yaw), rz=Math.sin(v.yaw);
  let forward=v.vx*fx+v.vz*fz, lateral=v.vx*rx+v.vz*rz;
  const throttle=clamp(input.throttle,-1,1), brake=clamp(input.brake,0,1);
  v.boosting=input.nitro && throttle>0 && brake<.1 && v.nitro>1 && forward>2;
  const accel=throttle*(throttle>=0?12:8)+(v.boosting?15:0);
  forward+=accel*dt;
  const resistance=(.9+.0055*forward*forward)+(input.handbrake?5:0)+brake*24;
  forward-=Math.sign(forward)*Math.min(Math.abs(forward),resistance*dt);
  forward=clamp(forward,-11,v.boosting?58:43);
  v.yaw+=v.steer * forward / 3.1 * Math.tan(.43) * dt * (input.handbrake?1.35:1) / (1+Math.abs(forward)*.055);
  const nfx=Math.sin(v.yaw), nfz=-Math.cos(v.yaw), nrx=Math.cos(v.yaw), nrz=Math.sin(v.yaw);
  // Express inertia in the new car frame, then apply lateral tire grip.
  const oldvx=fx*forward+rx*lateral, oldvz=fz*forward+rz*lateral;
  forward=oldvx*nfx+oldvz*nfz; lateral=oldvx*nrx+oldvz*nrz;
  lateral*=Math.exp(-(input.handbrake?1.2:9)*dt);
  v.vx=nfx*forward+nrx*lateral; v.vz=nfz*forward+nrz*lateral;
  v.x+=v.vx*dt; v.z+=v.vz*dt;
  const radius=1.25;
  for(const b of colliders) {
    if(Math.abs(v.x-b.x)>b.hx+radius || Math.abs(v.z-b.z)>b.hz+radius)continue;
    const dx=v.x-clamp(v.x,b.x-b.hx,b.x+b.hx), dz=v.z-clamp(v.z,b.z-b.hz,b.z+b.hz);
    const len=Math.hypot(dx,dz);
    if(len>=radius)continue;
    let nx=dx/(len||1), nz=dz/(len||1), depth=radius-len;
    if(len<.001) {
      const px=b.hx-Math.abs(v.x-b.x), pz=b.hz-Math.abs(v.z-b.z);
      if(px<pz){nx=v.x>=b.x?1:-1;nz=0;depth=radius+px;}
      else{nx=0;nz=v.z>=b.z?1:-1;depth=radius+pz;}
    }
    v.x+=nx*depth;v.z+=nz*depth;
    const impact=-(v.vx*nx+v.vz*nz);
    if(impact>0){v.vx+=nx*impact*1.30;v.vz+=nz*impact*1.30;v.health=clamp(v.health-Math.max(0,impact-3)*.72,0,100);if(impact>3)onHit?.(impact);}
  }
  for(const axis of ['x','z'] as const) {
    if(Math.abs(v[axis])>206){const sign=Math.sign(v[axis]);v[axis]=sign*206;const key=axis==='x'?'vx':'vz';const impact=Math.abs(v[key]);v[key]*=-.25;v.health=clamp(v.health-Math.max(0,impact-3)*.5,0,100);if(impact>3)onHit?.(impact);}
  }
  v.speed=Math.hypot(v.vx,v.vz);v.distance+=v.speed*dt;v.drifting=v.speed>7&&Math.abs(lateral)>2;
  v.nitro=clamp(v.nitro+(v.boosting?-24:(v.drifting?11:5))*dt,0,100);
}
export const CHECKPOINTS=[
  {x:184,z:76,label:'濱海大道'}, {x:184,z:-82,label:'海港夜市'},
  {x:84,z:-94,label:'東城轉角'}, {x:94,z:-4,label:'海風廣場'},
  {x:94,z:84,label:'濱海大道'}, {x:174,z:94,label:'港灣入口'},
  {x:184,z:163,label:'港區直線'}, {x:203,z:185,label:'碼頭終點'},
];
export type Phase='guide'|'playing'|'paused'|'won'|'lost'|'free';
export class Mission {
  phase:Phase='guide'; index=0; time=180; elapsed=0; hits=0; best=0; checkpoints=CHECKPOINTS;
  start(free=false){this.phase=free?'free':'playing';this.index=0;this.time=180;this.elapsed=0;this.hits=0;}
  update(v:Vehicle,dt:number){
    if(this.phase==='free'){this.elapsed+=dt;return false;}
    if(this.phase!=='playing')return false;
    this.time=Math.max(0,this.time-dt);this.elapsed+=dt;
    const target=this.checkpoints[this.index]; let passed=false;
    if(target && Math.hypot(v.x-target.x,v.z-target.z)<12){this.index++;passed=true;if(this.index===this.checkpoints.length){this.phase='won';}}
    if(this.phase==='playing'&&(this.time<=0||v.health<=0))this.phase='lost';
    return passed;
  }
}
