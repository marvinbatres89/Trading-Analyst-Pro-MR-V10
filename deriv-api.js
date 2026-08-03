import{WS_URL}from"./config.js";

const diag=window.__TA_DIAGNOSTIC__||{
  info(){},ok(){},warn(){},error(){}
};

class Deriv{
  constructor(){
    this.ws=null;
    this.symbol="1HZ100V";
    this.sub=null;
    this.manual=false;
    this.retry=0;
    this.ping=null;
    this.timer=null;
    this.ev={state:[],tick:[],log:[],error:[]};
  }

  on(e,f){
    if(this.ev[e]&&typeof f==="function")this.ev[e].push(f);
  }

  emit(e,d={}){
    (this.ev[e]||[]).forEach(f=>{
      try{f(d)}catch(error){diag.error(`Error en listener ${e}.`,{message:error.message})}
    });
  }

  state(s,label=s.toUpperCase()){
    this.emit("state",{state:s,label});
    diag.info(`Estado WebSocket: ${label}.`);
  }

  log(message,level="normal"){
    this.emit("log",{message,level});
    if(level==="error")diag.error(message);
    else if(level==="warn")diag.warn(message);
    else if(level==="ok")diag.ok(message);
    else diag.info(message);
  }

  open(){
    clearTimeout(this.timer);
    this.state("connecting","CONNECTING");
    diag.info("Abriendo WebSocket.",{url:WS_URL,symbol:this.symbol,attempt:this.retry+1});

    try{
      this.ws=new WebSocket(WS_URL);
    }catch(error){
      diag.error("No se pudo crear el WebSocket.",{message:error.message});
      this.emit("error",{message:error.message});
      this.reconnect();
      return;
    }

    this.ws.onopen=()=>{
      this.retry=0;
      this.state("live","LIVE");
      this.log("Conexión pública con Deriv establecida.","ok");
      diag.ok("Handshake WebSocket completado.",{url:WS_URL});
      this.subscribe();
      this.startPing();
    };

    this.ws.onmessage=e=>this.message(e);

    this.ws.onerror=event=>{
      diag.error("El navegador informó un error de WebSocket.",{
        readyState:this.ws?.readyState,
        url:WS_URL
      });
      this.emit("error",{message:"Error de WebSocket."});
    };

    this.ws.onclose=e=>{
      this.stopPing();
      this.ws=null;
      this.sub=null;
      this.state("offline","OFFLINE");
      diag.warn("WebSocket cerrado.",{
        code:e.code,
        reason:e.reason||"Sin motivo informado",
        wasClean:e.wasClean,
        manual:this.manual
      });
      this.log(`Conexión cerrada (${e.code}).`,this.manual?"warn":"error");
      if(!this.manual)this.reconnect();
    };
  }

  connect(symbol=this.symbol){
    this.symbol=symbol;
    this.manual=false;

    if(this.ws&&[WebSocket.CONNECTING,WebSocket.OPEN].includes(this.ws.readyState)){
      diag.warn("Se ignoró CONNECT porque ya existe una conexión activa.",{
        readyState:this.ws.readyState
      });
      return;
    }

    this.open();
  }

  send(payload){
    if(this.ws?.readyState!==WebSocket.OPEN){
      diag.warn("No se envió la solicitud porque el socket no está abierto.",payload);
      return false;
    }

    try{
      const text=JSON.stringify(payload);
      this.ws.send(text);
      diag.info("Solicitud WebSocket enviada.",payload);
      return true;
    }catch(error){
      diag.error("No se pudo enviar la solicitud WebSocket.",{
        message:error.message,
        payload
      });
      return false;
    }
  }

  subscribe(){
    const request={
      ticks:this.symbol,
      subscribe:1,
      req_id:Date.now()
    };
    diag.info("Solicitando suscripción de ticks.",request);
    this.send(request);
  }

  message(e){
    let d;

    try{
      d=JSON.parse(e.data);
    }catch(error){
      diag.error("Respuesta WebSocket no es JSON válido.",{
        preview:String(e.data).slice(0,250)
      });
      return;
    }

    if(d.error||d.errors){
      const first=d.error||d.errors?.[0]||{};
      const message=first.message||"Error de Deriv.";
      diag.error("Deriv respondió con error.",{
        code:first.code||first.status||"",
        message,
        response:d
      });
      this.emit("error",{message});
      return;
    }

    if(d.subscription?.id){
      this.sub=d.subscription.id;
      diag.ok("Suscripción registrada.",{subscriptionId:this.sub});
    }

    if(d.msg_type==="tick"&&d.tick){
      const price=Number(d.tick.quote);
      if(!Number.isFinite(price)){
        diag.warn("Tick recibido sin precio numérico.",d.tick);
        return;
      }

      this.emit("tick",{
        symbol:d.tick.symbol||this.symbol,
        price,
        epoch:Number(d.tick.epoch)||Date.now()/1000,
        pipSize:Number.isInteger(Number(d.tick.pip_size))?Number(d.tick.pip_size):2
      });
      return;
    }

    if(d.msg_type==="ping"||d.ping){
      return;
    }

    diag.info("Mensaje WebSocket recibido.",{
      msg_type:d.msg_type||"sin msg_type",
      keys:Object.keys(d)
    });
  }

  changeSymbol(s){
    if(!s||s===this.symbol)return;
    diag.info("Cambio de mercado solicitado.",{from:this.symbol,to:s});
    this.symbol=s;

    if(this.ws?.readyState===WebSocket.OPEN){
      if(this.sub)this.send({forget:this.sub});
      this.sub=null;
      setTimeout(()=>this.subscribe(),250);
    }
  }

  startPing(){
    this.stopPing();
    this.ping=setInterval(()=>{
      if(this.ws?.readyState===WebSocket.OPEN)this.send({ping:1});
    },25000);
    diag.info("Ping de mantenimiento activado.",{intervalMs:25000});
  }

  stopPing(){
    clearInterval(this.ping);
    this.ping=null;
  }

  reconnect(){
    this.retry+=1;
    const wait=Math.min(15000,1500*this.retry);
    this.log(`Reconectando en ${Math.ceil(wait/1000)} s.`,"warn");
    diag.warn("Reconexión programada.",{attempt:this.retry,waitMs:wait});
    clearTimeout(this.timer);
    this.timer=setTimeout(()=>{
      if(!this.manual)this.open();
    },wait);
  }

  disconnect(){
    this.manual=true;
    clearTimeout(this.timer);
    this.stopPing();

    if(this.sub)this.send({forget:this.sub});

    try{
      this.ws?.close(1000,"Cierre manual");
    }catch(error){
      diag.warn("No se pudo cerrar el socket limpiamente.",{message:error.message});
    }

    this.ws=null;
    this.sub=null;
    this.state("offline","OFFLINE");
    diag.info("Desconexión manual completada.");
  }
}

export const derivAPI=new Deriv();
