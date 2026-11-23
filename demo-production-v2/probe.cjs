'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('no-sandbox');
let win;
(async()=>{
 app.setPath('userData',await fs.mkdtemp(path.join(os.tmpdir(),'inflect-film-')));
 await app.whenReady();
 win=new BrowserWindow({show:false,useContentSize:true,width:1920,height:1080,webPreferences:{preload:path.resolve('desktop/preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 win.webContents.setAudioMuted(true);
 await win.loadFile(path.resolve('dist/index.html'));
 await win.webContents.executeJavaScript("document.fonts.ready");
 await fs.mkdir('demo-production-v2/output',{recursive:true});
 const start=Date.now();let count=0;
 for(let i=0;i<90;i++){const im=await win.webContents.capturePage();const b=im.toJPEG(88);count++;if(i===0)await fs.writeFile('demo-production-v2/output/app-pilot.jpg',b);}
 const report={frames:count,seconds:(Date.now()-start)/1000};
 await fs.writeFile('demo-production-v2/output/probe.json',JSON.stringify(report));
 console.log(JSON.stringify(report));win.destroy();app.exit(0);
})().catch(e=>{console.error(e.stack);win?.destroy();app.exit(1)});
