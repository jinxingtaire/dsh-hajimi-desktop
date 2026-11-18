import { skins, petAsset, catSprite, cloudSvg } from './pet-view.mjs';
import { CatWorld, timing } from './engine.mjs';
import { CatAudioMixer } from './audio.mjs';
const $ = s => document.querySelector(s);
const world = new CatWorld(innerWidth, innerHeight);
const nodes = new Map(), clouds = new Map(), lastStates = new Map();
let enabled=false, drag=null, manifestReady=null;
let audioManifest={clips:[],presets:{}};
const mixer=new CatAudioMixer({onError:message=>{$('#audio-status').textContent=message;}});
const labels={idle:'好好一只猫',warn:'开始偏头',threat:'抵抗代码启动',snap:'忍不了了',fight:'猫猫施工中',recover:'舔毛回血中'};
const names=['小橘','阿咪','奶盖','薯条','年糕','麻薯'];
const line={warn:['老无……','你瞅啥？','那个……那个……'],threat:['老无老无！','那个那个那个！','咕噜咕噜——'],recover:['舔舔……顺顺毛。','没事，理理毛。']};
function changeSkin(p){p.skin=p.skin==='orange'?'gray':'orange';say(p,`换成${skins[p.skin].label}啦。`);}
function say(p,text,ms=1400){const el=nodes.get(p.id)?.querySelector('.speech');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(el.timer);el.timer=setTimeout(()=>el.classList.remove('show'),ms);}
function stopSound(){mixer.stopAll();}
function touch(p){
  if(['snap','fight'].includes(p.state))return;
  say(p,p.state==='recover'?'舔舔……顺顺毛。':p.state==='idle'?'喵？':'呜……');
  if(p.state==='idle'&&!$('#guide').open){const clip=mixer.playClick();if(clip)nodes.get(p.id).dataset.clickClip=clip;}
}
function add(){
  if(world.cats.length>=6)return;
  const n=world.cats.length;
  const p=world.add(n?innerWidth*(.15+(n-1)*.16):innerWidth*.73,innerHeight*(n%2?.72:.65));
  p.skin=n%2?'gray':'orange';
  const el=document.createElement('button');el.className='pet';el.dataset.id=p.id;el.setAttribute('aria-label',`${names[n]}，方向键移动，空格摸摸`);
  el.title='右键或按 S 换皮肤';
  el.innerHTML=`<span class="speech" aria-hidden="true"></span><div class="art">${catSprite(p)}</div><span class="name">${names[n]}</span>`;
  el.addEventListener('contextmenu',e=>{e.preventDefault();changeSkin(p);});
  el.addEventListener('pointerdown',e=>{
    if(e.button!==0||['snap','fight'].includes(p.state))return;
    e.preventDefault();el.focus({preventScroll:true});el.setPointerCapture(e.pointerId);
    drag={p,id:e.pointerId,el,dx:e.clientX-p.x,dy:e.clientY-p.y,sx:e.clientX,sy:e.clientY,moved:false};
  });
  el.addEventListener('pointermove',e=>{
    if(!drag||drag.p!==p||e.pointerId!==drag.id)return;
    if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>5)drag.moved=true;
    if(drag.moved){el.classList.add('dragging');world.move(p.id,e.clientX-drag.dx,e.clientY-drag.dy);}
  });
  function end(e){if(!drag||drag.p!==p)return;const moved=drag.moved;drag=null;el.classList.remove('dragging');if(e.type==='pointerup'&&!moved)touch(p);}
  el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('lostpointercapture',end);
  el.addEventListener('keydown',e=>{const dirs={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};if(dirs[e.key]){e.preventDefault();world.move(p.id,p.x+dirs[e.key][0],p.y+dirs[e.key][1]);}if(e.key===' '||e.key==='Enter'){e.preventDefault();touch(p);}if(e.key.toLowerCase()==='s'){e.preventDefault();changeSkin(p);}});
  nodes.set(p.id,el);$('#pets').append(el);$('#add').disabled=world.cats.length>=6;
  $('.intro').style.opacity=world.cats.length>1?'.35':'1';
}
function reset(){stopSound();for(const el of nodes.values()){clearTimeout(el.querySelector('.speech').timer);el.remove();}for(const el of clouds.values())el.remove();nodes.clear();clouds.clear();lastStates.clear();world.cats=[];world.fights=[];drag=null;add();}
$('#add').onclick=add;$('#reset').onclick=reset;
$('#sound').onclick=async()=>{
  const button=$('#sound');button.disabled=true;
  try{
    if(!enabled){button.textContent='声音：加载中';await manifestReady;await mixer.setEnabled(true);enabled=true;}
    else{enabled=false;await mixer.setEnabled(false);}
  }catch{enabled=false;}
  finally{button.disabled=false;button.textContent=`声音：${enabled?'开':'关'}`;button.setAttribute('aria-pressed',enabled);}
};
function showGuide(){stopSound();$('#guide').showModal();}
$('#help').onclick=showGuide;$('#assets').onclick=showGuide;$('#close').onclick=()=>$('#guide').close();
$('#guide').addEventListener('close',()=>document.querySelectorAll('#clip-list audio').forEach(player=>player.pause()));
$('#chew-preview').onclick=()=>{if(world.fights.length)return;for(const p of world.cats){world.set(p,'recover');p.since=world.now;p.partner=null;}$('#guide').close();};
manifestReady=fetch('assets/audio/manifest.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('manifest');return r.json();}).then(manifest=>{
  audioManifest=manifest;
  mixer.setManifest(manifest);
  $('#audio-status').textContent=`已按你的分类保留 ${manifest.clips.length} 条：普通 6、不满 6、生气 1。靠近时两只猫分别使用左右声道，音量稳定，越近音调越高，最多提高 4 个半音。`;
  $('#clip-summary').textContent=`查看全部音效（${manifest.clips.length}）`;
  const displayClips=manifest.categories.flatMap(category=>[
    {heading:`${category.label} · ${category.clips.length} 条`},...category.clips.map(id=>manifest.clips.find(clip=>clip.id===id))
  ]);
  for(const clip of displayClips){
    if(clip.heading){const heading=document.createElement('h3');heading.textContent=clip.heading;$('#clip-list').append(heading);continue;}
    const row=document.createElement('div');row.className='clip-row';
    const caption=document.createElement('span');caption.textContent=clip.sourceGroup==='supplemental'
      ?`${clip.label} · ${clip.duration.toFixed(2)}秒 · 补充素材`
      :`${clip.label} · ${clip.start.toFixed(2)}–${clip.end.toFixed(2)}s · 视频切片`;
    if(clip.sourceFile){const original=document.createElement('small');original.className='clip-source';original.textContent=clip.sourceFile;caption.append(document.createElement('br'),original);}
    const player=document.createElement('audio');player.controls=true;player.preload='none';player.src=clip.url;player.volume=.45;player.setAttribute('aria-label',caption.textContent);
    const audition=document.createElement('button');audition.textContent='试听';audition.setAttribute('aria-label',`试听${clip.label}`);
    audition.onclick=()=>{if(player.paused)player.play().catch(()=>{$('#audio-status').textContent='这段音频播放失败，请检查浏览器音频支持。';});else player.pause();};
    player.onplay=()=>{audition.textContent='暂停';stopSound();document.querySelectorAll('#clip-list audio').forEach(other=>{if(other!==player)other.pause();});};
    player.onpause=()=>{audition.textContent='试听';};player.onended=()=>{audition.textContent='试听';};
    row.append(caption,audition,player);$('#clip-list').append(row);
  }
}).catch(error=>{$('#audio-status').textContent='音效清单未加载，请刷新后重试。';throw error;});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopSound();});
add();
function frame(now){
  world.tick(now);
  for(const p of world.cats){
    const el=nodes.get(p.id);el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;
    el.className=`pet ${p.state}${drag?.p===p&&drag.moved?' dragging':''}`;
    const sprite=el.querySelector('.pet-sprite');
    const asset=petAsset(p.state,p.skin);if(sprite.getAttribute('src')!==asset)sprite.src=asset;
    el.dataset.skin=p.skin;
    sprite.style.transform=p.facing>0?'scaleX(-1)':'';
    el.querySelector('.name').textContent=p.state==='idle'?`${names[world.cats.indexOf(p)]} · ${skins[p.skin].label}`:labels[p.state];
    const prior=lastStates.get(p.id);
    if(prior!==p.state){
      lastStates.set(p.id,p.state);
      if(p.state==='idle'){clearTimeout(el.querySelector('.speech').timer);el.querySelector('.speech').classList.remove('show');}
      if(line[p.state])say(p,line[p.state][Math.floor(Math.random()*line[p.state].length)],p.state==='recover'?2300:1500);
      if(p.state==='snap'&&drag?.p===p){drag.el.classList.remove('dragging');drag=null;}
    }
  }
  mixer.sync(world.cats,{paused:$('#guide').open||document.hidden});
  const voices=mixer.snapshot();
  for(const p of world.cats){
    const el=nodes.get(p.id),voice=voices.find(v=>v.catId===p.id);
    el.dataset.soundClip=voice?.clip??'';el.dataset.soundPan=voice?.pan??'';el.dataset.soundGain=voice?.level??'';
    el.dataset.soundPitch=voice?.pitch??'';
    if(voice)el.querySelector('.name').textContent=`${labels[p.state]} · ${voice.pan<0?'左声道':'右声道'}`;
  }
  const active=new Set();
  for(const f of world.fights){if(now-f.since<timing.snap)continue;active.add(f.id);let el=clouds.get(f.id);if(!el){el=document.createElement('div');el.className='cloud';el.innerHTML=cloudSvg()+'<strong>老无老无！</strong>';clouds.set(f.id,el);$('#clouds').append(el);}el.style.left=`${f.x}px`;el.style.top=`${f.y}px`;
    const sound=mixer.fightSnapshot().find(s=>s.key===`${Math.min(f.a.id,f.b.id)}:${Math.max(f.a.id,f.b.id)}`);el.dataset.soundLoop=String(!!sound?.loop);el.dataset.soundClip=sound?.clip??'';
  }
  for(const [id,el] of clouds)if(!active.has(id)){el.remove();clouds.delete(id);}
  const state=world.fights.length?'fight':world.cats.some(p=>p.state==='recover')?'recover':world.cats.some(p=>p.state==='threat')?'threat':world.cats.some(p=>p.state==='warn')?'warn':'idle';
  const hints={idle:world.cats.length===1?'点一下摸摸，按住就能拎走':'慢慢拖近。也可以在打起来之前拉开。',warn:'开始嘴硬了。再近一点？',threat:'抵抗代码启动。贴近停一下，就要开打了。',fight:'劝不住了，等它们打一会儿。',recover:'打完先理理毛，舔舔前爪回血。'};
  if($('#hint').textContent!==hints[state])$('#hint').textContent=hints[state];
  requestAnimationFrame(frame);
}
addEventListener('resize',()=>world.resize(innerWidth,innerHeight));requestAnimationFrame(frame);
// Read-only inspection for local acceptance checks; no DSH or network calls.
window.hajimi={snapshot:()=>({cats:structuredClone(world.cats),fights:world.fights.map(f=>({id:f.id,since:f.since}))})};
