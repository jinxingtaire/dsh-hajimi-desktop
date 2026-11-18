import {CatWorld,timing} from '../engine.mjs';
import {CatAudioMixer} from '../audio.mjs';
import {skins,petAsset,cloudSvg} from '../pet-view.mjs';

const bridge=window.hajimiDesktop;
const base=new URL('../',import.meta.url);
const world=new CatWorld(innerWidth,innerHeight),nodes=new Map(),clouds=new Map(),lastStates=new Map(),masks=new Map();
let sound=true,drag=null,paused=false,lastZones=0,lastSave=0;
const mixer=new CatAudioMixer({fetchBytes:url=>fetch(new URL(url,base)).then(r=>{if(!r.ok)throw new Error('Audio unavailable');return r.arrayBuffer();}),onError:message=>console.warn(message)});
const asset=p=>new URL(petAsset(p.state,p.skin),base).href;
function say(p,text,ms=1200){const bubble=nodes.get(p.id)?.querySelector('.speech');if(!bubble)return;clearTimeout(bubble.timer);bubble.textContent=text;bubble.classList.add('show');bubble.timer=setTimeout(()=>bubble.classList.remove('show'),ms);}
function save(){bridge.save({sound,width:innerWidth,height:innerHeight,cats:world.cats.map(p=>({x:p.x,y:p.y,skin:p.skin}))});}
function maskFor(img){
  const key=img.src;if(masks.has(key))return masks.get(key);if(!img.complete||!img.naturalWidth)return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(img,0,0,32,32);
  const data=context.getImageData(0,0,32,32).data;
  const rows=Array.from({length:32},(_,y)=>Array.from({length:32},(_,x)=>{
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const px=x+dx,py=y+dy;if(px>=0&&px<32&&py>=0&&py<32&&data[(py*32+px)*4+3]>80)return '1';}
    return '0';
  }).join(''));masks.set(key,rows);return rows;
}
function zones(){
  const result=world.cats.filter(p=>p.state!=='fight').map(p=>{const img=nodes.get(p.id).querySelector('img');let mask=maskFor(img);if(mask&&p.facing>0)mask=mask.map(row=>[...row].reverse().join(''));return {x:p.x-105,y:p.y-105,w:210,h:210,mask};});
  for(const f of world.fights)if(world.now-f.since>=timing.snap)result.push({x:f.x-120,y:f.y-100,w:240,h:200});
  bridge.zones(result);
}
function endDrag(event){if(!drag)return;const current=drag;drag=null;bridge.dragging(false);if(event.type==='pointerup'&&!current.moved&&current.p.state==='idle'){say(current.p,'喵？');mixer.playClick();}save();}
function add(skin='orange',x=innerWidth*.7,y=innerHeight*.66){
  if(world.cats.length>=6){if(world.cats[0])say(world.cats[0],'已经挤满六只啦。');return;}
  const p=world.add(x,y);p.skin=skin==='gray'?'gray':'orange';
  const el=document.createElement('button');el.className='pet';el.dataset.id=p.id;el.setAttribute('aria-label',`${skins[p.skin].label}桌宠，拖拽移动，右键打开菜单`);
  el.innerHTML='<span class="speech"></span><div class="art"><img class="pet-sprite" draggable="false" alt=""></div>';
  el.querySelector('img').src=asset(p);
  el.addEventListener('pointerdown',event=>{
    if(event.button!==0||['snap','fight'].includes(p.state))return;event.preventDefault();el.setPointerCapture(event.pointerId);
    bridge.dragging(true);paused=false;drag={p,el,id:event.pointerId,dx:event.clientX-p.x,dy:event.clientY-p.y,x:event.clientX,y:event.clientY,moved:false};
  });
  el.addEventListener('pointermove',event=>{if(!drag||drag.p!==p||event.pointerId!==drag.id)return;if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>4)drag.moved=true;if(drag.moved){bridge.dragging(true);world.move(p.id,event.clientX-drag.dx,event.clientY-drag.dy);}});
  el.addEventListener('pointerup',endDrag);el.addEventListener('pointercancel',endDrag);el.addEventListener('lostpointercapture',endDrag);
  el.addEventListener('contextmenu',event=>{event.preventDefault();bridge.menu({id:p.id,skin:p.skin});});
  nodes.set(p.id,el);document.querySelector('#pets').append(el);save();return p;
}
function remove(id){
  const cat=world.cats.find(p=>p.id===id);if(!cat)return;
  for(const f of [...world.fights])if(f.a===cat||f.b===cat){world.fights.splice(world.fights.indexOf(f),1);const other=f.a===cat?f.b:f.a;world.set(other,'recover');other.armed=false;other.partner=null;world.clamp(other);}
  if(drag?.p===cat){drag=null;bridge.dragging(false);}const el=nodes.get(id);clearTimeout(el.querySelector('.speech').timer);el.remove();nodes.delete(id);lastStates.delete(id);world.cats=world.cats.filter(p=>p!==cat);save();
}
function reset(){mixer.stopAll();world.fights=[];world.cats.forEach((p,i)=>{p.x=innerWidth*(.2+(i%3)*.3);p.y=innerHeight*(i<3?.6:.85);p.state='idle';p.partner=null;p.armed=true;world.clamp(p);});save();}
bridge.onAction(async action=>{
  paused=false;
  if(action.type==='add')add(action.skin,innerWidth*(world.cats.length%2?.25:.72),innerHeight*.66);
  if(action.type==='skin'){const p=world.cats.find(p=>p.id===action.id);if(p){p.skin=action.skin==='gray'?'gray':'orange';say(p,`换成${skins[p.skin].label}啦。`);save();}}
  if(action.type==='remove')remove(action.id);
  if(action.type==='reset')reset();
  if(action.type==='pause'){paused=true;mixer.stopAll();}
  if(action.type==='sound'){sound=action.value===true;try{await mixer.setEnabled(sound);}catch{sound=false;}save();}
  if(action.type==='groom'&&!world.fights.length){world.cats.forEach(p=>{world.set(p,'recover');p.since=world.now;});}
});
document.addEventListener('contextmenu',event=>{if(!event.target.closest('.pet')){event.preventDefault();bridge.menu(null);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){mixer.stopAll();bridge.dragging(false);}});
addEventListener('blur',()=>{if(drag){drag=null;bridge.dragging(false);}});
addEventListener('resize',()=>{world.resize(innerWidth,innerHeight);zones();save();});

const settings=await bridge.settings();sound=settings.sound!==false;
if(settings.cats?.length)for(const cat of settings.cats)add(cat.skin,cat.x*(settings.width?innerWidth/settings.width:1),cat.y*(settings.height?innerHeight/settings.height:1));
else{const p=add();say(p,'右键加猫、换皮肤',4200);}
const manifest=await fetch(new URL('assets/audio/manifest.json',base)).then(r=>r.json());mixer.setManifest(manifest);
if(sound)try{await mixer.setEnabled(true);}catch{sound=false;}
function frame(now){
  world.tick(now);
  for(const p of world.cats){
    const el=nodes.get(p.id),image=el.querySelector('img');el.className=`pet ${p.state}${drag?.p===p&&drag.moved?' dragging':''}`;el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;
    const src=asset(p);if(image.src!==src)image.src=src;image.style.transform=p.facing>0?'scaleX(-1)':'';
    if(lastStates.get(p.id)!==p.state){lastStates.set(p.id,p.state);if(p.state==='warn')say(p,'老无……');if(p.state==='threat')say(p,'那个那个那个！');if(p.state==='recover')say(p,'舔舔……顺顺毛。');if(p.state==='snap'&&drag?.p===p){drag=null;bridge.dragging(false);}}
  }
  mixer.sync(world.cats,{paused:paused||document.hidden});
  const active=new Set();
  for(const f of world.fights){if(now-f.since<timing.snap)continue;active.add(f.id);let el=clouds.get(f.id);if(!el){el=document.createElement('div');el.className='cloud';el.innerHTML=cloudSvg()+'<strong>老无老无！</strong>';clouds.set(f.id,el);document.querySelector('#clouds').append(el);}el.style.left=`${f.x}px`;el.style.top=`${f.y}px`;}
  for(const [id,el] of clouds)if(!active.has(id)){el.remove();clouds.delete(id);}
  if(now-lastZones>80){zones();lastZones=now;}if(now-lastSave>1500){save();lastSave=now;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
