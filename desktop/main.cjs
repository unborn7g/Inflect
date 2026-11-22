const{app,BrowserWindow,session,shell,ipcMain}=require('electron');
const{bindNativeCameraIpc}=require('./native-camera.cjs');
const path=require('node:path');const{pathToFileURL}=require('node:url');
let nativeHost,quitting=false;
const page=pathToFileURL(path.join(__dirname,'../dist/index.html')).href;
const own=url=>typeof url==='string'&&url.split('#')[0]===page;
const hosts=new Set(['www.lifeprint.com','lifeprint.com','smartspectra.presagetech.com','physiology.presagetech.com','saadh.info','github.com','presagetech.com']);
function external(url){try{const u=new URL(url);if(u.protocol==='https:'&&hosts.has(u.hostname))shell.openExternal(url);}catch{}}
app.whenReady().then(()=>{
 session.defaultSession.setPermissionRequestHandler((wc,permission,done,details)=>{const types=details.mediaTypes||[];done(permission==='media'&&own(details.requestingUrl||wc.getURL())&&types.length>0&&types.every(t=>t==='video'));});
 session.defaultSession.setPermissionCheckHandler((wc,permission,_origin,details)=>permission==='media'&&own(details.requestingUrl||wc?.getURL())&&details.mediaType!=='audio');
 const win=new BrowserWindow({width:1460,height:1000,minWidth:1000,minHeight:760,title:'Inflect — Facial cue practice',backgroundColor:'#f7f8fa',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}});
 nativeHost=bindNativeCameraIpc(win,{ipcMain,own});win.webContents.setWindowOpenHandler(({url})=>{external(url);return{action:'deny'};});win.webContents.on('will-navigate',(e,url)=>{if(!own(url)){e.preventDefault();external(url);}});win.loadFile(path.join(__dirname,'../dist/index.html'));
});app.on('window-all-closed',()=>app.quit());

app.on('before-quit',event=>{if(quitting)return;event.preventDefault();quitting=true;Promise.resolve(nativeHost?.stop()).catch(()=>{}).finally(()=>app.quit());});
