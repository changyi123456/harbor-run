import { type Input, clamp } from '../game/simulation.ts';
export type ControlsPacket={ type:'input'; sequence:number; input:Input };
/** Treat network input as untrusted; never allow NaN to enter vehicle state. */
export function readInputPacket(data:unknown,previousSequence:number):ControlsPacket|null{
  if(!data||typeof data!=='object')return null;
  const p=data as Record<string,unknown>;if(p.type!=='input'||typeof p.sequence!=='number'||!Number.isSafeInteger(p.sequence)||p.sequence<=previousSequence)return null;
  if(!p.input||typeof p.input!=='object')return null;
  const i=p.input as Record<string,unknown>;
  if(!['steer','throttle','brake'].every(k=>typeof i[k]==='number'&&Number.isFinite(i[k])))return null;
  if(typeof i.handbrake!=='boolean'||typeof i.nitro!=='boolean')return null;
  return {type:'input',sequence:p.sequence,input:{steer:clamp(i.steer as number,-1,1),throttle:clamp(i.throttle as number,-1,1),brake:clamp(i.brake as number,0,1),handbrake:i.handbrake,nitro:i.nitro}};
}
export function gravityTilt(x:number,y:number,screenAngle:number){
  const a=screenAngle*Math.PI/180;
  // Screen orientation is counter-clockwise from the device's natural frame.
  // Keep the signed vertical component: taking abs() reverses devices that
  // report gravity with the opposite polarity. Relative angles handle both.
  const across=x*Math.cos(a)-y*Math.sin(a);
  const upward=x*Math.sin(a)+y*Math.cos(a);
  return wrapDegrees(-Math.atan2(across,upward)*180/Math.PI);
}
export function wrapDegrees(angle:number){return ((angle+180)%360+360)%360-180;}
export function relativeTilt(angle:number,baseline:number){return wrapDegrees(angle-baseline);}
export function orientationGravity(beta:number,gamma:number){
  const b=beta*Math.PI/180,g=gamma*Math.PI/180;
  return {x:-Math.sin(g)*Math.cos(b)*9.8,y:Math.sin(b)*9.8};
}
export function orientationTilt(beta:number,gamma:number,screenAngle:number){
  const v=orientationGravity(beta,gamma);
  return gravityTilt(v.x,v.y,screenAngle);
}
