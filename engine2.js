import{CFG}from"./config.js";import{consensus}from"./consensus.js";
class Validator{
 constructor(){this.state="IDLE";this.locked=null;this.latest=null;this.snap=null;this.t1=null;this.t2=null;this.ev={state:[],prepare:[],revalidate:[],confirm:[],cancel:[],result:[]}}
 on(e,f){if(this.ev[e])this.ev[e].push(f)}emit(e,d={}){(this.ev[e]||[]).forEach(f=>f(d))}set(s,m){this.state=s;this.emit("state",{state:s,message:m,opportunity:this.locked})}
 busy(){return["PREPARE","REVALIDATING","EXECUTING","RESULT"].includes(this.state)}
 update(o,s){this.latest=o;this.snap=s}
 receive(o,s){this.update(o,s);if(this.busy()||!o||o.direction==="WAIT"||o.score<CFG.thresholds[o.strategy].prepare)return;this.locked=structuredClone(o);let t=CFG.timing[o.strategy];this.set("PREPARE","Oportunidad bloqueada. Prepare el bot.");this.emit("prepare",{opportunity:this.locked});this.t1=setTimeout(()=>{if(this.state!=="PREPARE")return;this.set("REVALIDATING","Revalidando con los últimos ticks.");this.emit("revalidate",{opportunity:this.locked});this.t2=setTimeout(()=>this.finish(),t.revalidate)},t.prepare)}
 finish(){if(this.state!=="REVALIDATING")return;let c=consensus(this.locked,this.latest,this.snap);if(c.approved){this.locked={...this.locked,consensusScore:c.score};this.set("EXECUTING","Consenso confirmado. Ejecute ahora.");this.emit("confirm",{opportunity:this.locked})}else this.cancel(c.reason)}
 cancel(reason="Oportunidad cancelada."){let o=this.locked;clearTimeout(this.t1);clearTimeout(this.t2);this.locked=null;this.set("CANCELLED",reason);this.emit("cancel",{opportunity:o,reason});setTimeout(()=>this.set("IDLE","Buscando una nueva oportunidad."),1600)}
 result(success,details={}){if(this.state!=="EXECUTING")return;let o=this.locked;this.set("RESULT",success?"Resultado acertado.":"Resultado fallido.");this.emit("result",{success,opportunity:o,details});this.locked=null;setTimeout(()=>this.set("IDLE","Buscando una nueva oportunidad."),4000)}
 reset(){clearTimeout(this.t1);clearTimeout(this.t2);this.locked=null;this.latest=null;this.snap=null;this.set("IDLE","Motor validador listo.")}
}
export const engine2=new Validator();
