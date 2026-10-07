import { RemoteClient } from './network';
import { ZERO_INPUT, type Input } from '../game/simulation';
import { orientationGravity } from './protocol';
import { bindHold } from './input';
import { MotionSteering, requestSensorAccess, type PermissionSource, type CalibrationPhase } from './motion-steering';
import { controllerRotation, controllerAngle, type ControllerLayout } from './controller-layout';
const icon=(kind:string)=>kind==='wheel'?'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="25"/><circle cx="32" cy="32" r="8"/><path d="M8 27h16m16 0h16M32 40v17"/></svg>':'<svg viewBox="0 0 48 48"><rect x="13" y="5" width="22" height="38" rx="4"/><path d="M20 36h8M19 12h10"/></svg>';
export async function mountController(app:HTMLElement,code:string){
  app.innerHTML=`<main class="remote-shell">
    <header class="remote-header"><a class="wordmark" href="${location.pathname}">HARBOR RUN<span>港灣疾走 · 手機控制器</span></a><div class="remote-layout-tools"><label for="controller-layout">介面方向</label><select id="controller-layout" aria-label="介面方向"><option value="auto">跟隨螢幕</option><option value="left">橫向：手機頂端朝左</option><option value="right">橫向：手機頂端朝右</option></select><span id="remote-dot" class="connection-dot"></span></div></header>
    <div class="remote-status" id="remote-status" role="status">準備連線…</div>
    <section class="remote-setup" id="remote-setup">
      <div class="remote-wheel">${icon('wheel')}</div><h1>把手機變成方向盤。</h1>
      <p>橫拿手機，像轉動方向盤一樣左右傾斜。<br>油門與煞車由螢幕按鈕控制。</p>
      <ol class="remote-steps"><li>電腦先開啟遊戲，選擇「手機連線」。</li><li>掃描 QR Code，或輸入 12 碼房間代碼。</li><li>啟用體感後擺好握姿，再按「確定校正為 0°」。</li></ol>
      <label class="field-label" for="room-code">房間代碼</label><div class="room-row"><input id="room-code" maxlength="12" autocapitalize="characters" spellcheck="false" placeholder="12 碼房間代碼" value="${/^[A-Z2-9]{12}$/.test(code)?code:''}"/><button id="reconnect" class="button secondary">重新連線</button></div>
      <button id="enable-motion" class="button primary wide">啟用體感控制</button>
      <button id="touch-fallback" class="text-button">使用觸控方向控制</button>
      <p class="small-print" id="motion-note">iPhone 請用 Safari 開啟 HTTPS 遊戲連結；若鎖定直向，可在右上切換橫向介面。</p>
    </section>
    <section class="remote-drive hidden" id="remote-drive">
      <div class="remote-metrics"><div><b id="remote-speed">000</b><span>km/h</span></div><div class="remote-mission" id="remote-mission">等待開始</div><div><b id="remote-health">100</b><span>車體耐久</span></div></div>
      <div class="steering-readout"><div class="steering-track"><span id="steer-marker"></span></div><span id="tilt-value">0°</span><span id="sensor-state">體感未啟用</span></div>
      <div class="remote-controls"><button id="pedal-brake" class="pedal brake">煞車<span>按住減速</span></button><div class="steer-buttons" id="steer-buttons"><button id="steer-left" aria-label="向左">◀</button><button id="steer-right" aria-label="向右">▶</button></div><button id="pedal-gas" class="pedal gas">油門<span>按住加速</span></button></div>
      <div class="remote-secondary"><button id="pedal-handbrake" class="button secondary">手煞車</button><button id="pedal-nitro" class="button nitro">氮氣加速</button><button id="reverse" class="button secondary">倒車</button></div>
      <div class="remote-tools"><button id="start-remote" class="button primary">開始任務</button><button id="pause-remote" class="text-button">暫停／繼續</button><button id="calibrate" class="text-button">確定校正為 0°</button><button id="remote-settings" class="text-button">設定</button></div>
      <label class="sensitivity" for="sensitivity">轉向敏感度<input id="sensitivity" type="range" min="15" max="60" value="32"/><span>低 → 高</span></label>
      <label class="invert-control"><input id="invert-steering" type="checkbox"/>反轉體感方向<span>正常為右傾 → 右轉</span></label>
      <p class="calibration-note" id="drive-note" role="status">左右傾斜轉向；手持姿勢改變時，請重新校正。</p>
    </section>
    <footer class="remote-footer">保持螢幕開啟 · 切換 App 或鎖屏會停止輸入</footer>
  </main>`;
  const $=(id:string)=>document.getElementById(id)!;
  const client=new RemoteClient();const input:Input={...ZERO_INPUT};const steering=new MotionSteering();
  let sensor=false,touch=false,sensitivity=32,lastMotion=-Infinity,heldSteer=0,inverted=false,requesting=false;
  let layout:ControllerLayout='auto',pageRotation=0,permissionMessage='',wake:WakeLockSentinel|undefined;
  const screenAngle=()=>controllerAngle(screen.orientation?.angle ?? (typeof window.orientation==='number'?window.orientation:0),pageRotation);
  const modeStatus=()=>touch?'已連線 · 觸控方向控制':'已連線 · 體感方向控制';
  client.onStatus=(status,connected)=>{$('remote-status').textContent=connected&&(sensor||touch)?modeStatus():status;$('remote-dot').classList.toggle('connected',connected);$('start-remote').toggleAttribute('disabled',!connected);};
  client.onTelemetry=t=>{$('remote-speed').textContent=String(Math.round(t.speed)).padStart(3,'0');$('remote-health').textContent=String(Math.round(t.health));$('remote-mission').textContent=t.phase==='playing'?`檢查點 ${t.checkpoint}/${t.total} · ${Math.ceil(t.time)}s`:t.phase==='won'?'任務完成！':t.phase==='lost'?'任務失敗，重新挑戰':t.phase==='paused'?'遊戲已暫停':t.phase==='free'?'自由駕駛':'等待開始';$('start-remote').textContent=['won','lost'].includes(t.phase)?'重新挑戰':'開始任務';};
  const showDrive=()=>{$('remote-setup').classList.add('hidden');$('remote-drive').classList.remove('hidden');if(client.connected)$('remote-status').textContent=modeStatus();};
  const calibrate=()=>{permissionMessage='';touch=false;heldSteer=0;input.steer=0;steering.requestCalibration(performance.now());showDrive();};
  const prepareCalibration=()=>{permissionMessage='';touch=false;heldSteer=0;input.steer=0;steering.invalidate('awaiting-confirmation');showDrive();};
  const handleMotion=(e:DeviceMotionEvent)=>{
    const a=e.accelerationIncludingGravity;if(a?.x==null||a.y==null||!Number.isFinite(a.x)||!Number.isFinite(a.y))return;
    lastMotion=performance.now();steering.receive(a.x,a.y,screenAngle(),'motion',lastMotion);
  };
  const handleOrientation=(e:DeviceOrientationEvent)=>{
    const now=performance.now();if(now-lastMotion<500||e.beta==null||e.gamma==null)return;
    const v=orientationGravity(e.beta,e.gamma);steering.receive(v.x,v.y,screenAngle(),'orientation',now);
  };
  const keepAwake=async()=>{try{wake=await navigator.wakeLock?.request('screen');}catch{/* Optional. */}};
  const enableMotion=async(confirmNeutral=false)=>{
    if(requesting)return;
    if(!window.isSecureContext||location.protocol==='file:'){
      permissionMessage='請用 Safari 開啟正式 HTTPS 遊戲網址，再掃碼連線與啟用體感。';$('motion-note').textContent=$('drive-note').textContent=permissionMessage;return;
    }
    if(sensor){if(confirmNeutral)calibrate();else prepareCalibration();return;}
    permissionMessage='等待 Safari 動作感測授權…';requesting=true;$('enable-motion').setAttribute('disabled','');$('calibrate').setAttribute('disabled','');
    try{
      const Motion=typeof DeviceMotionEvent==='undefined'?undefined:DeviceMotionEvent as unknown as PermissionSource;
      const Orientation=typeof DeviceOrientationEvent==='undefined'?undefined:DeviceOrientationEvent as unknown as PermissionSource;
      const allowed=await requestSensorAccess(Motion,Orientation);
      if(!allowed.motion&&!allowed.orientation)throw new Error('denied');
      window.removeEventListener('devicemotion',handleMotion);window.removeEventListener('deviceorientation',handleOrientation);
      if(allowed.motion)window.addEventListener('devicemotion',handleMotion);
      if(allowed.orientation)window.addEventListener('deviceorientation',handleOrientation);
      lastMotion=-Infinity;sensor=true;if(confirmNeutral)calibrate();else prepareCalibration();void keepAwake();
    }catch{permissionMessage='動作感測未開啟。請在 Safari 允許動作權限後重試，或使用左右方向按鈕。';$('motion-note').textContent=$('drive-note').textContent=permissionMessage;}
    finally{requesting=false;$('enable-motion').removeAttribute('disabled');$('calibrate').removeAttribute('disabled');}
  };
  $('enable-motion').addEventListener('click',()=>void enableMotion());
  $('touch-fallback').addEventListener('click',()=>{permissionMessage='';touch=true;steering.invalidate('idle');showDrive();$('sensor-state').textContent='觸控方向控制';void keepAwake();});
  $('reconnect').addEventListener('click',()=>{const room=($('room-code') as HTMLInputElement).value.trim().toUpperCase();void client.connect(room);});
  $('calibrate').addEventListener('click',()=>void enableMotion(true));
  $('remote-settings').addEventListener('click',()=>{$('remote-setup').classList.remove('hidden');$('remote-drive').classList.add('hidden');Object.assign(input,ZERO_INPUT);});
  $('sensitivity').addEventListener('input',e=>sensitivity=Number((e.target as HTMLInputElement).value));
  bindHold($('pedal-gas'),p=>input.throttle=p?1:0);bindHold($('reverse'),p=>input.throttle=p?-1:0);
  bindHold($('pedal-brake'),p=>input.brake=p?1:0);bindHold($('pedal-handbrake'),p=>input.handbrake=p);bindHold($('pedal-nitro'),p=>input.nitro=p);
  bindHold($('steer-left'),p=>heldSteer=p?-1:0);bindHold($('steer-right'),p=>heldSteer=p?1:0);
  $('start-remote').addEventListener('click',()=>client.action('start'));$('pause-remote').addEventListener('click',()=>client.action('pause'));
  const updateLayout=()=>{
    const angleBefore=screenAngle();pageRotation=controllerRotation(layout,innerWidth,innerHeight);
    app.classList.toggle('manual-landscape',pageRotation!==0);app.style.setProperty('--controller-rotation',`${pageRotation}deg`);
    if(screenAngle()!==angleBefore){steering.invalidate('orientation-changed');input.steer=0;}
  };
  const orientationChanged=()=>{updateLayout();steering.invalidate('orientation-changed');input.steer=0;};
  screen.orientation?.addEventListener('change',orientationChanged);window.addEventListener('orientationchange',orientationChanged);window.addEventListener('resize',updateLayout);
  $('controller-layout').addEventListener('change',e=>{
    layout=(e.target as HTMLSelectElement).value as ControllerLayout;updateLayout();
    steering.invalidate('orientation-changed');input.steer=0;
    try{localStorage.setItem('harbor-controller-layout',layout);}catch{}
  });
  $('invert-steering').addEventListener('change',e=>{inverted=(e.target as HTMLInputElement).checked;try{localStorage.setItem('harbor-controller-invert',String(inverted));}catch{}});
  try{
    const saved=localStorage.getItem('harbor-controller-layout');if(saved==='left'||saved==='right')layout=saved;
    inverted=localStorage.getItem('harbor-controller-invert')==='true';
  }catch{}
  ($('controller-layout') as HTMLSelectElement).value=layout;($('invert-steering') as HTMLInputElement).checked=inverted;updateLayout();
  const messages:Record<CalibrationPhase,string>={
    idle:'可用左右按鈕；按「確定校正為 0°」可啟用體感。',
    'awaiting-confirmation':'把手機擺在你想當作正中央的握姿，再按「確定校正為 0°」。',
    collecting:'正在把目前握姿設為 0°：請保持不動約一秒。',
    ready:'校正完成 ✓　目前姿勢為正中央。右傾 → 右轉；握姿改變時重新校正。',
    'no-data':'沒有收到足夠的感測資料。請用 iPhone Safari 的 HTTPS 頁面授權，再按確定校正。',
    moving:'手機仍在移動，尚未校正。握穩後再按確定校正。',flat:'手機太平，無法判斷方向。請把螢幕稍微立起朝向你，再校正。',
    stale:'感測資料暫停。請保持頁面在前景，恢復後可重新校正。',
    'orientation-changed':'介面方向已改變。擺好正中央的握姿，再按「確定校正為 0°」。',
    'source-changed':'感測來源已改變，請按確定校正更新中央姿勢。'
  };
  let seq=0;
  const tick=setInterval(()=>{
    if(document.hidden){client.send({...ZERO_INPUT,brake:1});return;}
    const reading=steering.read(performance.now(),sensitivity,inverted);
    input.steer=heldSteer||(sensor&&!touch?reading.steer:0);
    client.send({...input});
    if(++seq%3===0){
      $('steer-marker').style.transform=`translateX(${input.steer*90}px)`;$('tilt-value').textContent=sensor&&!touch&&!steering.calibrated?'未校正':`${Math.round(touch?0:reading.tilt)}°`;
      if(sensor&&!touch){
        $('sensor-state').textContent=reading.phase==='ready'?'體感已校正':reading.phase==='collecting'?'校正中…':reading.phase==='awaiting-confirmation'?'等待確認中央':'尚未完成校正';
        $('drive-note').textContent=reading.phase==='ready'&&inverted?'校正完成 ✓　目前姿勢為 0°，已反轉體感方向。':messages[reading.phase];
      }else if(touch)$('drive-note').textContent=messages.idle;
      if(permissionMessage)$('drive-note').textContent=permissionMessage;
      $('calibrate').textContent=sensor&&!touch&&reading.phase==='collecting'?'重新開始校正':steering.calibrated?'重新校正 0°':'確定校正為 0°';
    }
  },33);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){Object.assign(input,ZERO_INPUT);client.send({...ZERO_INPUT,brake:1});}else if(sensor||touch)void keepAwake();});
  window.addEventListener('pagehide',()=>{clearInterval(tick);window.removeEventListener('devicemotion',handleMotion);window.removeEventListener('deviceorientation',handleOrientation);client.disconnect();void wake?.release();});
  if(/^[A-Z2-9]{12}$/.test(code))await client.connect(code);else client.onStatus('輸入房間代碼，或掃描電腦上的 QR Code。',false);
}
