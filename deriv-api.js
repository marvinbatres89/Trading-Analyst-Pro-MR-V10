import{WS_URL}from"./config.js";
class Deriv{
 constructor(){this.ws=null;this.symbol="1HZ100V";this.sub=null;this.manual=false;this.retry=0;this.ping=null;this.timer=null;this.ev={state:[],tick:[],log:[],error:[]}}
 on(e,f){if(this.ev[e]&&typeof f==="function")this.ev[e].push(f)}
 emit(e,d={}){(this.ev[e]||[]).forEach(f=>{try{f(d)}catch(x){console.error(x)}})}
 state(s,label=s.toUpperCase()){this.emit("state",{state:s,label})}
 log(message,level="normal"){this.emit("log",{message,level})}
 open(){clearTimeout(this.timer);this.state("connecting","CONNECTING");this.log(`Conectando con ${this.symbol}...`);this.ws=new WebSocket(WS_URL);
  this.ws.onopen=()=>{this.retry=0;this.state("live","LIVE");this.log("Conexión con Deriv establecida.","ok");this.subscribe();this.startPing()};
  this.ws.onmessage=e=>this.message(e);this.ws.onerror=()=>this.emit("error",{message:"Error de WebSocket."});
  this.ws.onclose=e=>{this.stopPing();this.ws=null;this.sub=null;this.state("offline","OFFLINE");this.log(`Conexión cerrada (${e.code}).`,this.manual?"warn":"error");if(!this.manual)this.reconnect()}
 }
 connect(symbol=this.symbol){this.symbol=symbol;this.manual=false;if(this.ws&&[0,1].includes(this.ws.readyState))return;this.open()}
 send(o){if(this.ws?.readyState!==1)return false;this.ws.send(JSON.stringify(o));return true}
 subscribe(){this.send({ticks:this.symbol,subscribe:1,req_id:Date.now()})}
 message(e){let d;try{d=JSON.parse(e.data)}catch{return}if(d.error){this.emit("error",{message:d.error.message});return}if(d.subscription?.id)this.sub=d.subscription.id;if(d.msg_type==="tick"&&d.tick){const p=Number(d.tick.quote);if(Number.isFinite(p))this.emit("tick",{symbol:d.tick.symbol||this.symbol,price:p,epoch:Number(d.tick.epoch)||Date.now()/1000,pipSize:Number(d.tick.pip_size)||2})}}
 changeSymbol(s){if(!s||s===this.symbol)return;this.symbol=s;if(this.ws?.readyState===1){if(this.sub)this.send({forget:this.sub});this.sub=null;setTimeout(()=>this.subscribe(),200)}}
 startPing(){this.stopPing();this.ping=setInterval(()=>this.send({ping:1}),25000)}
 stopPing(){clearInterval(this.ping);this.ping=null}
 reconnect(){this.retry++;const wait=Math.min(15000,1500*this.retry);this.log(`Reconectando en ${Math.ceil(wait/1000)} s.`,"warn");this.timer=setTimeout(()=>{if(!this.manual)this.open()},wait)}
 disconnect(){this.manual=true;clearTimeout(this.timer);this.stopPing();if(this.sub)this.send({forget:this.sub});try{this.ws?.close(1000,"Manual")}catch{}this.ws=null;this.sub=null;this.state("offline","OFFLINE")}
}
export const derivAPI=new Deriv();
