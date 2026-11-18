import { distance } from './engine.mjs';

export const audioLevels = Object.freeze({ pair: .2, click: .26, fight: .19, master: .65 });
export function proximityPitch(ratio) {
  const t=Math.max(0,Math.min(1,(distance.warn+distance.hysteresis-ratio)/(distance.warn+distance.hysteresis-distance.contact)));
  return 4*t*t*(3-2*t);
}
export function pitchWeights(semitones,steps=[0,1,2,3,4]){
  const pitch=Math.max(steps[0],Math.min(steps.at(-1),semitones));
  const lower=[...steps].reverse().find(s=>s<=pitch),upper=steps.find(s=>s>=pitch);
  return steps.map(s=>lower===upper?Number(s===lower):s===lower?(upper-pitch)/(upper-lower):s===upper?(pitch-lower)/(upper-lower):0);
}
export function shuffle(items, random=Math.random) {
  const result=[...items];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
export class PairClipDeck {
  constructor(pool,random=Math.random){this.pool=[...new Set(pool)];this.random=random;this.remaining=[];this.previous=[];}
  nextPair(){
    if(this.pool.length<2)return null;
    if(this.remaining.length<2){
      const fresh=shuffle(this.pool,this.random);
      this.remaining=[...fresh.filter(id=>!this.previous.includes(id)),...fresh.filter(id=>this.previous.includes(id))];
    }
    const pair=this.remaining.splice(0,2);this.previous=pair;return pair;
  }
}
export function proximityPairs(cats){
  const eligible=new Map(cats.filter(p=>['warn','threat'].includes(p.state)).map(p=>[p.id,p]));
  return [...eligible.values()].flatMap(a=>{
    const b=eligible.get(a.partner);
    if(!b||b.partner!==a.id||a.id>b.id)return [];
    return [{key:`${a.id}:${b.id}`,a,b,ratio:Math.hypot(a.x-b.x,a.y-b.y)/((a.size+b.size)/2)}];
  });
}
export function pairPan(cat,other){return cat.x<other.x||(cat.x===other.x&&cat.id<other.id)?-1:1;}
export function fightingPairs(cats){
  const eligible=new Map(cats.filter(p=>p.state==='fight').map(p=>[p.id,p]));
  return [...eligible.values()].flatMap(a=>{const b=eligible.get(a.partner);return b&&b.partner===a.id&&a.id<b.id?[{key:`${a.id}:${b.id}`,a,b}]:[];});
}

export class CatAudioMixer {
  constructor({manifest={clips:[],presets:{}},contextFactory=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)(),fetchBytes=url=>fetch(url).then(r=>{if(!r.ok)throw new Error(`Audio HTTP ${r.status}`);return r.arrayBuffer();}),random=Math.random,onError=()=>{}}={}){
    Object.assign(this,{manifest,contextFactory,fetchBytes,random,onError});
    this.context=null;this.ready=false;this.enabled=false;this.loading=null;this.buffers=new Map();this.pitchBuffers=new Map();
    this.pairs=new Map();this.fightVoices=new Map();this.voices=new Set();this.clickVoice=null;this.lastClick=null;this.lastClickAt=-Infinity;
  }
  setManifest(manifest){this.manifest=manifest;}
  async prepare(){
    if(this.loading)return this.loading;
    this.context=this.contextFactory();const ctx=this.context;
    // A shared filter and conservative per-voice levels soften harsh upper frequencies.
    this.bus=ctx.createBiquadFilter();this.bus.type='lowpass';this.bus.frequency.value=4300;this.bus.Q.value=.5;
    this.compressor=ctx.createDynamicsCompressor();
    for(const [key,value] of Object.entries({threshold:-18,knee:12,ratio:4,attack:.006,release:.18}))this.compressor[key].value=value;
    this.master=ctx.createGain();this.master.gain.value=audioLevels.master;
    this.bus.connect(this.compressor).connect(this.master).connect(ctx.destination);
    // Called from a click: unlock the live context before any fetch awaits.
    if(ctx.state==='suspended'&&ctx.resume&&!ctx.startRendering)this.unlock=ctx.resume();
    this.loading=Promise.allSettled(this.manifest.clips.map(async clip=>{
      const bytes=await this.fetchBytes(clip.url);const buffer=await ctx.decodeAudioData(bytes);
      this.buffers.set(clip.id,buffer);
      const variants=await Promise.all((clip.pitchVariants??[]).filter(v=>v.semitones!==0).map(async v=>({
        semitones:v.semitones,buffer:await ctx.decodeAudioData(await this.fetchBytes(v.url))
      })));
      this.pitchBuffers.set(clip.id,[{semitones:0,buffer},...variants].sort((a,b)=>a.semitones-b.semitones));
    })).then(results=>{
      this.ready=true;
      const failed=results.filter(r=>r.status==='rejected').length;
      if(failed)this.onError(`${failed} 段音频加载失败，其余音效仍可使用。`);
      if(!this.buffers.size)throw new Error('没有可播放的音效');
    });
    return this.loading;
  }
  async setEnabled(value){
    this.enabled=value;
    if(!value){this.stopAll();return;}
    try{await this.prepare();if(this.context.state==='suspended'&&!this.context.startRendering)await this.context.resume();}
    catch(error){this.enabled=false;this.onError('音频未能加载，请刷新后重试。');throw error;}
  }
  startVoice(id,{catId=null,pan=0,level=.2,delay=0,kind='pair',pitch=0,loop=false}={}){
    const buffer=this.buffers.get(id);if(!buffer)return null;
    const ctx=this.context,start=ctx.currentTime+delay,end=loop?Infinity:start+buffer.duration;
    const gain=ctx.createGain(),envelope=ctx.createGain(),panner=ctx.createStereoPanner();
    gain.gain.value=level;panner.pan.value=pan;
    const fade=Math.min(.06,buffer.duration/4);
    envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(1,start+.025);
    if(!loop){envelope.gain.setValueAtTime(1,Math.max(start+.025,end-fade));envelope.gain.linearRampToValueAtTime(0,end);}
    gain.connect(envelope).connect(panner).connect(this.bus);
    const variants=kind==='pair'?(this.pitchBuffers.get(id)??[{semitones:0,buffer}]):[{semitones:0,buffer}];
    const weights=pitchWeights(pitch,variants.map(v=>v.semitones));
    const branches=variants.map((v,i)=>{
      const source=ctx.createBufferSource(),weight=ctx.createGain();source.buffer=v.buffer;source.loop=loop;weight.gain.value=weights[i];
      source.connect(weight).connect(gain);return {source,weight,semitones:v.semitones};
    });
    const voice={id,catId,gain,envelope,panner,branches,kind,end,stopping:false,level,pan,pitch,loop};
    this.voices.add(voice);
    branches[0].source.onended=()=>{this.voices.delete(voice);for(const node of [gain,envelope,panner,...branches.flatMap(b=>[b.source,b.weight])])node.disconnect();};
    branches.forEach(branch=>branch.source.start(start));return voice;
  }
  stopVoice(voice){
    if(!voice||voice.stopping)return;voice.stopping=true;
    const t=this.context.currentTime,param=voice.envelope.gain;
    if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(t);else{param.cancelScheduledValues(t);param.setValueAtTime(param.value,t);}
    param.linearRampToValueAtTime(0,t+.08);
    for(const branch of voice.branches)try{branch.source.stop(t+.085);}catch{/* The source may already have ended. */}
  }
  stopAll(){for(const voice of this.voices)this.stopVoice(voice);this.pairs.clear();this.fightVoices.clear();this.clickVoice=null;}
  playClick(){
    if(!this.enabled||!this.ready)return null;
    const now=this.context.currentTime;if(now-this.lastClickAt<.18)return null;
    const pool=(this.manifest.presets.meow??[]).filter(id=>this.buffers.has(id));
    const choices=pool.length>1?pool.filter(id=>id!==this.lastClick):pool;
    if(!choices.length)return null;
    const id=choices[Math.floor(this.random()*choices.length)];
    this.stopVoice(this.clickVoice);this.lastClick=id;this.lastClickAt=now;
    this.clickVoice=this.startVoice(id,{pan:0,level:audioLevels.click,kind:'click'});return id;
  }
  sync(cats,{paused=false}={}){
    if(!this.enabled||!this.ready)return;
    if(paused){this.stopAll();return;}
    const ctx=this.context,now=ctx.currentTime,pairs=proximityPairs(cats),active=new Set(pairs.map(p=>p.key));
    for(const [key,pair] of this.pairs)if(!active.has(key)){pair.voices.forEach(v=>this.stopVoice(v));this.pairs.delete(key);}
    const fights=fightingPairs(cats),activeFights=new Set(fights.map(f=>f.key));
    for(const [key,voice] of this.fightVoices)if(!activeFights.has(key)){this.stopVoice(voice);this.fightVoices.delete(key);}
    for(const fight of fights)if(!this.fightVoices.has(fight.key)){
      const id=(this.manifest.presets.fight??[]).find(id=>this.buffers.has(id));
      if(id){const voice=this.startVoice(id,{level:audioLevels.fight,kind:'fight',loop:true});this.fightVoices.set(fight.key,voice);}
    }
    const headroom=audioLevels.master/Math.sqrt(Math.max(1,pairs.length+fights.length));
    this.master.gain.setTargetAtTime(headroom,now,.12);
    for(const current of pairs){
      let pair=this.pairs.get(current.key);
      if(!pair){pair={deck:new PairClipDeck((this.manifest.presets.warn??[]).filter(id=>this.buffers.has(id)),this.random),voices:[],nextAt:0};this.pairs.set(current.key,pair);}
      const level=audioLevels.pair,pitch=proximityPitch(current.ratio);
      if(now>=pair.nextAt){
        const picks=pair.deck.nextPair();if(!picks)continue;
        pair.voices=[current.a,current.b].map((cat,i)=>this.startVoice(picks[i],{
          catId:cat.id,pan:pairPan(cat,[current.b,current.a][i]),level,pitch,delay:i*.09,
        })).filter(Boolean);
        pair.nextAt=now+Math.max(...picks.map(id=>this.buffers.get(id).duration))+.09+.5+this.random()*.35;
      }
      for(const voice of pair.voices){
        if(!this.voices.has(voice)||voice.stopping)continue;
        const cat=voice.catId===current.a.id?current.a:current.b,other=cat===current.a?current.b:current.a;
        const pan=pairPan(cat,other);
        voice.panner.pan.setTargetAtTime(pan,now,.08);
        if(Math.abs(voice.pitch-pitch)>.015){
          const weights=pitchWeights(pitch,voice.branches.map(b=>b.semitones));
          voice.branches.forEach((branch,i)=>branch.weight.gain.setTargetAtTime(weights[i],now,.09));
          voice.pitch=pitch;
        }
        voice.level=level;voice.pan=pan;
      }
    }
  }
  fightSnapshot(){return [...this.fightVoices.entries()].filter(([,v])=>!v.stopping).map(([key,v])=>({key,clip:v.id,loop:v.branches.every(b=>b.source.loop)}));}
  snapshot(){
    return [...this.voices].filter(v=>!v.stopping&&v.kind==='pair'&&v.end>this.context.currentTime)
      .map(v=>({catId:v.catId,clip:v.id,pan:v.pan,level:v.level,pitch:v.pitch}));
  }
}
