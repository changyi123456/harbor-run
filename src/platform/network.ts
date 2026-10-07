import type { Peer, DataConnection } from 'peerjs';
import { readInputPacket } from './protocol';
import type { Input, Phase } from '../game/simulation';
export interface Telemetry { type:'telemetry'; speed:number; health:number; nitro:number; phase:Phase; checkpoint:number; total:number; time:number }
export class RemoteHost {
  peer?:Peer; connection?:DataConnection; code=''; status='尚未建立房間';
  onStatus?:(status:string,connected:boolean)=>void; onInput?:(input:Input)=>void; onAction?:(action:string)=>void;
  lastSequence=-1; lastSeen=0; private timeout?:ReturnType<typeof setTimeout>;
  async open(){
    if(this.peer&&!this.peer.destroyed)return this.code;
    const {Peer}=await import('peerjs');
    this.code=Array.from(crypto.getRandomValues(new Uint8Array(12)),v=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v%32]).join('');
    this.peer=new Peer(`harbor-v1-${this.code}`,{secure:true,debug:0});
    this.setStatus('正在建立安全配對…',false);
    this.timeout=setTimeout(()=>this.setStatus('配對服務較慢，請稍候或重試。鍵盤仍可遊玩。',false),12000);
    this.peer.on('open',()=>{clearTimeout(this.timeout);this.setStatus('等待手機掃碼連線',false);});
    this.peer.on('error',err=>{clearTimeout(this.timeout);this.setStatus(err.type==='unavailable-id'?'房間代碼衝突，請重新建立。':'配對服務暫時無法連線，請重試。',false);});
    this.peer.on('disconnected',()=>{if(!this.connection?.open)this.setStatus('配對服務中斷，請重試。',false);});
    this.peer.on('connection',conn=>{
      if(conn.metadata?.room!==this.code||conn.metadata?.protocol!==1||this.connection?.open){conn.on('open',()=>conn.close());return;}
      this.connection=conn;this.lastSequence=-1;
      conn.on('open',()=>{this.lastSeen=performance.now();this.setStatus('手機已連線 · 等待體感啟用',true);conn.send({type:'welcome',protocol:1});});
      conn.on('data',data=>{
        const packet=readInputPacket(data,this.lastSequence);
        if(packet){this.lastSequence=packet.sequence;this.lastSeen=performance.now();this.onInput?.(packet.input);return;}
        if(data&&typeof data==='object'&&'type' in data&&data.type==='action'&&'action' in data&&typeof data.action==='string'){
          if(['start','pause','reset'].includes(data.action))this.onAction?.(data.action);
        }
      });
      const close=()=>{if(this.connection===conn){this.connection=undefined;this.setStatus('手機已斷線，遊戲已暫停。可重新掃碼。',false);}};
      conn.on('close',close);conn.on('error',close);
    });
    return this.code;
  }
  setStatus(status:string,connected:boolean){this.status=status;this.onStatus?.(status,connected);}
  url(){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('controller',this.code);return url.href;}
  telemetry(data:Telemetry){if(this.connection?.open&&this.connection.dataChannel?.bufferedAmount<16384)this.connection.send(data);}
  reset(){this.connection?.close();this.peer?.destroy();this.peer=undefined;clearTimeout(this.timeout);this.code='';this.lastSequence=-1;}
}
export class RemoteClient {
  peer?:Peer;connection?:DataConnection;sequence=0;connected=false;
  onStatus?:(status:string,connected:boolean)=>void;onTelemetry?:(telemetry:Telemetry)=>void;
  timer?:ReturnType<typeof setTimeout>;
  async connect(code:string){
    this.disconnect();
    if(!/^[A-Z2-9]{12}$/.test(code)){this.onStatus?.('請輸入電腦畫面的 12 碼房間代碼。',false);return;}
    const {Peer}=await import('peerjs');
    this.peer=new Peer({secure:true,debug:0});this.onStatus?.('正在連線到電腦…',false);
    this.timer=setTimeout(()=>this.onStatus?.('連線逾時。請確認電腦房間仍開啟，或讓兩台裝置使用同一 Wi-Fi。',false),16000);
    this.peer.on('open',()=>{
      this.connection=this.peer!.connect(`harbor-v1-${code}`,{reliable:false,serialization:'json',metadata:{room:code,protocol:1}});
      this.connection.on('open',()=>{clearTimeout(this.timer);this.connected=true;this.onStatus?.('已連線 · 請啟用體感並校正',true);});
      this.connection.on('data',(data:unknown)=>{if(data&&typeof data==='object'&&'type' in data&&data.type==='telemetry')this.onTelemetry?.(data as Telemetry);});
      this.connection.on('close',()=>{this.connected=false;this.onStatus?.('連線已中斷，請按重新連線。',false);});
      this.connection.on('error',()=>{this.connected=false;this.onStatus?.('連線發生問題，請重新連線。',false);});
    });
    this.peer.on('error',err=>{clearTimeout(this.timer);this.connected=false;this.onStatus?.(err.type==='peer-unavailable'?'找不到房間。請重新掃描電腦的 QR Code。':'連線失敗，請確認網路後重試。',false);});
  }
  send(input:Input){if(this.connection?.open&&this.connection.dataChannel?.bufferedAmount<16384)this.connection.send({type:'input',sequence:++this.sequence,input});}
  action(action:string){if(this.connection?.open)this.connection.send({type:'action',action});}
  disconnect(){clearTimeout(this.timer);this.connection?.close();this.peer?.destroy();this.connected=false;this.sequence=0;}
}
