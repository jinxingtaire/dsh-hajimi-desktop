const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('hajimiDesktop',{
  settings:()=>ipcRenderer.invoke('hajimi:settings'),
  zones:zones=>ipcRenderer.send('hajimi:zones',zones),
  dragging:value=>ipcRenderer.send('hajimi:dragging',value),
  menu:target=>ipcRenderer.send('hajimi:menu',target),
  save:state=>ipcRenderer.send('hajimi:state',state),
  onAction:callback=>{const listener=(_event,action)=>callback(action);ipcRenderer.on('hajimi:action',listener);return()=>ipcRenderer.removeListener('hajimi:action',listener);},
});
