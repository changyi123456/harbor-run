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
  const across=x*Math.cos(a)+y*Math.sin(a);
  const upward=-x*Math.sin(a)+y*Math.cos(a);
  return Math.atan2(across,Math.max(1,Math.abs(upward)))*180/Math.PI;
}
export function orientationTilt(beta:number,gamma:number,screenAngle:number){
  const b=beta*Math.PI/180,g=gamma*Math.PI/180;
  return gravityTilt(-Math.sin(g)*Math.cos(b)*9.8,Math.sin(b)*9.8,screenAngle);
}
