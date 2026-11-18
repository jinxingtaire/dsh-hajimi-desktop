const {app,BrowserWindow,ipcMain,Menu,Tray,nativeImage,screen}=require('electron');
const {join}=require('node:path');
const fs=require('node:fs');
const {pointHitsZones,validZones,cleanState}=require('./shared.cjs');
const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;};
const url=arg('--hajimi-url'),parent=Number(arg('--hajimi-parent'));
if(!url||!/^http:\/\/127\.0\.0\.1:\d+\/[a-f0-9]{48}\/desktop\/index\.html$/.test(url))throw new Error('Invalid companion URL');
app.setName('哈吉咪桌宠');
app.setPath('userData',join(app.getPath('appData'),'dsh-hajimi-desktop'));
let window,tray,zones=[],dragUntil=0,ignored=true,current={cats:[],sound:true,width:0,height:0},saveTimer,poll,parentPoll,quitting=false;
const stateFile=()=>join(app.getPath('userData'),'desktop-state.json');
function readState(){try{return cleanState(JSON.parse(fs.readFileSync(stateFile(),'utf8')));}catch{return {cats:[],sound:true,width:0,height:0};}}
function persist(){try{fs.mkdirSync(app.getPath('userData'),{recursive:true});const tmp=stateFile()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(current));fs.renameSync(tmp,stateFile());}catch(error){console.error('保存桌宠设置失败：'+error.message);}}
function send(action){if(window&&!window.isDestroyed())window.webContents.send('hajimi:action',action);}
function setVisible(show){if(show)window.showInactive();else{window.hide();dragUntil=0;send({type:'pause'});}updateTray();}
function updateTray(){if(tray)tray.setContextMenu(Menu.buildFromTemplate(menuItems(null)));}
function menuItems(target){
  const items=[{label:'哈吉咪桌宠 · DeepSeek Harness',enabled:false},{type:'separator'},
    {label:'再来一只橘猫',click:()=>{setVisible(true);send({type:'add',skin:'orange'});}},
    {label:'再来一只灰白虎斑',click:()=>{setVisible(true);send({type:'add',skin:'gray'});}}];
  if(target?.id)items.push({label:'这只猫的皮肤',submenu:[{label:'橘猫',type:'radio',checked:target.skin==='orange',click:()=>send({type:'skin',id:target.id,skin:'orange'})},{label:'灰白虎斑',type:'radio',checked:target.skin==='gray',click:()=>send({type:'skin',id:target.id,skin:'gray'})}]},{label:'送走这只猫',click:()=>send({type:'remove',id:target.id})});
  items.push({type:'separator'},{label:'猫叫声音',type:'checkbox',checked:current.sound,click:item=>{current.sound=item.checked;send({type:'sound',value:item.checked});persist();updateTray();}},{label:'整理一下毛（预览）',click:()=>send({type:'groom'})},{label:'重新摆放',click:()=>send({type:'reset'})},{label:window?.isVisible()?'暂时隐藏':'显示猫咪',click:()=>setVisible(!window.isVisible())});
  const displays=screen.getAllDisplays();if(displays.length>1)items.push({label:'移动到显示器',submenu:displays.map((display,i)=>({label:`显示器 ${i+1}${display.internal?'（内置）':''}`,click:()=>{window.setBounds(display.workArea);send({type:'reset'});}}))});
  items.push({type:'separator'},{label:'关闭桌宠',click:()=>app.quit()});return items;
}
function trusted(event){return window&&!window.isDestroyed()&&event.sender.id===window.webContents.id;}
app.whenReady().then(async()=>{
  if(!app.requestSingleInstanceLock()){app.quit();return;}
  current=readState();
  const area=screen.getPrimaryDisplay().workArea;
  window=new BrowserWindow({...area,title:'哈吉咪桌宠',frame:false,transparent:true,hasShadow:false,alwaysOnTop:true,skipTaskbar:true,resizable:false,movable:false,focusable:false,show:false,backgroundColor:'#00000000',webPreferences:{preload:join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,autoplayPolicy:'no-user-gesture-required',backgroundThrottling:false}});
  window.setAlwaysOnTop(true,'floating');window.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
  window.setIgnoreMouseEvents(true,{forward:true});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,target)=>{if(target!==url)event.preventDefault();});
  window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  ipcMain.handle('hajimi:settings',event=>{if(!trusted(event))throw new Error('Unknown renderer');return current;});
  ipcMain.on('hajimi:zones',(event,value)=>{if(trusted(event)&&validZones(value))zones=value;});
  ipcMain.on('hajimi:dragging',(event,value)=>{if(trusted(event))dragUntil=value===true?Date.now()+5000:0;});
  ipcMain.on('hajimi:menu',(event,target)=>{if(!trusted(event))return;dragUntil=0;const clean=target&&Number.isInteger(target.id)?{id:target.id,skin:target.skin==='gray'?'gray':'orange'}:null;Menu.buildFromTemplate(menuItems(clean)).popup({window});});
  ipcMain.on('hajimi:state',(event,value)=>{if(!trusted(event))return;current=cleanState(value);clearTimeout(saveTimer);saveTimer=setTimeout(persist,400);updateTray();});
  window.webContents.on('render-process-gone',()=>app.quit());
  window.on('closed',()=>{window=null;if(!quitting)app.quit();});
  const icon=nativeImage.createFromPath(join(__dirname,'../assets/pets/hajimi-v1/frames/stress/00.png')).resize({width:24,height:24});
  tray=new Tray(icon);tray.setToolTip('哈吉咪桌宠');updateTray();
  await window.loadURL(url);window.showInactive();if(process.platform==='darwin')app.dock.hide();
  poll=setInterval(()=>{
    if(!window||window.isDestroyed()||!window.isVisible())return;
    const cursor=screen.getCursorScreenPoint(),bounds=window.getBounds();
    const hit=Date.now()<dragUntil||pointHitsZones(cursor.x-bounds.x,cursor.y-bounds.y,zones);
    if(ignored===hit){ignored=!hit;window.setIgnoreMouseEvents(ignored,{forward:true});}
  },25);
  if(Number.isSafeInteger(parent)&&parent>0)parentPoll=setInterval(()=>{try{process.kill(parent,0);}catch{app.quit();}},1500);
  screen.on('display-metrics-changed',()=>{if(window)window.setBounds(screen.getDisplayMatching(window.getBounds()).workArea);});
  app.on('second-instance',()=>setVisible(true));
  console.log('透明桌宠窗口已就绪');
}).catch(error=>{console.error(error.message);app.exit(1);});
app.on('before-quit',()=>{quitting=true;clearInterval(poll);clearInterval(parentPoll);clearTimeout(saveTimer);persist();tray?.destroy();});
app.on('window-all-closed',()=>app.quit());
process.on('SIGTERM',()=>app.quit());process.on('SIGINT',()=>app.quit());
