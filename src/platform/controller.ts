import { RemoteClient } from './network';
import { ZERO_INPUT, type Input, clamp } from '../game/simulation';
import { gravityTilt, orientationTilt } from './protocol';
import { bindHold } from './input';
type SensorConstructor=typeof DeviceMotionEvent&{requestPermission?:()=>Promise<string>};
const icon=(kind:string)=>kind==='wheel'?'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="25"/><circle cx="32" cy="32" r="8"/><path d="M8 27h16m16 0h16M32 40v17"/></svg>':'<svg viewBox="0 0 48 48"><rect x="13" y="5" width="22" height="38" rx="4"/><path d="M20 36h8M19 12h10"/></svg>';
export async function mountController(app:HTMLElement,code:string){
  app.innerHTML=`<main class="remote-shell">
    <header class="remote-header"><a class="wordmark" href="${location.pathname}">HARBOR RUN<span>港灣疾走 · 手機控制器</span></a><span id="remote-dot" class="connection-dot"></span></header>
    <div class="remote-status" id="remote-status" role="status">準備連線…</div>
    <section class="remote-setup" id="remote-setup">
      <div class="remote-wheel">${icon('wheel')}</div><h1>把手機變成方向盤。</h1>
      <p>橫拿手機，像轉動方向盤一樣左右傾斜。<br>油門與煞車由螢幕按鈕控制。</p>
      <ol class="remote-steps"><li>電腦先開啟遊戲，選擇「手機連線」。</li><li>掃描 QR Code，或輸入 12 碼房間代碼。</li><li>按下方按鈕授權，保持舒服的姿勢完成校正。</li></ol>
      <label class="field-label" for="room-code">房間代碼</label><div class="room-row"><input id="room-code" maxlength="12" autocapitalize="characters" spellcheck="false" placeholder="12 碼房間代碼" value="${/^[A-Z2-9]{12}$/.test(code)?code:''}"/><button id="reconnect" class="button secondary">重新連線</button></div>
      <button id="enable-motion" class="button primary wide">啟用體感並校正</button>
      <button id="touch-fallback" class="text-button">使用觸控方向控制</button>
      <p class="small-print" id="motion-note">請用 Safari 或 Chrome 開啟；保持頁面在前景。</p>
    </section>
    <section class="remote-drive hidden" id="remote-drive">
      <div class="remote-metrics"><div><b id="remote-speed">000</b><span>km/h</span></div><div class="remote-mission" id="remote-mission">等待開始</div><div><b id="remote-health">100</b><span>車體耐久</span></div></div>
      <div class="steering-readout"><div class="steering-track"><span id="steer-marker"></span></div><span id="tilt-value">0°</span><span id="sensor-state">體感未啟用</span></div>
      <div class="remote-controls"><button id="pedal-brake" class="pedal brake">煞車<span>按住減速</span></button><div class="steer-buttons" id="steer-buttons"><button id="steer-left" aria-label="向左">◀</button><button id="steer-right" aria-label="向右">▶</button></div><button id="pedal-gas" class="pedal gas">油門<span>按住加速</span></button></div>
      <div class="remote-secondary"><button id="pedal-handbrake" class="button secondary">手煞車</button><button id="pedal-nitro" class="button nitro">氮氣加速</button><button id="reverse" class="button secondary">倒車</button></div>
      <div class="remote-tools"><button id="start-remote" class="button primary">開始任務</button><button id="pause-remote" class="text-button">暫停／繼續</button><button id="calibrate" class="text-button">重新校正</button><button id="remote-settings" class="text-button">設定</button></div>
      <label class="sensitivity" for="sensitivity">轉向敏感度<input id="sensitivity" type="range" min="15" max="60" value="32"/><span>低 → 高</span></label>
      <p class="small-print" id="drive-note">左右傾斜轉向；手持姿勢改變時，請重新校正。</p>
    </section>
    <footer class="remote-footer">保持螢幕開啟 · 切換 App 或鎖屏會停止輸入</footer>
  </main>`;
  const $=(id:string)=>document.getElementById(id)!;
  const client=new RemoteClient();const input:Input={...ZERO_INPUT};let sensor=false,touch=false,raw=0,baseline=0,filtered=0,sensitivity=32,lastMotion=0,sensorType='';let wake:WakeLockSentinel|undefined;
  const screenAngle=()=>screen.orientation?.angle ?? (typeof window.orientation==='number'?window.orientation:0);
  client.onStatus=(status,connected)=>{$('remote-status').textContent=status;$('remote-dot').classList.toggle('connected',connected);$('start-remote').toggleAttribute('disabled',!connected);};
  client.onTelemetry=t=>{$('remote-speed').textContent=String(Math.round(t.speed)).padStart(3,'0');$('remote-health').textContent=String(Math.round(t.health));$('remote-mission').textContent=t.phase==='playing'?`檢查點 ${t.checkpoint}/${t.total} · ${Math.ceil(t.time)}s`:t.phase==='won'?'任務完成！':t.phase==='lost'?'任務失敗，重新挑戰':t.phase==='paused'?'遊戲已暫停':t.phase==='free'?'自由駕駛':'等待開始';$('start-remote').textContent=['won','lost'].includes(t.phase)?'重新挑戰':'開始任務';};
  const showDrive=()=>{$('remote-setup').classList.add('hidden');$('remote-drive').classList.remove('hidden');if(client.connected)$('remote-status').textContent=touch?'已連線 · 觸控方向控制':'已連線 · 體感方向控制';};
  const calibrate=()=>{baseline=raw;filtered=0;input.steer=0;if(sensor&&lastMotion)touch=false;$('drive-note').textContent='已校正目前姿勢。左右傾斜手機即可轉向。';};
  const handleMotion=(e:DeviceMotionEvent)=>{const a=e.accelerationIncludingGravity;if(a?.x==null||a.y==null)return;raw=gravityTilt(a.x,a.y,screenAngle());lastMotion=performance.now();sensorType='陀螺儀／重力姿態';};
  const handleOrientation=(e:DeviceOrientationEvent)=>{if(performance.now()-lastMotion<250||e.beta==null||e.gamma==null)return;raw=orientationTilt(e.beta,e.gamma,screenAngle());lastMotion=performance.now();sensorType='姿態感測';};
  const keepAwake=async()=>{try{wake=await navigator.wakeLock?.request('screen');}catch{/* Optional. */}};
  $('enable-motion').addEventListener('click',async()=>{
    if(!window.isSecureContext){$('motion-note').textContent='體感需要 HTTPS。請從正式遊戲網址掃描 QR Code。';return;}
    $('enable-motion').setAttribute('disabled','');
    try{
      const Motion=DeviceMotionEvent as SensorConstructor, Orientation=DeviceOrientationEvent as unknown as SensorConstructor;
      // Both requests originate directly from this click, before any awaited work.
      const requests=[Motion.requestPermission?.(),Orientation.requestPermission?.()].filter(Boolean);
      const results=await Promise.all(requests);
      if(results.some(x=>x!=='granted'))throw new Error('denied');
      window.removeEventListener('devicemotion',handleMotion);window.removeEventListener('deviceorientation',handleOrientation);
      window.addEventListener('devicemotion',handleMotion);window.addEventListener('deviceorientation',handleOrientation);
      sensor=true;touch=false;showDrive();await keepAwake();
      $('sensor-state').textContent='等待感測資料…';
      setTimeout(()=>{calibrate();if(!lastMotion){touch=true;$('sensor-state').textContent='無感測資料 · 使用觸控';$('drive-note').textContent='這台裝置未提供感測資料，請使用左右方向按鈕。';}else{$('sensor-state').textContent='體感已啟用';}},1000);
    }catch{$('motion-note').textContent='感測權限未開啟，可重試授權或使用觸控方向控制。';}
    finally{$('enable-motion').removeAttribute('disabled');}
  });
  $('touch-fallback').addEventListener('click',()=>{touch=true;sensor=false;showDrive();$('sensor-state').textContent='觸控方向控制';void keepAwake();});
  $('reconnect').addEventListener('click',()=>{const room=($('room-code') as HTMLInputElement).value.trim().toUpperCase();void client.connect(room);});
  $('calibrate').addEventListener('click',calibrate);
  $('remote-settings').addEventListener('click',()=>{$('remote-setup').classList.remove('hidden');$('remote-drive').classList.add('hidden');Object.assign(input,ZERO_INPUT);});
  $('sensitivity').addEventListener('input',e=>sensitivity=Number((e.target as HTMLInputElement).value));
  bindHold($('pedal-gas'),p=>input.throttle=p?1:0);bindHold($('reverse'),p=>input.throttle=p?-1:0);
  bindHold($('pedal-brake'),p=>input.brake=p?1:0);bindHold($('pedal-handbrake'),p=>input.handbrake=p);bindHold($('pedal-nitro'),p=>input.nitro=p);
  bindHold($('steer-left'),p=>{touch=true;input.steer=p?-1:0;});bindHold($('steer-right'),p=>{touch=true;input.steer=p?1:0;});
  $('start-remote').addEventListener('click',()=>client.action('start'));$('pause-remote').addEventListener('click',()=>client.action('pause'));
  screen.orientation?.addEventListener('change',()=>{setTimeout(calibrate,300);});
  let seq=0;
  const tick=setInterval(()=>{
    if(document.hidden){client.send({...ZERO_INPUT,brake:1});return;}
    if(sensor&&!touch){const tilt=raw-baseline;filtered+=(tilt-filtered)*.2;input.steer=Math.abs(filtered)<2?0:clamp(filtered/(75-sensitivity),-1,1);if(performance.now()-lastMotion>1000)input.steer=0;}
    client.send({...input});
    if(++seq%3===0){$('steer-marker').style.transform=`translateX(${input.steer*90}px)`;$('tilt-value').textContent=`${Math.round(filtered)}°`;if(lastMotion&&sensor&&!touch)$('sensor-state').textContent=sensorType;}
  },33);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){Object.assign(input,ZERO_INPUT);client.send({...ZERO_INPUT,brake:1});}else if(sensor||touch)void keepAwake();});
  window.addEventListener('pagehide',()=>{clearInterval(tick);client.disconnect();void wake?.release();});
  if(/^[A-Z2-9]{12}$/.test(code))await client.connect(code);else client.onStatus('輸入房間代碼，或掃描電腦上的 QR Code。',false);
}
