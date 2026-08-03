(function(){
  "use strict";
  const VERSION="10.2.0", PANEL="diagnosticoInternoV1020";

  function box(){
    let p=document.getElementById(PANEL);
    if(p) return p;
    p=document.createElement("section");
    p.id=PANEL;
    p.hidden=true;
    p.style.cssText="margin:14px;padding:14px;border:2px solid #ff6b78;border-radius:14px;background:#321218;color:#ffe8ea;font-family:monospace;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word;position:relative;z-index:9999";
    const h=document.createElement("strong");
    h.textContent="DIAGNÓSTICO INTERNO V10.2.0";
    h.style.display="block";
    h.style.marginBottom="8px";
    const c=document.createElement("div");
    c.id="contenidoDiagnosticoV1020";
    p.append(h,c);
    document.body.prepend(p);
    return p;
  }

  function fail(message,error){
    const p=box(), c=p.querySelector("#contenidoDiagnosticoV1020");
    p.hidden=false;
    const detail=error?`\n${error.name||"Error"}: ${error.message||String(error)}\n${error.stack||""}`:"";
    c.textContent+=`${c.textContent?"\n\n":""}❌ ${message}${detail}`;
    console.error("[V10.2.0]",message,error||"");
  }

  window.__TA_DIAGNOSTIC__={version:VERSION,fail};

  window.addEventListener("error",e=>{
    const file=e.filename?e.filename.split("/").pop():"archivo desconocido";
    fail(`Error global en ${file}, línea ${e.lineno||"?"}, columna ${e.colno||"?"}.`,e.error||new Error(e.message||"Error desconocido"));
  });

  window.addEventListener("unhandledrejection",e=>{
    fail("Promesa rechazada durante el inicio.",e.reason instanceof Error?e.reason:new Error(String(e.reason||"Sin detalle")));
  });

  async function load(name){
    try{
      await import(`./${name}?v=${VERSION}`);
      return true;
    }catch(error){
      fail(`No se pudo importar ${name}.`,error);
      return false;
    }
  }

  async function start(){
    if(!("WebSocket" in window)){
      fail("Este navegador no dispone de WebSocket.");
      return;
    }
    const order=["config.js","deriv-api.js","indicators.js","engine1.js","consensus.js","engine2.js","prediction.js","voice.js"];
    for(const name of order){
      if(!(await load(name))) return;
    }
    try{
      await import(`./app.js?v=${VERSION}`);
      console.log("[V10.2.0] Inicio correcto");
    }catch(error){
      fail("No se pudo iniciar app.js.",error);
    }
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",start,{once:true});
  }else{
    start();
  }
})();
