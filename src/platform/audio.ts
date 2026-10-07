/** Original synthesized effects plus a licensed CC0 driving music loop. */
export class GameAudio {
  context?:AudioContext; engine?:OscillatorNode; gain?:GainNode; master?:GainNode; muted=false;
  music:HTMLAudioElement;musicMuted=false;unlocked=false;
  constructor(){
    this.music=document.createElement('audio');this.music.id='driving-music';this.music.src=import.meta.env.BASE_URL+'assets/synthwave-house.m4a';this.music.loop=true;this.music.preload='none';this.music.volume=.24;this.music.hidden=true;document.body.append(this.music);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.music.pause();else if(this.unlocked&&!this.musicMuted)void this.music.play().catch(()=>{});});
  }
  async unlock(){
    this.unlocked=true;
    if(!this.musicMuted)void this.music.play().catch(()=>{});
    try{
      if(!this.context){
        this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=.16;this.master.connect(this.context.destination);
        this.engine=this.context.createOscillator();this.engine.type='sawtooth';this.gain=this.context.createGain();this.gain.gain.value=.04;
        const filter=this.context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=500;this.engine.connect(filter);filter.connect(this.gain);this.gain.connect(this.master);this.engine.start();
      }
      await this.context.resume();
    }catch{/* Audio is optional; a browser refusing it must not block play. */}
  }
  update(speed:number,throttle:number,boost:boolean,active:boolean){this.music.volume=active?.24:.08;if(this.engine&&this.gain&&this.context){this.engine.frequency.setTargetAtTime(35+speed*2.5+(boost?25:0),this.context.currentTime,.12);this.gain.gain.setTargetAtTime(active?.025+Math.abs(throttle)*.08:0,this.context.currentTime,.1);}}
  toggle(){this.muted=!this.muted;if(this.master&&this.context)this.master.gain.setTargetAtTime(this.muted?0:.16,this.context.currentTime,.1);return this.muted;}
  toggleMusic(){this.musicMuted=!this.musicMuted;if(this.musicMuted)this.music.pause();else{this.unlocked=true;void this.music.play().catch(()=>{});}return this.musicMuted;}
  chime(hit=false){if(!this.context||!this.master)return;const o=this.context.createOscillator(),g=this.context.createGain(),t=this.context.currentTime;o.type=hit?'triangle':'sine';o.frequency.setValueAtTime(hit?90:660,t);o.frequency.exponentialRampToValueAtTime(hit?30:1050,t+.16);g.gain.setValueAtTime(hit?.2:.28,t);g.gain.exponentialRampToValueAtTime(.001,t+.35);o.connect(g);g.connect(this.master);o.start();o.stop(t+.36);}
}
