import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {PairClipDeck,proximityPitch,pitchWeights,pairPan,proximityPairs,fightingPairs,audioLevels} from '../audio.mjs';
const manifest=JSON.parse(readFileSync(new URL('../assets/audio/manifest.json',import.meta.url)));
test('只保留用户指定的 6 普通、6 不满、1 生气音效',()=>{
  assert.equal(manifest.clips.length,13);
  assert.deepEqual(manifest.categories.map(c=>c.clips.length),[6,6,1]);
  assert.deepEqual(manifest.presets.meow,['hungry-cat','cat-meow','meow-20','meow-21','meow-22','meow-23']);
  assert.deepEqual(manifest.presets.warn,['meow-13','meow-14','meow-15','meow-16','meow-29','phrase-01']);
  assert.deepEqual(manifest.presets.threat,manifest.presets.warn);
  assert.deepEqual(manifest.presets.fight,['unhappy-cat']);
  assert.equal(new Set(manifest.clips.map(c=>c.id)).size,13);
});
test('两只猫每轮叫声不同，每六条用完才重新洗牌，跨轮不紧接重复',()=>{
  let seed=31;const random=()=>((seed=(seed*16807)%2147483647)/2147483647);
  const deck=new PairClipDeck(manifest.presets.warn,random);let previous=[];
  for(let cycle=0;cycle<30;cycle++){
    const seen=[];
    for(let round=0;round<3;round++){
      const pair=deck.nextPair();assert.notEqual(pair[0],pair[1]);
      assert.ok(!pair.some(id=>previous.includes(id)));seen.push(...pair);previous=pair;
    }
    assert.equal(new Set(seen).size,6);
  }
});
test('距离越近音调越高并限幅 4 半音，音量为固定值',()=>{
  const ratios=[5,2.28,2.15,1.8,1.4,1,.86,.2];let previous=-1;
  for(const ratio of ratios){const pitch=proximityPitch(ratio);assert.ok(pitch>=previous&&pitch>=0&&pitch<=4);previous=pitch;}
  assert.equal(proximityPitch(4),0);assert.equal(proximityPitch(0),4);assert.equal(audioLevels.pair,.2);
});
test('跨升调档位平滑混合，权重恒定且不改变源播放速率',()=>{
  for(let pitch=-1;pitch<=5;pitch+=.031){const weights=pitchWeights(pitch);assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-9);assert.ok(weights.every(w=>w>=0&&w<=1));}
  for(const clip of manifest.clips.filter(c=>c.category==='discontent')){
    assert.deepEqual(clip.pitchVariants.map(v=>v.semitones),[0,1,2,3,4]);
    for(const variant of clip.pitchVariants){assert.ok(Math.abs(variant.duration-clip.duration)<.045);assert.ok(existsSync(new URL(`../${variant.url}`,import.meta.url)));}
  }
});
test('猫互换屏幕左右后声道跟随；完全重叠时仍分到两个声道',()=>{
  const a={id:1,x:100},b={id:2,x:200};assert.equal(pairPan(a,b),-1);assert.equal(pairPan(b,a),1);
  a.x=300;assert.equal(pairPan(a,b),1);assert.equal(pairPan(b,a),-1);
  a.x=b.x;assert.equal(pairPan(a,b),-pairPan(b,a));
});
test('只有互相配对且仍在应激的猫会持续叫，恢复和独处均停止',()=>{
  const a={id:1,x:100,y:200,size:160,state:'warn',partner:2},b={id:2,x:300,y:200,size:160,state:'threat',partner:1};
  assert.equal(proximityPairs([a,b]).length,1);b.state='recover';assert.equal(proximityPairs([a,b]).length,0);
  b.state='warn';b.partner=null;assert.equal(proximityPairs([a,b]).length,0);
});
test('打架循环按猫对隔离，一对恢复后不影响另一对',()=>{
  const cats=[{id:1,state:'fight',partner:2},{id:2,state:'fight',partner:1},{id:3,state:'fight',partner:4},{id:4,state:'fight',partner:3}];
  assert.deepEqual(fightingPairs(cats).map(p=>p.key),['1:2','3:4']);
  cats[0].state=cats[1].state='recover';assert.deepEqual(fightingPairs(cats).map(p=>p.key),['3:4']);
  cats[3].state='idle';assert.equal(fightingPairs(cats).length,0);
});
