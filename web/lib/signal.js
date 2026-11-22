export const FACE_POINTS=Object.freeze({rightEye:[33,133],leftEye:[263,362],rightBrow:[70,63,105,66,107],leftBrow:[300,293,334,296,336],innerBrow:[55,285]});
export const STALE_AFTER_MS=1500;
const unknown=reason=>({valid:false,reason});
const mean=(p,ids)=>ids.reduce((v,i)=>({x:v.x+p[i].x/ids.length,y:v.y+p[i].y/ids.length}),{x:0,y:0});
const median=a=>{a=[...a].sort((x,y)=>x-y);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
export const vectorDistance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
// Presage documents pixel coordinates in the 478-point MediaPipe topology.
export function extractBrowFeatures(frame){
 if(!Array.isArray(frame?.value)||frame.value.length!==478)return unknown('Landmark shape unavailable');
 if(frame.reset)return unknown('Tracking reset. Recalibrate before continuing.');
 if(frame.stable!==true)return unknown('Keep your face visible and comfortably still');
 const p=frame.value;if(!p.every(v=>Number.isFinite(v?.x)&&Number.isFinite(v?.y)))return unknown('Coordinates unavailable');
 const a=mean(p,FACE_POINTS.rightEye),b=mean(p,FACE_POINTS.leftEye),dx=b.x-a.x,dy=b.y-a.y,scale=Math.hypot(dx,dy);
 if(scale<.0001)return unknown('Move into view');
 if(Math.abs(Math.atan2(dy,Math.abs(dx)))>Math.PI/8)return unknown('Keep your head comfortably level');
 const sign=dx<0?-1:1,down={x:-dy/scale*sign,y:dx/scale*sign};
 const lift=(ids,eye)=>{const v=mean(p,ids);return -((v.x-eye.x)*down.x+(v.y-eye.y)*down.y)/scale;};
 const right=lift(FACE_POINTS.rightBrow,a),left=lift(FACE_POINTS.leftBrow,b),[i,j]=FACE_POINTS.innerBrow,gap=Math.hypot(p[i].x-p[j].x,p[i].y-p[j].y)/scale;
 if(right<-.1||left<-.1||right>1.2||left>1.2||gap>1.3||gap<.05||Math.abs(right-left)>.25)return unknown('Face the camera directly');
 return{valid:true,features:[right,left,gap],points:p};
}
export function buildCalibration(samples){
 const names=['neutral','raised','furrowed'];
 if(names.some(k=>!Array.isArray(samples[k])||samples[k].length<20))return{ok:false,reason:'Not enough clear samples. Keep the movement steady and try again.'};
 if(names.some(k=>samples[k].some(v=>!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite))))return{ok:false,reason:'Some measurements were unavailable. Try again.'};
 const centers=Object.fromEntries(names.map(k=>[k,[0,1,2].map(i=>median(samples[k].map(v=>v[i])))]));
 const noise=Math.max(.005,...names.map(k=>median(samples[k].map(v=>vectorDistance(v,centers[k])))));
 const spread=Math.min(vectorDistance(centers.neutral,centers.raised),vectorDistance(centers.neutral,centers.furrowed),vectorDistance(centers.raised,centers.furrowed));
 if(spread<Math.max(.035,noise*4))return{ok:false,reason:'Those positions were too similar to compare reliably. Try clearer movements or use mirror practice.'};
 if((centers.raised[0]+centers.raised[1])/2<=(centers.neutral[0]+centers.neutral[1])/2+.018)return{ok:false,reason:'The raised-brow sample did not show a clear lift. Try calibration again.'};
 return{ok:true,centers,noise,spread,version:1};
}
export function classifyBrow(features,cal){
 if(!cal?.ok)return unknown('Calibrate first');
 if(!Array.isArray(features)||features.length!==3||!features.every(Number.isFinite))return unknown('Movement unavailable');
 const ranked=Object.entries(cal.centers).map(([name,c])=>({name,distance:vectorDistance(features,c)})).sort((a,b)=>a.distance-b.distance);
 if(ranked[0].distance>Math.max(cal.spread*1.1,cal.noise*5)||ranked[1].distance-ranked[0].distance<Math.max(.008,cal.noise*.75))return unknown('Between calibrated positions');
 const h=(features[0]+features[1])/2,n=(cal.centers.neutral[0]+cal.centers.neutral[1])/2,up=(cal.centers.raised[0]+cal.centers.raised[1])/2-n,down=n-(cal.centers.furrowed[0]+cal.centers.furrowed[1])/2;
 return{valid:true,state:ranked[0].name,value:Math.max(-1.4,Math.min(1.4,(h-n)/Math.max(h>=n?up:down,.02)))};
}
export class LandmarkGate{
 constructor(){this.reset();} reset(){this.lastTimestamp=0;this.lastReceived=null;}
 ingest(frame,now=performance.now(),epochNow=Date.now()){
  if(frame?.reset){this.reset();return unknown('Tracking reset. Recalibrate.');}
  const ts=Number(frame?.timestamp);if(!Number.isFinite(ts)||ts<=0)return unknown('Timestamp unavailable');
  if(ts<=this.lastTimestamp)return unknown('Waiting for a new measurement');
  const age=epochNow-ts/1000;if(age>STALE_AFTER_MS||age< -5000)return unknown('Measurement out of date');
  this.lastTimestamp=ts;const result=extractBrowFeatures(frame);if(result.valid)this.lastReceived=now;return result;
 }
 fresh(now=performance.now()){return this.lastReceived!==null&&now-this.lastReceived<=STALE_AFTER_MS;}
}
