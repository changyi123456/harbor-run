import { clamp } from '../game/simulation.ts';
import { gravityTilt, relativeTilt } from './protocol.ts';

type SensorSource='motion'|'orientation';
export type CalibrationPhase='idle'|'awaiting-confirmation'|'collecting'|'ready'|'no-data'|'moving'|'flat'|'stale'|'orientation-changed'|'source-changed';
export interface SteeringReading { steer:number;tilt:number;phase:CalibrationPhase;progress:number }

/** Calibration consumes fresh sensor events, rather than a delayed snapshot. */
export class MotionSteering {
  phase:CalibrationPhase='idle';calibrated=false;source:SensorSource|null=null;
  private angle=0;private baseline=0;private filtered=0;private planeStrength=0;
  private lastSample=-Infinity;private screenAngle:number|undefined;
  private started:number|null=null;private samples:{angle:number;at:number}[]=[];
  private issue:CalibrationPhase='no-data';

  requestCalibration(now:number){
    this.started=now;this.samples=[];this.filtered=0;this.calibrated=false;
    this.issue='no-data';this.phase='collecting';
  }
  invalidate(reason:CalibrationPhase='orientation-changed'){
    this.started=null;this.samples=[];this.calibrated=false;this.filtered=0;this.phase=reason;
  }
  receive(x:number,y:number,screenAngle:number,source:SensorSource,now:number){
    if(![x,y,screenAngle,now].every(Number.isFinite))return;
    const changed=this.screenAngle!==undefined&&this.screenAngle!==screenAngle;
    const switched=this.source!==null&&this.source!==source;
    if(changed||switched){
      if(this.started!==null)this.samples=[];
      else if(this.calibrated)this.invalidate(changed?'orientation-changed':'source-changed');
    }
    if(this.started!==null&&now-this.lastSample>250)this.samples=[];
    this.screenAngle=screenAngle;this.source=source;this.lastSample=now;
    this.planeStrength=Math.hypot(x,y);
    if(this.planeStrength<2){this.samples=[];this.issue='flat';return;}
    this.angle=gravityTilt(x,y,screenAngle);
    if(this.started===null)return;
    if(now-this.started>5000){this.phase=this.issue;this.started=null;return;}
    if(this.samples.length&&Math.abs(relativeTilt(this.angle,this.samples[0].angle))>3){
      this.samples=[];this.issue='moving';
    }
    this.samples.push({angle:this.angle,at:now});
    if(this.samples.length<6||now-this.samples[0].at<600)return;
    // A circular mean preserves a valid neutral pose around -180/+180.
    let sin=0,cos=0;
    for(const sample of this.samples){sin+=Math.sin(sample.angle*Math.PI/180);cos+=Math.cos(sample.angle*Math.PI/180);}
    this.baseline=Math.atan2(sin,cos)*180/Math.PI;
    this.started=null;this.samples=[];this.filtered=0;this.calibrated=true;this.phase='ready';
  }
  read(now:number,sensitivity:number,inverted=false):SteeringReading{
    if(this.started!==null&&now-this.started>=5000){this.started=null;this.phase=this.issue;}
    if(this.started!==null){
      const progress=this.samples.length?clamp((now-this.samples[0].at)/600,0,.95):0;
      return {steer:0,tilt:0,phase:this.planeStrength<2&&now-this.lastSample<1000?'flat':'collecting',progress};
    }
    if(!this.calibrated)return {steer:0,tilt:0,phase:this.phase,progress:0};
    if(now-this.lastSample>1000){this.filtered=0;return {steer:0,tilt:0,phase:'stale',progress:0};}
    if(this.planeStrength<2){this.filtered=0;return {steer:0,tilt:0,phase:'flat',progress:0};}
    this.filtered+=(relativeTilt(this.angle,this.baseline)-this.filtered)*.2;
    const tilt=this.filtered*(inverted?-1:1);
    return {steer:Math.abs(tilt)<2?0:clamp(tilt/(75-sensitivity),-1,1),tilt,phase:'ready',progress:1};
  }
}

export interface PermissionSource { requestPermission?:()=>Promise<string> }
/** Both permission calls run synchronously within the user's click gesture. */
export async function requestSensorAccess(motion?:PermissionSource,orientation?:PermissionSource){
  const request=(source?:PermissionSource):Promise<boolean>=>{
    if(!source)return Promise.resolve(false);
    if(!source.requestPermission)return Promise.resolve(true);
    try{return source.requestPermission().then(result=>result==='granted',()=>false);}catch{return Promise.resolve(false);}
  };
  const requests=[request(motion),request(orientation)];
  const [allowMotion,allowOrientation]=await Promise.all(requests);
  return {motion:allowMotion,orientation:allowOrientation};
}
