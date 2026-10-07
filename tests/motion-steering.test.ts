import test from 'node:test';
import assert from 'node:assert/strict';
import { MotionSteering, requestSensorAccess } from '../src/platform/motion-steering.ts';
import { gravityTilt, relativeTilt, orientationTilt } from '../src/platform/protocol.ts';
import { controllerRotation, controllerAngle } from '../src/platform/controller-layout.ts';
import { createVehicle, stepVehicle, ZERO_INPUT } from '../src/game/simulation.ts';

// Physical fixture: a clockwise/right bank makes screen-right point down.
// Rotate screen-frame proper acceleration back into natural device axes.
function gravity(bank:number,screen:number,polarity=1){
  const b=bank*Math.PI/180,a=screen*Math.PI/180;
  const right=-9.8*Math.sin(b)*polarity,up=9.8*Math.cos(b)*polarity;
  return {x:right*Math.cos(a)+up*Math.sin(a),y:-right*Math.sin(a)+up*Math.cos(a)};
}
function sample(s:MotionSteering,bank:number,screen:number,now:number,polarity=1){const g=gravity(bank,screen,polarity);s.receive(g.x,g.y,screen,'motion',now);}
function calibrate(s:MotionSteering,bank=0,screen=90,polarity=1){s.requestCalibration(0);for(let now=0;now<=600;now+=100)sample(s,bank,screen,now,polarity);assert.equal(s.calibrated,true);}

test('right and left banks retain their direction for all screen rotations and both gravity polarities',()=>{
  for(const angle of [0,90,180,270])for(const polarity of [1,-1]){
    const zero=gravity(0,angle,polarity),right=gravity(25,angle,polarity),left=gravity(-25,angle,polarity);
    const baseline=gravityTilt(zero.x,zero.y,angle);
    assert.ok(Math.abs(relativeTilt(gravityTilt(right.x,right.y,angle),baseline)-25)<1e-9);
    assert.ok(Math.abs(relativeTilt(gravityTilt(left.x,left.y,angle),baseline)+25)<1e-9);
  }
});
test('orientation fallback has the same physical direction on both landscape sides',()=>{
  assert.ok(Math.abs(orientationTilt(25,-90,90)-25)<1e-9);
  assert.ok(Math.abs(orientationTilt(-25,90,270)-25)<1e-9);
});
test('calibration needs new stable samples; a timer alone cannot report success',()=>{
  const s=new MotionSteering();s.requestCalibration(0);
  assert.equal(s.read(1000,32).steer,0);assert.equal(s.calibrated,false);
  assert.equal(s.read(5001,32).phase,'no-data');assert.equal(s.calibrated,false);
  s.requestCalibration(6000);sample(s,0,90,6000);assert.equal(s.calibrated,false);
});
test('receiving sensor data does not set a neutral pose until the user confirms',()=>{
  const s=new MotionSteering();s.invalidate('awaiting-confirmation');
  for(let now=0;now<=1000;now+=100)sample(s,18,90,now);
  assert.equal(s.calibrated,false);assert.equal(s.read(1000,32).phase,'awaiting-confirmation');
  assert.equal(s.read(1000,32).steer,0);
  s.requestCalibration(1200);for(let now=1200;now<=1800;now+=100)sample(s,18,90,now);
  assert.equal(s.calibrated,true);assert.equal(s.read(1800,32).steer,0);
});
test('recalibration centers the current grip and handles the -180/+180 seam',()=>{
  for(const polarity of [1,-1]){
    const s=new MotionSteering();s.requestCalibration(0);
    for(let now=0;now<=600;now+=100)sample(s,now%200===0?-.5:.5,90,now,polarity);
    assert.equal(s.calibrated,true);assert.ok(Math.abs(s.read(600,32).tilt)<1);
    s.requestCalibration(1000);for(let now=1000;now<=1700;now+=100)sample(s,18,90,now,polarity);
    assert.equal(s.read(1700,32).steer,0);
    sample(s,40,90,1800,polarity);assert.ok(s.read(1800,32).steer>0);
  }
});
test('a gap in sensor delivery restarts the stable calibration window',()=>{
  const s=new MotionSteering();s.requestCalibration(0);
  for(let now=0;now<=400;now+=100)sample(s,0,90,now);
  sample(s,0,90,1500);assert.equal(s.calibrated,false);
  for(let now=1600;now<=2100;now+=100)sample(s,0,90,now);
  assert.equal(s.calibrated,true);
});
test('moving, flat and stale sensors cannot produce a false calibration or continue steering',()=>{
  const moving=new MotionSteering();moving.requestCalibration(0);
  for(let now=0;now<=5000;now+=100)sample(moving,now%200===0?0:15,90,now);
  assert.equal(moving.calibrated,false);assert.equal(moving.read(5001,32).phase,'moving');
  const flat=new MotionSteering();flat.requestCalibration(0);for(let now=0;now<=1000;now+=100)flat.receive(0,0,0,'motion',now);
  assert.equal(flat.read(1000,32).phase,'flat');assert.equal(flat.calibrated,false);
  const s=new MotionSteering();calibrate(s);sample(s,30,90,700);assert.ok(s.read(700,32).steer>0);assert.equal(s.read(1800,32).steer,0);
});
test('layout or sensor-source changes require a new neutral pose',()=>{
  const s=new MotionSteering();calibrate(s);sample(s,0,270,700);
  assert.equal(s.calibrated,false);assert.equal(s.read(700,32).phase,'orientation-changed');
  calibrate(s);const g=gravity(0,90);s.receive(g.x,g.y,90,'orientation',700);
  assert.equal(s.read(700,32).phase,'source-changed');assert.equal(s.read(700,32).steer,0);
});
test('manual landscape uses a matching sensor frame while OS keeps portrait',()=>{
  assert.equal(controllerAngle(0,controllerRotation('left',390,844)),90);
  assert.equal(controllerAngle(0,controllerRotation('right',390,844)),270);
  assert.equal(controllerRotation('left',844,390),0);
  assert.equal(controllerRotation('auto',390,844),0);
});
test('one allowed sensor is sufficient and both permission requests begin inside the click',async()=>{
  const calls:string[]=[];
  const pending=requestSensorAccess({requestPermission:()=>{calls.push('motion');return Promise.resolve('denied');}},{requestPermission:()=>{calls.push('orientation');return Promise.resolve('granted');}});
  assert.deepEqual(calls,['motion','orientation']);assert.deepEqual(await pending,{motion:false,orientation:true});
  assert.deepEqual(await requestSensorAccess(undefined,{}),{motion:false,orientation:true});
  assert.deepEqual(await requestSensorAccess({requestPermission:()=>Promise.reject(new Error('no permission'))},undefined),{motion:false,orientation:false});
});
test('sensor right bank drives the vehicle right, with an optional explicit inversion',()=>{
  const s=new MotionSteering();calibrate(s,0,90,-1);sample(s,25,90,700,-1);
  const input=s.read(700,32);assert.ok(input.steer>0);
  const v=createVehicle();for(let i=0;i<180;i++)stepVehicle(v,{...ZERO_INPUT,throttle:1,steer:input.steer},1/60,[]);
  assert.ok(v.x>184);assert.ok(s.read(710,32,true).steer<0);
});
