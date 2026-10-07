import { CHECKPOINTS, type Vehicle, type Mission, type Phase } from '../game/simulation';
import type { Npc } from '../rendering/world';
const icons={music:'<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',phone:'<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 18h4"/>',pause:'<path d="M8 5v14M16 5v14"/>',sound:'<path d="M4 9h4l5-4v14l-5-4H4zM17 8a6 6 0 010 8"/>',full:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>'};
export const icon=(name:keyof typeof icons)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
export class GameUI {
  minimap:HTMLCanvasElement;map:CanvasRenderingContext2D; lastPhase:Phase='guide';
  onStart?:(free?:boolean)=>void;onPause?:()=>void;onConnect?:()=>void;onReset?:()=>void;onQuality?:(quality:string)=>void;onSound?:()=>boolean;onMusic?:()=>boolean;
  constructor(public app:HTMLElement){
    app.innerHTML=`<canvas id="game-canvas" aria-label="港灣疾走 3D 駕駛場景"></canvas>
      <div class="scene-vignette"></div><div class="impact-flash" id="impact-flash"></div>
      <header class="game-header"><div class="game-brand"><div class="wordmark">HARBOR RUN</div><span class="brand-chinese">港灣疾走</span><p id="mission-label">穿越檢查點，抵達港口</p></div>
      <nav class="game-actions" aria-label="遊戲選項"><button id="connect-button" class="utility">${icon('phone')}<span>手機連線</span><i id="host-dot"></i></button><button id="pause-button" class="utility">${icon('pause')}<span>暫停</span></button><button id="sound-button" class="icon-button" aria-label="切換音效">${icon('sound')}</button><button id="music-button" class="icon-button" aria-label="切換配樂" aria-pressed="true" title="配樂：Synthwave House Loop">${icon('music')}</button><button id="fullscreen-button" class="icon-button" aria-label="全螢幕">${icon('full')}</button></nav></header>
      <div class="mission-bar hidden" id="mission-bar"><div><span>CHECKPOINT</span><b id="checkpoint-count">00 / 08</b></div><div class="mission-time"><span>剩餘時間</span><b id="mission-time">03:00</b></div><div class="heat"><span>追逐等級</span><b id="heat-stars">☆☆☆</b></div></div>
      <section class="guide" id="guide"><h1>你的手機，<br>就是方向盤。</h1><p class="guide-intro">沿著霓虹駛入港灣。<br>穿越 8 個檢查點，甩開追逐車，<br>在時間結束前抵達碼頭。</p>
        <div class="instruction-tabs" role="tablist" aria-label="選擇操作指引"><button role="tab" id="guide-phone-tab" aria-selected="true" class="selected">手機體感</button><button role="tab" id="guide-keyboard-tab" aria-selected="false">鍵盤操作</button></div>
        <div id="phone-instructions" class="instructions"><div><em>01</em><p><strong>掃描 QR Code</strong><span>按「連接手機」，用手機相機掃碼。</span></p></div><div><em>02</em><p><strong>擺好握姿，確認 0°</strong><span>啟用體感後，按「確定校正為 0°」。</span></p></div><div><em>03</em><p><strong>傾斜轉向，按住油門</strong><span>左右傾斜控制方向，螢幕按鈕控制速度。</span></p></div></div>
        <div id="keyboard-instructions" class="instructions hidden"><div><em><kbd>W</kbd><kbd>S</kbd></em><p><strong>加速與倒車</strong><span>W 加速；S 減速，再按住即可倒車。</span></p></div><div><em><kbd>A</kbd><kbd>D</kbd></em><p><strong>左右轉向</strong><span>彎道前減速，轉向會更順手。</span></p></div><div><em><kbd>␣</kbd><kbd>⇧</kbd></em><p><strong>手煞車與氮氣</strong><span>Space 甩尾，Shift 加速；R 重置，Esc 暫停。</span></p></div></div>
        <div class="guide-cta"><button id="guide-connect" class="button primary">${icon('phone')}連接手機</button><button id="guide-start" class="button secondary" disabled>用鍵盤開始</button></div>
        <div class="guide-bottom"><button id="free-drive" class="text-button" disabled>自由駕駛 →</button><label class="quality-control" for="quality">畫質<select id="quality"><option value="high">精緻</option><option value="low">省電</option></select></label></div>
        <p class="music-credit">♫ <a href="https://opengameart.org/content/synthwave-house-loop" target="_blank" rel="noopener">Synthwave House Loop · Fupi</a><span>CC0</span></p>
      </section>
      <div class="loading-note" id="loading-note" role="status"><span class="loading-spinner"></span><span id="loading-text">啟動 3D 引擎…</span></div>
      <div class="game-hud hidden" id="game-hud"><div class="map-wrap"><canvas id="minimap" width="220" height="220" aria-label="城市地圖與目標路線"></canvas><div class="map-location" id="map-location">中央大道</div></div>
      <div class="drive-hint">WASD 駕駛 <span>·</span> Space 手煞車 <span>·</span> Shift 氮氣</div>
      <div class="speedometer"><div class="speed-line"><b id="speed-value">000</b><span>km/h</span></div><div class="nitro-label"><span>NITRO</span><span id="nitro-percent">100%</span></div><div class="nitro-meter"><div id="nitro-fill"></div></div><div class="health-line"><span>車體耐久</span><div><i id="health-fill"></i></div><b id="health-value">100</b></div></div></div>
      <div id="touch-controls" class="touch-controls hidden"><div><button id="touch-left" aria-label="向左">◀</button><button id="touch-right" aria-label="向右">▶</button></div><div><button id="touch-brake">煞車</button><button id="touch-gas">油門</button><button id="touch-boost">氮氣</button></div></div>
      <div class="toast" id="toast" role="status"></div>
      <dialog id="pair-dialog" class="modal pair-modal"><button class="modal-close" id="close-pair" aria-label="關閉手機配對">${icon('close')}</button><h2>手機連線</h2><p>手機掃碼，讓它成為你的方向盤。</p><div class="qr-stage"><canvas id="qr-code" width="220" height="220"></canvas><span id="qr-pending">正在建立房間…</span></div><div class="room-code"><span>房間代碼</span><b id="pair-code">—</b></div><p id="pair-status" class="pair-status" role="status">正在準備連線…</p><button id="copy-link" class="button secondary wide">複製手機連結</button><button id="retry-room" class="text-button">重新建立房間</button><details class="pair-help"><summary>連不上時怎麼辦？</summary><p>請用 Safari 或 Chrome 開啟手機頁面，先試同一個 Wi-Fi。若網路限制 WebRTC，換個網路再試。手機也能用觸控方向按鈕。</p></details><button id="pair-play" class="button primary wide" disabled>開始任務</button></dialog>
      <dialog id="pause-dialog" class="modal pause-modal"><h2>稍作停留。</h2><p>城市等你重新踩下油門。</p><button id="resume-button" class="button primary wide">繼續駕駛</button><button id="restart-button" class="button secondary wide">重新開始</button><button id="show-guide" class="text-button">查看操作指引</button></dialog>
      <dialog id="result-dialog" class="modal result-modal"><div class="result-mark" id="result-mark">✓</div><h2 id="result-title">抵達港灣。</h2><p id="result-description">今晚，城市屬於你。</p><div class="result-stats"><div><span>完成時間</span><b id="result-time">—</b></div><div><span>車體耐久</span><b id="result-health">—</b></div><div><span>最佳紀錄</span><b id="result-best">—</b></div></div><button id="result-retry" class="button primary wide">再跑一次</button><button id="result-free" class="button secondary wide">自由探索城市</button></dialog>`;
    this.minimap=document.getElementById('minimap') as HTMLCanvasElement;this.map=this.minimap.getContext('2d')!;
    const $=(id:string)=>document.getElementById(id)!;
    $('guide-start').onclick=()=>this.onStart?.();$('free-drive').onclick=()=>this.onStart?.(true);
    $('guide-connect').onclick=$('connect-button').onclick=()=>this.onConnect?.();$('pause-button').onclick=()=>this.onPause?.();
    $('resume-button').onclick=()=>this.onPause?.();$('restart-button').onclick=$('result-retry').onclick=()=>this.onReset?.();$('result-free').onclick=()=>this.onStart?.(true);
    $('pair-play').onclick=()=>{this.hideDialog('pair-dialog');this.onStart?.();};
    $('show-guide').onclick=()=>{this.hideDialog('pause-dialog');this.showGuide();};
    $('close-pair').onclick=()=>this.hideDialog('pair-dialog');
    $('quality').onchange=e=>this.onQuality?.((e.target as HTMLSelectElement).value);
    $('sound-button').onclick=()=>{const muted=this.onSound?.();$('sound-button').classList.toggle('muted',!!muted);this.toast(muted?'音效已關閉':'音效已開啟');};
    $('music-button').onclick=()=>{const muted=this.onMusic?.();$('music-button').classList.toggle('muted',!!muted);$('music-button').setAttribute('aria-pressed',String(!muted));this.toast(muted?'配樂已關閉':'配樂已開啟 · Synthwave House Loop');};
    $('fullscreen-button').onclick=()=>{if(document.fullscreenElement)void document.exitFullscreen();else if(document.documentElement.requestFullscreen)void document.documentElement.requestFullscreen().catch(()=>this.toast('此瀏覽器不支援全螢幕。'));};
    const tab=(phone:boolean)=>{$('guide-phone-tab').classList.toggle('selected',phone);$('guide-keyboard-tab').classList.toggle('selected',!phone);$('guide-phone-tab').setAttribute('aria-selected',String(phone));$('guide-keyboard-tab').setAttribute('aria-selected',String(!phone));$('phone-instructions').classList.toggle('hidden',!phone);$('keyboard-instructions').classList.toggle('hidden',phone);};
    $('guide-phone-tab').onclick=()=>tab(true);$('guide-keyboard-tab').onclick=()=>tab(false);
    for(const id of ['pair-dialog','pause-dialog','result-dialog'])($(`${id}`) as HTMLDialogElement).addEventListener('cancel',e=>{if(id!=='pair-dialog'){e.preventDefault();if(id==='pause-dialog')this.onPause?.();}});
  }
  canvas(){return document.getElementById('game-canvas') as HTMLCanvasElement;}
  loading(text:string){document.getElementById('loading-text')!.textContent=text;}
  ready(){document.getElementById('loading-note')!.classList.add('hidden');for(const id of ['guide-start','free-drive','pair-play'])document.getElementById(id)!.removeAttribute('disabled');}
  start(){document.getElementById('guide')!.classList.add('hidden');document.getElementById('game-hud')!.classList.remove('hidden');document.getElementById('mission-bar')!.classList.remove('hidden');this.hideDialog('pause-dialog');this.hideDialog('result-dialog');this.hideDialog('pair-dialog');if(matchMedia('(pointer:coarse)').matches)document.getElementById('touch-controls')!.classList.remove('hidden');}
  showGuide(){document.getElementById('guide')!.classList.remove('hidden');document.getElementById('game-hud')!.classList.add('hidden');document.getElementById('touch-controls')!.classList.add('hidden');}
  showDialog(id:string){const d=document.getElementById(id) as HTMLDialogElement;if(!d.open)d.showModal();}
  hideDialog(id:string){(document.getElementById(id) as HTMLDialogElement).close();}
  toast(text:string){const el=document.getElementById('toast')!;el.textContent=text;el.classList.add('visible');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>el.classList.remove('visible'),3200);}
  toastTimer?:ReturnType<typeof setTimeout>;
  update(v:Vehicle,m:Mission,npcs:Npc[],remote:boolean){
    const $=(id:string)=>document.getElementById(id)!;
    const canvas=this.canvas();canvas.dataset.phase=m.phase;canvas.dataset.x=v.x.toFixed(2);canvas.dataset.z=v.z.toFixed(2);canvas.dataset.speed=v.speed.toFixed(2);
    $('speed-value').textContent=String(Math.round(v.speed*3.6)).padStart(3,'0');$('nitro-percent').textContent=`${Math.round(v.nitro)}%`;$('nitro-fill').style.width=`${v.nitro}%`;
    $('health-value').textContent=String(Math.round(v.health));$('health-fill').style.width=`${v.health}%`;
    $('checkpoint-count').textContent=m.phase==='free'?'自由駕駛':`${String(m.index).padStart(2,'0')} / 08`;
    $('mission-time').textContent=m.phase==='free'?'∞':`${String(Math.floor(m.time/60)).padStart(2,'0')}:${String(Math.floor(m.time%60)).padStart(2,'0')}`;
    $('heat-stars').textContent=m.elapsed>18&&m.phase!=='free'?'★'.repeat(Math.min(3,1+Math.floor(m.elapsed/50)))+'☆'.repeat(Math.max(0,2-Math.floor(m.elapsed/50))):'☆☆☆';
    const target=CHECKPOINTS[m.index];$('map-location').textContent=target?.label??'港灣碼頭';
    $('mission-label').textContent=m.phase==='free'?'自由駕駛 · 探索港灣夜景':target?`穿越檢查點，抵達港口 · ${Math.round(Math.hypot(v.x-target.x,v.z-target.z))}m`:'穿越檢查點，抵達港口';
    document.querySelector('.drive-hint')!.textContent=remote?'手機體感轉向 · 螢幕按鈕控制速度':'WASD 駕駛 · Space 手煞車 · Shift 氮氣';
    this.drawMap(v,m,npcs);
  }
  drawMap(v:Vehicle,m:Mission,npcs:Npc[]){
    const c=this.map,size=220,scale=.45,to=(x:number,z:number)=>[110+(x-v.x)*scale,110+(z-v.z)*scale];
    c.clearRect(0,0,size,size);c.save();c.beginPath();c.arc(110,110,103,0,Math.PI*2);c.clip();c.fillStyle='rgba(8,16,24,.82)';c.fillRect(0,0,size,size);
    c.fillStyle='#163743';const sea=to(216,0);c.fillRect(sea[0],0,220,220);
    c.strokeStyle='#37434d';c.lineWidth=8;
    for(const p of [-180,-90,0,90,180]){let [x]=to(p,0);c.beginPath();c.moveTo(x,0);c.lineTo(x,220);c.stroke();let [,y]=to(0,p);c.beginPath();c.moveTo(0,y);c.lineTo(220,y);c.stroke();}
    if(m.phase!=='free'){
      c.strokeStyle='#5ce8e1';c.lineWidth=3;c.beginPath();c.moveTo(110,110);let previous={x:v.x,z:v.z};
      CHECKPOINTS.slice(m.index).forEach(p=>{const [x,y]=to(p.x,p.z);if(Math.abs(p.x-previous.x)>25&&Math.abs(p.z-previous.z)>25){const [cx,cy]=to(previous.x,p.z);c.lineTo(cx,cy);}c.lineTo(x,y);previous=p;});c.stroke();
      const target=CHECKPOINTS[m.index];if(target){const [x,y]=to(target.x,target.z);c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillStyle='#071b24';c.fillRect(-5,-5,10,10);c.strokeStyle='#79fff4';c.lineWidth=2;c.strokeRect(-5,-5,10,10);c.restore();}
    }
    for(const n of npcs){if(n.police&&!n.car.root.isEnabled())continue;const [x,y]=to(n.x,n.z);c.fillStyle=n.police?'#ff785d':'#80909a';c.beginPath();c.arc(x,y,n.police?3:2,0,Math.PI*2);c.fill();}
    c.translate(110,110);c.rotate(v.yaw);c.beginPath();c.moveTo(0,-10);c.lineTo(-7,8);c.lineTo(0,4);c.lineTo(7,8);c.closePath();c.fillStyle='#7bf4ef';c.fill();c.restore();c.strokeStyle='rgba(181,216,226,.35)';c.lineWidth=1;c.beginPath();c.arc(110,110,104,0,Math.PI*2);c.stroke();
  }
  impact(){const el=document.getElementById('impact-flash')!;el.classList.remove('hit');void el.offsetWidth;el.classList.add('hit');}
  result(v:Vehicle,m:Mission,best:number){
    const won=m.phase==='won';document.getElementById('result-title')!.textContent=won?'抵達港灣。':'再試一次。';document.getElementById('result-description')!.textContent=won?'甩開追逐，讓夜晚記住你的名字。':v.health<=0?'車體耐久耗盡。入彎前減速，避開車流。':'時間耗盡。跟著地圖的青色路線前往檢查點。';document.getElementById('result-mark')!.textContent=won?'✓':'↻';
    document.getElementById('result-time')!.textContent=won?`${m.elapsed.toFixed(1)}s`:'未完成';document.getElementById('result-health')!.textContent=`${Math.round(v.health)}%`;document.getElementById('result-best')!.textContent=best?`${best.toFixed(1)}s`:'—';this.showDialog('result-dialog');
  }
}
