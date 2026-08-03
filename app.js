import{VERSION,MARKETS,CFG}from"./config.js";
import{derivAPI}from"./deriv-api.js";
import{snapshot}from"./indicators.js";
import{explore}from"./engine1.js";
import{engine2}from"./engine2.js";
import{visual,manualText}from"./prediction.js";
import{voice}from"./voice.js";

const $=id=>document.getElementById(id);
const U={};

[
  "estadoConexion","textoEstadoConexion","estadoMotor","textoEstadoMotor","estadoMemoria",
  "botonConectar","botonDesconectar","botonEncenderMotor","botonPrediccion","mensajeControl",
  "selectorEstrategia","selectorMercado","selectorModo","selectorHorizonte",
  "tituloMonitoreo","detalleMonitoreo","textoEstadoMonitoreo","barraProgresoMotor",
  "pasoSearch","pasoValidate","pasoPrepare","pasoExecute","botonCancelarMonitoreo",
  "nombreMercado","estadoDatos","precioActual","contadorTicks","ultimoDigito",
  "horaActualizacion","listaUltimosDigitos","panelSenal","estadoPrediccion",
  "tituloPrediccion","valorPrediccion","puntajeSenal","barraPuntaje",
  "cuentaRegresiva","mensajeOperacion","listaMotivos","tendencia","detalleTendencia",
  "rsi","detalleRsi","momentum","detalleMomentum","volatilidad","detalleVolatilidad",
  "estadisticaIntentos","estadisticaAciertos","estadisticaFallos","estadisticaPrecision",
  "precisionObservada","botonReiniciarEstadisticas","botonVoz","selectorVoz",
  "velocidadVoz","valorVelocidad","botonProbarVoz","registroActividad",
  "botonLimpiarRegistro","botonDiagnostico","panelDiagnostico","contenidoDiagnostico",
  "botonCopiarDiagnostico","botonLimpiarDiagnostico","capsulaSenal",
  "estadoCapsula","valorCapsula","detalleCapsula"
].forEach(id=>U[id]=$(id));

const S={
  connected:false,
  engineOn:false,
  requestActive:false,
  cooldown:false,
  completedOnce:false,
  symbol:"1HZ100V",
  strategy:"rise_fall",
  mode:"fast",
  horizon:"10s",
  prices:[],
  digits:[],
  ticks:0,
  lastPrice:null,
  pipSize:2,
  lastScanAt:0,
  snapshot:null,
  opportunity:null,
  activeSignal:null,
  statistics:{}
};

let toastTimer=null;
let countdownTimer=null;
let searchTimer=null;
let cooldownTimer=null;

const diagnostics=window.__TA_DIAGNOSTIC__;

function setText(element,value){
  if(element)element.textContent=String(value);
}

function log(message,level=""){
  if(!U.registroActividad)return;
  const line=document.createElement("p");
  line.textContent=`[${new Date().toLocaleTimeString("es-SV")}] ${message}`;
  line.className=level;
  U.registroActividad.prepend(line);
}

function statsKey(){
  return [S.symbol,S.strategy,S.mode,S.horizon].join("|");
}

function stats(){
  if(!S.statistics[statsKey()]){
    S.statistics[statsKey()]={tests:0,ok:0,fail:0};
  }
  return S.statistics[statsKey()];
}

function renderStats(){
  const value=stats();
  const accuracy=value.tests?(value.ok/value.tests)*100:null;
  setText(U.estadisticaIntentos,value.tests);
  setText(U.estadisticaAciertos,value.ok);
  setText(U.estadisticaFallos,value.fail);
  setText(U.estadisticaPrecision,accuracy===null?"NO DATA":`${accuracy.toFixed(1)}%`);
  setText(U.precisionObservada,`${value.ok} / ${value.tests} TESTS`);
}

function minimumTicks(){
  return S.mode==="complete"?CFG.minComplete:CFG.minFast;
}

function canRequestPrediction(){
  return (
    S.connected &&
    S.engineOn &&
    !S.requestActive &&
    !S.cooldown &&
    engine2.state==="IDLE" &&
    S.prices.length>=minimumTicks()
  );
}

function renderControls(){
  setText(U.textoEstadoMotor,S.engineOn?"ON":"OFF");
  U.estadoMotor?.classList.toggle("engine",S.engineOn);

  if(U.botonEncenderMotor){
    U.botonEncenderMotor.textContent=S.engineOn?"STOP ENGINE":"START ENGINE";
  }

  if(U.botonPrediccion){
    U.botonPrediccion.disabled=!canRequestPrediction();

    if(S.requestActive){
      U.botonPrediccion.textContent="BUSCANDO...";
    }else if(S.cooldown){
      U.botonPrediccion.textContent="ESPERE...";
    }else if(S.completedOnce){
      U.botonPrediccion.textContent="NUEVA PREDICCIÓN";
    }else{
      U.botonPrediccion.textContent="PREDICTION";
    }
  }

  const lock=S.requestActive||S.cooldown||engine2.state!=="IDLE";
  [U.selectorEstrategia,U.selectorMercado,U.selectorModo,U.selectorHorizonte]
    .forEach(element=>{
      if(element)element.disabled=lock;
    });
}

function renderConnection(state,label){
  S.connected=state==="live";
  setText(U.textoEstadoConexion,label);
  if(U.estadoConexion)U.estadoConexion.className=`status-pill ${state}`;
  if(U.botonConectar)U.botonConectar.disabled=state==="live"||state==="connecting";
  if(U.botonDesconectar)U.botonDesconectar.disabled=state!=="live";
  if(U.botonEncenderMotor)U.botonEncenderMotor.disabled=state!=="live";

  if(!S.connected&&S.engineOn)stopEngine(false);
  renderControls();
}

function startEngine(){
  if(!S.connected)return;

  S.engineOn=true;
  S.requestActive=false;
  S.cooldown=false;
  S.activeSignal=null;
  engine2.reset();

  setText(U.mensajeControl,"Motor encendido. Analizando en segundo plano. Pulse PREDICTION para solicitar una sola operación.");
  setText(U.tituloMonitoreo,"EN ESPERA");
  setText(U.textoEstadoMonitoreo,"IDLE");
  setText(U.detalleMonitoreo,"Pulse PREDICTION cuando desee buscar una entrada.");
  U.barraProgresoMotor.style.width="0%";

  voice.speak(`Motor encendido. ${MARKETS[S.symbol]}. Pulse predicción cuando esté listo.`);
  log("Motores encendidos en modo de una sola operación.","ok");
  diagnostics?.ok("Motor activado en modo ONE SHOT.");

  renderControls();
}

function stopEngine(announce=true){
  S.engineOn=false;
  S.requestActive=false;
  S.cooldown=false;
  S.activeSignal=null;
  clearInterval(countdownTimer);
  clearTimeout(searchTimer);
  clearTimeout(cooldownTimer);
  engine2.reset();

  setText(U.mensajeControl,"Motor apagado.");
  setText(U.tituloMonitoreo,"MOTOR APAGADO");
  setText(U.detalleMonitoreo,"Encienda el motor para preparar el análisis.");

  if(announce)voice.speak("Motor apagado.");
  renderControls();
}

function resetMarketData(){
  S.prices=[];
  S.digits=[];
  S.ticks=0;
  S.lastPrice=null;
  S.snapshot=null;
  S.opportunity=null;
  S.activeSignal=null;
  S.requestActive=false;
  S.cooldown=false;

  clearInterval(countdownTimer);
  clearTimeout(searchTimer);
  clearTimeout(cooldownTimer);
  engine2.reset();

  setText(U.precioActual,"--");
  setText(U.contadorTicks,0);
  setText(U.ultimoDigito,"--");
  setText(U.horaActualizacion,"--");
  setText(U.estadoMemoria,0);
  if(U.listaUltimosDigitos)U.listaUltimosDigitos.innerHTML="";
  renderControls();
}

function handleTick(tick){
  if(tick.symbol!==S.symbol)return;

  const formatted=tick.price.toFixed(tick.pipSize);
  const digit=Number(formatted.match(/(\d)(?!.*\d)/)?.[1]);

  S.lastPrice=tick.price;
  S.pipSize=tick.pipSize;
  S.ticks+=1;
  S.prices.push(tick.price);
  if(S.prices.length>CFG.maxPrices)S.prices.shift();

  if(Number.isInteger(digit)){
    S.digits.push(digit);
    if(S.digits.length>CFG.maxDigits)S.digits.shift();
  }

  setText(U.precioActual,formatted);
  setText(U.contadorTicks,S.ticks);
  setText(U.ultimoDigito,Number.isInteger(digit)?digit:"--");
  setText(U.horaActualizacion,new Date(tick.epoch*1000).toLocaleTimeString("es-SV"));
  setText(U.estadoDatos,"LIVE DATA");
  setText(U.estadoMemoria,S.prices.length);

  renderDigits();
  evaluateActiveSignal(tick.price,digit);

  if(S.engineOn)scanMarket(false);
  renderControls();
}

function renderDigits(){
  if(!U.listaUltimosDigitos)return;
  U.listaUltimosDigitos.innerHTML="";

  S.digits.slice(-20).forEach((digit,index,array)=>{
    const element=document.createElement("span");
    element.className=`digit${index===array.length-1?" current":""}`;
    element.textContent=digit;
    U.listaUltimosDigitos.appendChild(element);
  });
}

function scanMarket(force=false){
  if(S.prices.length<minimumTicks())return null;

  const now=Date.now();
  if(!force&&now-S.lastScanAt<CFG.scanMs)return null;
  S.lastScanAt=now;

  S.snapshot=snapshot(S.prices,S.digits,S.mode);
  S.opportunity=explore(S.strategy,S.snapshot);

  renderIndicators();
  renderScore();

  engine2.update(S.opportunity,S.snapshot);

  // Regla principal: solo se permite enviar una oportunidad al validador
  // cuando el usuario ha solicitado una predicción.
  if(S.requestActive&&engine2.state==="IDLE"){
    engine2.receive(S.opportunity,S.snapshot);
  }

  return S.opportunity;
}

function renderIndicators(){
  const value=S.snapshot;
  if(!value)return;

  setText(U.tendencia,value.trend.direction);
  setText(U.detalleTendencia,`${value.trend.percent.toFixed(4)}%`);
  setText(U.rsi,value.rsi===null?"--":value.rsi.toFixed(1));
  setText(U.detalleRsi,value.rsiState);
  setText(U.momentum,value.momentum.direction);
  setText(U.detalleMomentum,`${value.momentum.percent.toFixed(4)}%`);
  setText(U.volatilidad,`${value.volatility.percent.toFixed(4)}%`);
  setText(U.detalleVolatilidad,value.volatility.level);
}

function renderScore(){
  if(!S.opportunity)return;

  setText(U.puntajeSenal,`${S.opportunity.score}/100`);
  U.barraPuntaje.style.width=`${S.opportunity.score}%`;

  if(!S.requestActive){
    setText(U.mensajeOperacion,"Análisis interno activo. Pulse PREDICTION para solicitar una operación.");
  }else{
    setText(
      U.mensajeOperacion,
      S.opportunity.direction==="WAIT"
        ?"Buscando una entrada con suficiente calidad."
        :`Motor 1 detectó ${visual(S.opportunity)}.`
    );
  }
}

function renderReasons(opportunity){
  if(!U.listaMotivos)return;
  U.listaMotivos.innerHTML="";

  [
    ...(opportunity.reasons||[]),
    ...(opportunity.warnings||[]).map(text=>`⚠ ${text}`)
  ].forEach(text=>{
    const item=document.createElement("li");
    item.textContent=text;
    U.listaMotivos.appendChild(item);
  });
}

function renderSignal(opportunity,phase){
  U.panelSenal.className=`card signal-card ${phase==="CONFIRMED"?"confirmed":"prepare"}`;
  setText(U.estadoPrediccion,phase);
  setText(
    U.tituloPrediccion,
    phase==="CONFIRMED"
      ?"Consenso confirmado"
      :phase==="REVALIDATING"
        ?"Motor 2 revalidando"
        :"Posible oportunidad"
  );
  setText(U.valorPrediccion,visual(opportunity));
  setText(U.puntajeSenal,`${opportunity.consensusScore||opportunity.score}/100`);
  U.barraPuntaje.style.width=`${opportunity.consensusScore||opportunity.score}%`;
  renderReasons(opportunity);
}

function toast(type,state,value,detail,duration=4000){
  clearTimeout(toastTimer);
  U.capsulaSenal.className=`signal-toast ${type} visible`;
  setText(U.estadoCapsula,state);
  setText(U.valorCapsula,value);
  setText(U.detalleCapsula,detail);
  toastTimer=setTimeout(()=>U.capsulaSenal.classList.remove("visible"),duration);
}

function validatorState(data){
  let title={
    IDLE:S.requestActive?"BUSCANDO UNA ENTRADA":"EN ESPERA",
    PREPARE:"PREPARE",
    REVALIDATING:"REVALIDATING",
    EXECUTING:"EXECUTE NOW",
    RESULT:"RESULT",
    CANCELLED:"CANCELLED"
  }[data.state]||data.state;

  const progress={
    IDLE:S.requestActive?18:0,
    PREPARE:68,
    REVALIDATING:86,
    EXECUTING:100,
    RESULT:100,
    CANCELLED:0
  }[data.state]||0;

  setText(U.textoEstadoMonitoreo,data.state);
  setText(U.tituloMonitoreo,title);
  setText(U.detalleMonitoreo,data.message);
  U.barraProgresoMotor.style.width=`${progress}%`;
  U.botonCancelarMonitoreo.hidden=!["PREPARE","REVALIDATING"].includes(data.state);
  renderControls();
}

function beginSingleRequest(){
  if(!canRequestPrediction())return;

  clearTimeout(searchTimer);
  S.requestActive=true;
  S.activeSignal=null;

  engine2.reset();

  setText(U.tituloMonitoreo,"BUSCANDO UNA ENTRADA");
  setText(U.textoEstadoMonitoreo,"SEARCHING");
  setText(U.detalleMonitoreo,"Analizando esta solicitud. Solo se generará una operación.");
  U.barraProgresoMotor.style.width="18%";
  setText(U.estadoPrediccion,"SEARCHING");
  setText(U.tituloPrediccion,"Buscando una sola oportunidad");
  setText(U.valorPrediccion,"--");
  setText(U.cuentaRegresiva,"--");
  setText(U.mensajeControl,"Solicitud activa: una búsqueda, una señal y un resultado.");

  voice.speak("Buscando una sola oportunidad. Espere la alerta.");
  log("Nueva solicitud de predicción iniciada.","ok");
  diagnostics?.info("Solicitud ONE SHOT iniciada.",{
    symbol:S.symbol,
    strategy:S.strategy,
    mode:S.mode,
    horizon:S.horizon
  });

  renderControls();
  scanMarket(true);

  // Evita que una búsqueda quede activa indefinidamente.
  searchTimer=setTimeout(()=>{
    if(S.requestActive&&!S.activeSignal&&engine2.state==="IDLE"){
      finishCycle("timeout","No se encontró una entrada con suficiente calidad dentro del tiempo de búsqueda.");
      voice.speak("No se encontró una entrada segura. Pulse nueva predicción cuando desee intentarlo otra vez.");
    }
  },90000);
}

function prepare({opportunity}){
  if(!S.requestActive)return;
  clearTimeout(searchTimer);
  renderSignal(opportunity,"PREPARE");
  toast("prepare","PREPARE",visual(opportunity),"Señal bloqueada. Prepare el bot.",5000);
  voice.prepare(opportunity);
}

function revalidate({opportunity}){
  if(!S.requestActive)return;
  renderSignal(opportunity,"REVALIDATING");
  toast("prepare","REVALIDATING",visual(opportunity),"Motor 2 y Consenso revisando.",3000);
  voice.revalidate(opportunity);
}

function confirm({opportunity}){
  if(!S.requestActive)return;

  S.activeSignal={
    opportunity,
    price:S.lastPrice,
    tick:S.ticks,
    time:Date.now(),
    done:false
  };

  renderSignal(opportunity,"CONFIRMED");
  toast(
    "confirmed",
    "EXECUTE NOW",
    visual(opportunity),
    "Tiene 10 segundos para realizar la operación.",
    10000
  );
  voice.speak(`${visual(opportunity)} confirmado. Tiene diez segundos para realizar la operación.`);
  startCountdown(opportunity);
}

function cancel({opportunity,reason}){
  if(!S.requestActive)return;

  S.activeSignal=null;
  clearInterval(countdownTimer);
  toast("cancelled","CANCELLED",opportunity?visual(opportunity):"WAIT",reason,3500);
  voice.speak("Entrada cancelada. Pulse nueva predicción cuando desee buscar otra operación.");
  finishCycle("cancelled",reason);
}

function result({success,opportunity}){
  clearInterval(countdownTimer);

  const value=stats();
  value.tests+=1;
  if(success)value.ok+=1;
  else value.fail+=1;
  renderStats();

  U.panelSenal.className=`card signal-card ${success?"confirmed":"failed"}`;
  setText(U.estadoPrediccion,success?"SUCCESS":"FAILED");
  setText(U.tituloPrediccion,success?"Predicción acertada":"Predicción fallida");
  setText(U.valorPrediccion,visual(opportunity));
  setText(U.cuentaRegresiva,success?"✓":"×");

  voice.speak(
    success
      ?"Predicción acertada. Operación finalizada. Pulse nueva predicción para buscar otra entrada."
      :"Predicción fallida. Operación finalizada. Pulse nueva predicción para buscar otra entrada."
  );

  finishCycle("result",success?"Predicción acertada.":"Predicción fallida.");
}

function finishCycle(type,message){
  clearTimeout(searchTimer);
  clearInterval(countdownTimer);

  S.requestActive=false;
  S.activeSignal=null;
  S.completedOnce=true;
  S.cooldown=true;

  setText(U.mensajeControl,`${message} Operación finalizada. Pulse NUEVA PREDICCIÓN cuando esté listo.`);
  setText(U.tituloMonitoreo,"OPERACIÓN FINALIZADA");
  setText(U.textoEstadoMonitoreo,"FINISHED");
  setText(U.detalleMonitoreo,"No se generará otra señal automáticamente.");
  U.barraProgresoMotor.style.width="0%";

  diagnostics?.info("Ciclo ONE SHOT finalizado.",{type,message});
  log(`Ciclo finalizado: ${message}`,"ok");

  renderControls();

  clearTimeout(cooldownTimer);
  const wait=type==="result"?4200:1800;

  cooldownTimer=setTimeout(()=>{
    S.cooldown=false;
    if(engine2.state!=="IDLE")engine2.reset();
    setText(U.tituloMonitoreo,"EN ESPERA");
    setText(U.textoEstadoMonitoreo,"IDLE");
    setText(U.detalleMonitoreo,"Pulse NUEVA PREDICCIÓN para comenzar otro ciclo.");
    renderControls();
  },wait);
}

function horizonSeconds(){
  if(S.horizon==="1m")return 60;
  if(S.horizon==="2m")return 120;
  if(S.horizon==="5m")return 300;
  return 10;
}

function startCountdown(opportunity){
  clearInterval(countdownTimer);

  let remaining=opportunity.strategy==="rise_fall"
    ?horizonSeconds()
    :CFG.timing[opportunity.strategy].execute;

  setText(U.cuentaRegresiva,remaining);

  countdownTimer=setInterval(()=>{
    remaining-=1;
    setText(U.cuentaRegresiva,Math.max(0,remaining));
    if(remaining<=0)clearInterval(countdownTimer);
  },1000);
}

function evaluateActiveSignal(price,digit){
  const signal=S.activeSignal;
  if(!signal||signal.done)return;

  const opportunity=signal.opportunity;
  const elapsedTicks=S.ticks-signal.tick;

  if(opportunity.strategy==="even_odd"&&elapsedTicks>=1){
    finishEvaluation(
      opportunity.direction==="EVEN"?digit%2===0:digit%2!==0,
      {digit}
    );
    return;
  }

  if(opportunity.strategy==="over_under"&&elapsedTicks>=1){
    finishEvaluation(
      opportunity.direction==="OVER"?digit>=5:digit<=4,
      {digit}
    );
    return;
  }

  if(opportunity.strategy==="match"&&elapsedTicks>=1){
    if(digit===opportunity.metadata.digit){
      finishEvaluation(true,{digit,elapsedTicks});
    }else if(elapsedTicks>=5){
      finishEvaluation(false,{digit,elapsedTicks});
    }
    return;
  }

  if(
    opportunity.strategy==="rise_fall"&&
    Date.now()-signal.time>=horizonSeconds()*1000
  ){
    finishEvaluation(
      opportunity.direction==="RISE"?price>signal.price:price<signal.price,
      {start:signal.price,end:price}
    );
  }
}

function finishEvaluation(success,details){
  if(!S.activeSignal||S.activeSignal.done)return;
  S.activeSignal.done=true;
  engine2.result(success,details);
}

async function init(){
  await voice.init();

  U.selectorVoz.innerHTML="";
  voice.voices.forEach(item=>{
    const option=document.createElement("option");
    option.value=`${item.name}|${item.lang}`;
    option.textContent=`${item.name} · ${item.lang}`;
    U.selectorVoz.appendChild(option);
  });

  renderStats();
  renderControls();
  setText(U.nombreMercado,MARKETS[S.symbol]);
  setText(U.tituloMonitoreo,"EN ESPERA");
  setText(U.detalleMonitoreo,"Conecte y encienda el motor.");
  log(`Trading Analyst Pro MR V${VERSION} listo en modo ONE SHOT.`,"ok");
}

U.botonConectar.onclick=()=>derivAPI.connect(S.symbol);
U.botonDesconectar.onclick=()=>{
  stopEngine(false);
  derivAPI.disconnect();
};
U.botonEncenderMotor.onclick=()=>S.engineOn?stopEngine():startEngine();
U.botonPrediccion.onclick=beginSingleRequest;

U.selectorMercado.onchange=()=>{
  S.symbol=U.selectorMercado.value;
  setText(U.nombreMercado,MARKETS[S.symbol]);
  resetMarketData();
  renderStats();
  if(S.connected)derivAPI.changeSymbol(S.symbol);
};

U.selectorEstrategia.onchange=()=>{
  S.strategy=U.selectorEstrategia.value;
  renderStats();
};

U.selectorModo.onchange=()=>{
  S.mode=U.selectorModo.value;
  renderStats();
};

U.selectorHorizonte.onchange=()=>{
  S.horizon=U.selectorHorizonte.value;
  renderStats();
};

U.botonCancelarMonitoreo.onclick=()=>{
  if(S.requestActive)engine2.cancel("Cancelada manualmente.");
};

U.botonVoz.onclick=()=>setText(U.botonVoz,voice.toggle()?"🔊":"🔇");

U.selectorVoz.onchange=()=>voice.select(U.selectorVoz.value);

U.velocidadVoz.oninput=()=>{
  voice.rate=Number(U.velocidadVoz.value);
  setText(U.valorVelocidad,`${voice.rate.toFixed(2)}x`);
};

U.botonProbarVoz.onclick=()=>voice.speak(
  "Asistente de voz funcionando. El sistema realizará una sola operación por solicitud."
);

U.botonReiniciarEstadisticas.onclick=()=>{
  S.statistics[statsKey()]={tests:0,ok:0,fail:0};
  renderStats();
};

U.botonLimpiarRegistro.onclick=()=>{
  U.registroActividad.innerHTML="";
};

derivAPI.on("state",data=>renderConnection(data.state,data.label));
derivAPI.on("tick",handleTick);
derivAPI.on("log",data=>log(data.message,data.level));
derivAPI.on("error",data=>log(data.message,"error"));

engine2.on("state",validatorState);
engine2.on("prepare",prepare);
engine2.on("revalidate",revalidate);
engine2.on("confirm",confirm);
engine2.on("cancel",cancel);
engine2.on("result",result);

function renderDiagnosticEntries(entries){
  if(!U.contenidoDiagnostico)return;

  if(!entries.length){
    U.contenidoDiagnostico.textContent="Sin eventos todavía.";
    return;
  }

  U.contenidoDiagnostico.innerHTML="";

  entries.slice().reverse().forEach(item=>{
    const line=document.createElement("div");
    line.className=`diagnostic-line ${item.level||""}`;
    const extra=item.data?`\n${JSON.stringify(item.data,null,2)}`:"";
    line.textContent=`[${item.time}] ${item.message}${extra}`;
    U.contenidoDiagnostico.appendChild(line);
  });
}

diagnostics?.subscribe(renderDiagnosticEntries);

U.botonDiagnostico?.addEventListener("click",()=>{
  const open=U.panelDiagnostico.hidden;
  U.panelDiagnostico.hidden=!open;
  U.botonDiagnostico.textContent=open?"🛠 CERRAR":"🛠 ABRIR";
});

U.botonLimpiarDiagnostico?.addEventListener("click",()=>diagnostics?.clear());

U.botonCopiarDiagnostico?.addEventListener("click",async()=>{
  const content=(diagnostics?.getEntries()||[]).map(item=>{
    const extra=item.data?` ${JSON.stringify(item.data)}`:"";
    return `[${item.time}] ${item.level.toUpperCase()} ${item.message}${extra}`;
  }).join("\n");

  try{
    await navigator.clipboard.writeText(content||"Sin eventos.");
    toast("confirmed","DIAGNÓSTICO","COPIADO","El diagnóstico fue copiado.",2200);
  }catch(error){
    diagnostics?.error("No fue posible copiar el diagnóstico.",{message:error.message});
  }
});

init();
