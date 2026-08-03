const avg=a=>a.length?a.reduce((s,n)=>s+n,0)/a.length:0,clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
export function snapshot(prices,digits,mode="fast"){
 const w=mode==="complete"?35:20,p=prices.slice(-w),part=Math.max(2,Math.floor(p.length/3)),first=avg(p.slice(0,part)),last=avg(p.slice(-part)),tp=first?((last-first)/first)*100:0;
 const trend={direction:Math.abs(tp)<.003?"LATERAL":tp>0?"BULLISH":"BEARISH",strength:clamp(Math.abs(tp)*900,0,3),percent:tp};
 let rsi=null;if(prices.length>=15){let g=0,l=0,q=prices.slice(-15);for(let i=1;i<q.length;i++){let d=q[i]-q[i-1];d>0?g+=d:l-=d}rsi=l?100-100/(1+(g/14)/(l/14)):100}
 const mw=mode==="complete"?18:10,start=prices[prices.length-mw-1],end=prices.at(-1),mp=start?((end-start)/start)*100:0,momentum={direction:Math.abs(mp)<.001?"NEUTRAL":mp>0?"POSITIVE":"NEGATIVE",percent:mp,strength:clamp(Math.abs(mp)*1200,0,3)};
 const flow=(n)=>{let up=0,down=0,a=prices.slice(-(n+1));for(let i=1;i<a.length;i++){if(a[i]>a[i-1])up++;else if(a[i]<a[i-1])down++}let diff=Math.abs(up-down),tot=Math.max(1,up+down);return{direction:diff/tot<.16?"NEUTRAL":up>down?"BULLISH":"BEARISH",strength:clamp(diff/2,0,3)}};
 const sf=flow(8),mf=flow(20),v=prices.slice(-30),mean=avg(v),sd=Math.sqrt(avg(v.map(x=>(x-mean)**2))),vp=mean?sd/mean*100:0,volatility={level:vp>.08?"VERY HIGH":vp>.04?"HIGH":vp>.015?"MEDIUM":"LOW",percent:vp};
 const d=digits.slice(-80),freq=Array(10).fill(0);d.forEach(x=>freq[x]++);let hot=0;freq.forEach((n,i)=>{if(n>freq[hot])hot=i});let even=d.filter(x=>x%2===0).length,low=d.filter(x=>x<=4).length;
 return{trend,rsi,rsiState:rsi==null?"NO DATA":rsi>58?"BULLISH":rsi<42?"BEARISH":"NEUTRAL",momentum,shortFlow:sf,mediumFlow:mf,volatility,lateral:trend.direction==="LATERAL"||sf.direction==="NEUTRAL",digits:{count:d.length,even,odd:d.length-even,evenPct:d.length?even/d.length*100:0,oddPct:d.length?(d.length-even)/d.length*100:0,low,high:d.length-low,lowPct:d.length?low/d.length*100:0,highPct:d.length?(d.length-low)/d.length*100:0,hot,hotFreq:freq[hot]}}
}
