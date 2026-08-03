(function(){
  "use strict";

  const VERSION="10.2.1";
  const entries=[];
  const listeners=new Set();

  function notify(){
    listeners.forEach(fn=>{
      try{fn([...entries])}catch(error){console.error(error)}
    });
  }

  function add(level,message,data){
    const item={
      time:new Date().toLocaleTimeString("es-SV"),
      level,
      message:String(message),
      data:data===undefined?null:data
    };
    entries.push(item);
    if(entries.length>250) entries.shift();
    notify();
    const method=level==="error"?"error":level==="warn"?"warn":"log";
    console[method]("[TA DIAG]",message,data??"");
  }

  window.__TA_DIAGNOSTIC__={
    version:VERSION,
    add,
    info:(m,d)=>add("info",m,d),
    ok:(m,d)=>add("ok",m,d),
    warn:(m,d)=>add("warn",m,d),
    error:(m,d)=>add("error",m,d),
    getEntries:()=>[...entries],
    subscribe(fn){listeners.add(fn);fn([...entries]);return()=>listeners.delete(fn)},
    clear(){entries.length=0;notify()}
  };

  window.addEventListener("error",event=>{
    const file=event.filename?event.filename.split("/").pop():"archivo desconocido";
    add("error",`Error global en ${file}, línea ${event.lineno||"?"}, columna ${event.colno||"?"}.`,{
      message:event.message||"Error desconocido"
    });
  });

  window.addEventListener("unhandledrejection",event=>{
    add("error","Promesa rechazada.",{
      message:event.reason?.message||String(event.reason||"Sin detalle")
    });
  });

  async function load(name){
    try{
      await import(`./${name}?v=${VERSION}`);
      add("ok",`${name} importado correctamente.`);
      return true;
    }catch(error){
      add("error",`No se pudo importar ${name}.`,{
        name:error.name,
        message:error.message,
        stack:error.stack||""
      });
      return false;
    }
  }

  async function start(){
    add("info",`Inicio seguro V${VERSION}.`);
    add("info",`URL de la aplicación: ${location.href}`);
    add("ok",`WebSocket disponible: ${"WebSocket" in window?"SÍ":"NO"}`);

    if(!("WebSocket" in window)) return;

    const order=[
      "config.js","deriv-api.js","indicators.js","engine1.js",
      "consensus.js","engine2.js","prediction.js","voice.js"
    ];

    for(const name of order){
      if(!(await load(name))) return;
    }

    try{
      await import(`./app.js?v=${VERSION}`);
      add("ok","app.js iniciado correctamente.");
    }catch(error){
      add("error","No se pudo iniciar app.js.",{
        name:error.name,
        message:error.message,
        stack:error.stack||""
      });
    }
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",start,{once:true});
  }else{
    start();
  }
})();
