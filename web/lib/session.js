export const SESSION_SECONDS=20;
export const WINDOWS=Object.freeze({raised:[{start:3,end:7,target:'raised'},{start:10,end:14,target:'raised'}],furrowed:[{start:3,end:7,target:'furrowed'},{start:10,end:14,target:'furrowed'}],contrast:[{start:3,end:7,target:'raised'},{start:10,end:14,target:'furrowed'}]});
export const cueAt=(id,t)=>(WINDOWS[id]||WINDOWS.raised).find(w=>t>=w.start&&t<w.end)?.target||'neutral';
export function samplePreview(id,t){const cue=cueAt(id,t),first=t>=3&&t<7,state=first&&(t<3.65||t>6.1)?'neutral':cue;return{t,state,value:(state==='raised'?.95:state==='furrowed'?-.95:0)+Math.sin(t*4)*.025,valid:true,source:'illustrated'};}
// Filling is permitted for illustrated data only; never interpolate real observations.
export function fillPreviewTrace(id,trace,t){const next=[...trace],end=Math.floor(Math.max(0,Math.min(20,t))*10);for(let i=next.length;i<=end;i++)next.push(samplePreview(id,i/10));return next;}
export class PracticeClock{
 constructor(duration=20){this.duration=duration;this.elapsed=0;this.anchor=null;this.running=false;}
 start(now){this.elapsed=0;this.anchor=now;this.running=true;}
 time(now){return Math.min(this.duration,this.elapsed+(this.running?Math.max(0,now-this.anchor)/1000:0));}
 pause(now){this.elapsed=this.time(now);this.running=false;this.anchor=null;}
 resume(now){if(this.elapsed<this.duration&&!this.running){this.anchor=now;this.running=true;}}
 done(now){return this.time(now)>=this.duration;}
}
export function summarizeAttempt(id,trace){
 const sorted=trace.filter(s=>Number.isFinite(s.t)&&s.t>=0&&s.t<=20).sort((a,b)=>a.t-b.t);
 return(WINDOWS[id]||WINDOWS.raised).map(w=>{let observed=0,matched=0,firstMatch=null;for(let i=0;i<sorted.length-1;i++){const a=sorted[i],b=sorted[i+1],from=Math.max(w.start,a.t),to=Math.min(w.end,b.t);if(!a.valid||!b.valid||b.t-a.t>.35||to<=from)continue;observed+=to-from;if(a.state===w.target){matched+=to-from;firstMatch??=from;}}return{...w,duration:w.end-w.start,observed:Math.min(w.end-w.start,observed),matched:Math.min(w.end-w.start,matched),delay:firstMatch===null?null:firstMatch-w.start};});
}
