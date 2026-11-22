'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const { bindNativeCameraIpc } = require(path.join(root, 'desktop/native-camera.cjs'));
let win, host, feed;
const pending = new Promise(resolve => app.whenReady().then(resolve));
async function waitFor(expression, timeout = 5000) {
 const until = Date.now() + timeout;
 while (Date.now() < until) {
  if (await win.webContents.executeJavaScript(expression)) return;
  await new Promise(resolve => setTimeout(resolve, 50));
 }
 console.error('DOM status: '+JSON.stringify(await win.webContents.executeJavaScript("({title:document.querySelector('#modal-title')?.textContent,status:document.querySelector('#cal-status')?.textContent,button:document.querySelector('#capture-button')?.outerHTML,tracking:document.querySelector('#cal-tracking-label')?.textContent,camera:document.querySelector('#camera-state')?.textContent,hidden:document.hidden})")));
 throw Error('Timed out: ' + expression);
}
function frame(state) {
 const value=Array.from({length:478},()=>({x:200,y:180}));
 for(const i of [33,133])value[i]={x:i===33?130:170,y:160};
 for(const i of [263,362])value[i]={x:i===263?270:230,y:160};
 const by=state==='raised'?122:state==='furrowed'?145:135;
 for(const i of [70,63,105,66,107])value[i]={x:150,y:by};
 for(const i of [300,293,334,296,336])value[i]={x:250,y:by};
 value[55]={x:state==='furrowed'?188:182,y:by};
 value[285]={x:state==='furrowed'?212:218,y:by};
 return {value,stable:true,reset:false,timestamp:Date.now()*1000};
}
class SDK {
 constructor() { this.callbacks = new Map(); this.pose = 'neutral'; this.stops = 0; }
 on(name,cb) { this.callbacks.set(name,cb); }
 useCamera(selection,settings) { assert.equal(selection.kind,'default'); assert.equal(settings.fps,30); }
 start() { this.callbacks.get('processingStatus')(3); feed=setInterval(()=>this.callbacks.get('metrics')({face:{landmarks:[frame(this.pose)]}}),30); }
 stopAsync() { clearInterval(feed); this.stops++; return Promise.resolve(); }
 destroy() { return Promise.resolve(); }
}
(async () => {
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'inflect-electron-qa-'));
 app.setPath('userData',profile);
 await pending;
 const page = pathToFileURL(path.join(root,'dist/index.html')).href;
 win = new BrowserWindow({show:false,width:1460,height:1000,webPreferences:{preload:path.join(root,'desktop/preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 host = bindNativeCameraIpc(win,{ipcMain,own:url=>url?.split('#')[0]===page,loadRuntime:()=>({SmartSpectraSDK:SDK,CameraSelection:{default:{kind:'default'}},MetricType:{FACE_LANDMARKS:11},decodeMetrics:buffer=>buffer})});
 await win.loadFile(path.join(root,'dist/index.html'));
 const environment=await win.webContents.executeJavaScript("({bridge:typeof window.__inflectNativeCamera?.start,node:typeof require,hidden:document.hidden})");
 assert.equal(environment.bridge,'function'); assert.equal(environment.node,'undefined'); assert.equal(environment.hidden,false);
 await win.webContents.executeJavaScript("document.querySelector('[data-action=camera]').click();document.querySelector('[data-action=live-consent]').click();document.querySelector('#api-key').value='unit-test-no-network';document.querySelector('#camera-consent').checked=true;document.querySelector('[data-action=start-live]').click();");
 await waitFor("!!document.querySelector('#cal-tracking')");
 await waitFor("document.querySelector('#cal-tracking-label')?.textContent.includes('Live tracking')");
 const sdk=host.session.sdk;
 for (const [pose,title] of [['neutral','Let your brows rest.'],['raised','Gently raise your brows.'],['furrowed','Bring your brows inward.']]) {
  sdk.pose=pose;
  assert.equal(await win.webContents.executeJavaScript("document.querySelector('#modal-title').textContent"),title);
  await new Promise(resolve=>setTimeout(resolve,120));
  await win.webContents.executeJavaScript("document.querySelector('[data-action=capture]').click()");
  await waitFor("!document.querySelector('#modal').open || !document.querySelector('#capture-button')?.disabled",4500);
 }
 await waitFor("!document.querySelector('#modal').open");
 const status=await win.webContents.executeJavaScript("({camera:document.querySelector('#camera-state').textContent,calibration:document.querySelector('#diag-calibration').textContent,count:document.querySelector('#diag-samples').textContent,canvas:!!document.querySelector('.camera-landmarks'),overflow:document.documentElement.scrollWidth>innerWidth})");
 assert.equal(status.camera,'Camera on');
 assert.equal(status.calibration,'Personal · in memory');
 assert.equal(status.canvas,true);
 assert.equal(status.overflow,false);
 assert.equal(sdk.stops,0);
 await win.webContents.executeJavaScript("document.querySelector('[data-action=begin]').click()");
 sdk.callbacks.get('error')(14,'Test interruption',true);
 await waitFor("document.querySelector('#camera-state')?.textContent==='Camera off'");
 assert.equal(sdk.stops,1);
 assert.equal(await win.webContents.executeJavaScript("document.querySelector('#modal').open"),false);
 console.log(JSON.stringify({result:'PASS',fixture:'synthetic; no camera or network used',environment,status,interruptionRecovered:true}));
 await host.stop();
 win.destroy();
 app.exit(0);
})().catch(async error=>{
 clearInterval(feed);
 console.error(error.stack);
 try { await host?.stop(); } catch {}
 win?.destroy();
 app.exit(1);
});
