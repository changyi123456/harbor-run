import { GameWorld } from '../rendering/world';
import { createVehicle, stepVehicle, Mission, type Phase, ZERO_INPUT } from './simulation';
import { InputManager, bindHold } from '../platform/input';
import { RemoteHost } from '../platform/network';
import { GameAudio } from '../platform/audio';
import { GameUI } from '../ui/shell';
import QRCode from 'qrcode';
export async function mountGame(app:HTMLElement){
  const ui=new GameUI(app);let world:GameWorld;
  try{world=new GameWorld(ui.canvas());}catch{ui.loading('這個瀏覽器無法啟動 WebGL。請使用新版 Chrome、Safari 或 Firefox。');return;}
  const input=new InputManager(),host=new RemoteHost(),audio=new GameAudio(),mission=new Mission();let vehicle=createVehicle();
  let loaded=false,last=performance.now(),accumulator=0,uiTime=0,telemetryTime=0,collisionCooldown=0,resultShown=false,pausedPhase:Phase='playing';
  let best=0;try{best=Number(localStorage.getItem('harbor-run-best-v1'))||0;}catch{}
  const start=(free=false)=>{if(!loaded)return;vehicle=createVehicle();world.resetNpcs();mission.start(free);input.clear();ui.start();resultShown=false;last=performance.now();accumulator=0;void audio.unlock();ui.toast(free?'自由探索城市 · R 可重置車輛':'跟著青色導航門前進，注意彎道與車流。');};
  const pause=()=>{
    if(!loaded)return;
    if(mission.phase==='paused'){mission.phase=pausedPhase;ui.hideDialog('pause-dialog');last=performance.now();accumulator=0;void audio.unlock();}
    else if(['playing','free'].includes(mission.phase)){pausedPhase=mission.phase;mission.phase='paused';input.clear();ui.showDialog('pause-dialog');}
  };
  ui.onStart=start;ui.onReset=()=>start(mission.phase==='free');ui.onPause=pause;ui.onQuality=q=>world.setQuality(q);ui.onSound=()=>audio.toggle();ui.onMusic=()=>audio.toggleMusic();
  input.onPause=pause;input.onReset=()=>start(mission.phase==='free');
  host.onInput=i=>input.receive(i);
  host.onStatus=(status,connected)=>{
    const wasConnected=input.remoteConnected;input.remoteConnected=connected;
    document.getElementById('pair-status')!.textContent=status;document.getElementById('host-dot')!.classList.toggle('connected',connected);
    if(wasConnected&&!connected&&['playing','free'].includes(mission.phase)){pause();ui.toast('手機已斷線。重新連線，或用鍵盤繼續。');}
    if(connected)ui.toast('手機已配對。在手機啟用體感並校正。');
  };
  host.onAction=action=>{if(action==='start')start();if(action==='pause')pause();if(action==='reset')start();};
  const openRoom=async(retry=false)=>{
    if(retry)host.reset();if(['playing','free'].includes(mission.phase))pause();
    ui.showDialog('pair-dialog');
    try{
      const code=await host.open();document.getElementById('pair-code')!.textContent=code;
      const qr=document.getElementById('qr-code') as HTMLCanvasElement;
      await QRCode.toCanvas(qr,host.url(),{width:220,margin:2,color:{dark:'#0b1019',light:'#ffffff'}});document.getElementById('qr-pending')!.classList.add('hidden');
      if(location.hostname==='localhost'||location.hostname==='127.0.0.1')document.getElementById('pair-status')!.textContent='本機 QR 網址無法由手機開啟；部署 HTTPS 後即可使用。';
    }catch{document.getElementById('pair-status')!.textContent='建立房間失敗，請重新建立。';}
  };
  ui.onConnect=()=>{void audio.unlock();void openRoom();};document.getElementById('retry-room')!.onclick=()=>void openRoom(true);
  document.getElementById('copy-link')!.onclick=async()=>{try{await navigator.clipboard.writeText(host.url());ui.toast('手機連結已複製');}catch{ui.toast('請直接掃描 QR Code，或輸入房間代碼。');}};
  const touch=(id:string,key:keyof typeof ZERO_INPUT,value:number|boolean)=>bindHold(document.getElementById(id)!,p=>{(input.touch[key] as number|boolean)=p?value:typeof value==='boolean'?false:0;});
  touch('touch-left','steer',-1);touch('touch-right','steer',1);touch('touch-gas','throttle',1);touch('touch-brake','brake',1);touch('touch-boost','nitro',true);
  const collision=(force=10)=>{if(collisionCooldown>0)return;collisionCooldown=.65;mission.hits++;world.cameraShake=Math.min(.55,force*.015);ui.impact();audio.chime(true);};
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&['playing','free'].includes(mission.phase))pause();});
  window.addEventListener('blur',()=>{if(['playing','free'].includes(mission.phase))pause();});
  ui.canvas().addEventListener('webglcontextlost',e=>{e.preventDefault();if(['playing','free'].includes(mission.phase))pause();ui.toast('圖形連線中斷，恢復後可繼續。');});
  ui.canvas().addEventListener('webglcontextrestored',()=>{ui.toast('圖形已恢復，請繼續駕駛。');});
  try{await world.load(text=>ui.loading(text));loaded=true;ui.ready();if(matchMedia('(pointer:coarse)').matches){world.setQuality('low');(document.getElementById('quality') as HTMLSelectElement).value='low';}}
  catch(err){console.error('World load failed',err);ui.loading('場景載入失敗。請重新整理頁面，或檢查網路連線。');return;}
  // A read-only snapshot is useful for diagnostics and reproducible browser QA.
  Object.defineProperty(window,'harborRun',{get:()=>({phase:mission.phase,checkpoint:mission.index,vehicle:{...vehicle},room:host.code,connected:!!host.connection?.open,stats:{...world.stats},assets:'Blender 4.5.7 LTS'})});
  world.engine.runRenderLoop(()=>{
    const now=performance.now(),dt=Math.min((now-last)/1000,.08);last=now;
    const active=['playing','free'].includes(mission.phase);
    const controls=input.sample();collisionCooldown=Math.max(0,collisionCooldown-dt);
    if(active){
      accumulator+=dt;
      while(accumulator>=1/60){
        // Missing remote packets stop input and gently apply the brake.
        const command=input.remoteConnected&&now-input.remoteAt>500?{...ZERO_INPUT,brake:1}:controls;
        stepVehicle(vehicle,command,1/60,world.data.colliders,collision);
        world.updateNpcs(vehicle,1/60,mission.elapsed,true,()=>{if(collisionCooldown<=0){vehicle.health=Math.max(0,vehicle.health-5);collision();}});
        if(mission.update(vehicle,1/60)){audio.chime();ui.toast(mission.phase==='won'?'抵達碼頭！':`檢查點 ${mission.index}/8 · 繼續前進`);}
        accumulator-=1/60;
        if(!['playing','free'].includes(mission.phase)){accumulator=0;break;}
      }
    }else if(mission.phase==='guide')world.updateNpcs(vehicle,dt,0,false,()=>{});
    world.render(vehicle,dt,mission.index,active,mission.phase==='guide');
    audio.update(vehicle.speed,controls.throttle,vehicle.boosting,active);
    uiTime+=dt;telemetryTime+=dt;
    if(uiTime>.08){uiTime=0;ui.canvas().dataset.fps=world.stats.fps.toFixed(1);ui.update(vehicle,mission,world.npcs,input.remoteConnected);}
    if(telemetryTime>.1){telemetryTime=0;host.telemetry({type:'telemetry',speed:vehicle.speed*3.6,health:vehicle.health,nitro:vehicle.nitro,phase:mission.phase,checkpoint:mission.index,total:8,time:mission.time});}
    if(['won','lost'].includes(mission.phase)&&!resultShown){resultShown=true;if(mission.phase==='won'&&(!best||mission.elapsed<best)){best=mission.elapsed;try{localStorage.setItem('harbor-run-best-v1',String(best));}catch{}}ui.result(vehicle,mission,best);}
  });
  window.addEventListener('pagehide',()=>{audio.music.pause();host.reset();world.engine.dispose();});
}
