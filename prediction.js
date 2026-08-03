export const visual=o=>!o?"--":o.direction==="MATCH"?`MATCHES ${o.metadata?.digit??"--"}`:o.direction;
export const manualText=o=>!o?"Sin análisis disponible.":o.direction==="WAIT"?`No hay entrada clara. Puntaje ${o.score}/100.`:o.direction==="MATCH"?`Posible coincidencia ${o.metadata?.digit}. Puntaje ${o.score}/100.`:`Posible ${o.direction}. Puntaje ${o.score}/100.`;
