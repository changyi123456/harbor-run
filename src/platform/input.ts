import { ZERO_INPUT, type Input, clamp } from '../game/simulation';
export class InputManager {
  keys=new Set<string>(); remote:Input={...ZERO_INPUT}; remoteAt=0; touch:Input={...ZERO_INPUT};
  remoteConnected=false; onPause?:()=>void; onReset?:()=>void;
  constructor(){
    window.addEventListener('keydown',e=>{
      if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
      if(!e.repeat&&e.code==='Escape')this.onPause?.();if(!e.repeat&&e.code==='KeyR')this.onReset?.();this.keys.add(e.code);
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>this.clear());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});
  }
  clear(){this.keys.clear();this.touch={...ZERO_INPUT};this.remote={...ZERO_INPUT};}
  sample():Input{
    if(this.remoteConnected && performance.now()-this.remoteAt<500)return {...this.remote};
    const k=this.keys;
    return {steer:clamp((k.has('KeyD')||k.has('ArrowRight')?1:0)-(k.has('KeyA')||k.has('ArrowLeft')?1:0)+this.touch.steer,-1,1),
      throttle:clamp((k.has('KeyW')||k.has('ArrowUp')?1:0)-(k.has('KeyS')||k.has('ArrowDown')?1:0)+this.touch.throttle,-1,1),
      brake:this.touch.brake,handbrake:k.has('Space')||this.touch.handbrake,nitro:k.has('ShiftLeft')||k.has('ShiftRight')||this.touch.nitro};
  }
  receive(input:Input){this.remote={...input};this.remoteAt=performance.now();}
}
export function bindHold(button:HTMLElement,change:(pressed:boolean)=>void){
  const ids=new Set<number>();
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);ids.add(e.pointerId);button.classList.add('held');change(true);});
  const release=(e:PointerEvent)=>{ids.delete(e.pointerId);if(!ids.size){button.classList.remove('held');change(false);}};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  window.addEventListener('blur',()=>{ids.clear();button.classList.remove('held');change(false);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){ids.clear();button.classList.remove('held');change(false);}});
}
