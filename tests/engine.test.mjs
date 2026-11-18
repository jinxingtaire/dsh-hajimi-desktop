import test from 'node:test';
import assert from 'node:assert/strict';
import {CatWorld,timing} from '../engine.mjs';
test('远离时安静，靠近预警，拉远立即解除',()=>{
 const w=new CatWorld(),a=w.add(200,400),b=w.add(800,400);w.tick(0);assert.equal(a.state,'idle');
 w.move(b.id,500,400);w.tick(10);assert.equal(a.state,'warn');assert.equal(b.state,'warn');
 w.move(b.id,800,400);w.tick(20);assert.equal(a.state,'idle');assert.equal(a.partner,null);
});
test('直接拖到重叠也要先蓄势，打完恢复，冷却后才重新触发',()=>{
 const w=new CatWorld(),a=w.add(500,400),b=w.add(610,400);w.tick(0);assert.equal(a.state,'threat');
 w.tick(timing.windup-1);assert.equal(w.fights.length,0);w.tick(timing.windup);assert.equal(a.state,'snap');
 assert.equal(w.move(a.id,100,100),false);w.tick(timing.windup+timing.snap);assert.equal(a.state,'fight');
 w.tick(timing.windup+timing.snap+timing.fight);assert.equal(a.state,'recover');assert.equal(w.fights.length,0);
 w.move(b.id,a.x+100,a.y);w.tick(w.now+timing.recover-1);assert.equal(a.state,'recover');
 w.tick(w.now+1);assert.equal(a.state,'threat');assert.equal(w.fights.length,0);
});
test('贴住不动不会打完无限连战，必须先拉开再靠近',()=>{
 const w=new CatWorld(500,600),a=w.add(190,400),b=w.add(290,400);w.tick(0);w.tick(700);w.tick(3400);
 w.move(a.id,200,400);w.move(b.id,300,400);w.tick(9000);w.tick(11000);assert.equal(w.fights.length,0);
 assert.equal(a.armed,false);w.move(a.id,92,400);w.move(b.id,408,400); // width too narrow for rearming at 2.4 widths
 w.resize(1200,700);w.move(b.id,800,400);w.tick(12000);assert.equal(a.armed,true);
 w.move(b.id,192,400);w.tick(13000);w.tick(13700);assert.equal(w.fights.length,1);
});
test('四只猫同时接近时配对独占，不会重复参战',()=>{
 const w=new CatWorld();[400,420,430,440].forEach(x=>w.add(x,400));w.tick(0);w.tick(700);
 assert.equal(w.fights.length,2);const ids=w.fights.flatMap(f=>[f.a.id,f.b.id]);assert.equal(new Set(ids).size,4);
});
test('预警边界有滞回，轻微抖动不会频繁切换',()=>{
 const w=new CatWorld(),a=w.add(200,400),b=w.add(540,400);w.tick(0);assert.equal(a.state,'warn');
 w.move(b.id,550,400);w.tick(10);assert.equal(a.state,'warn');w.move(b.id,580,400);w.tick(20);assert.equal(a.state,'idle');
});
test('窗口变化后猫仍在可见区域',()=>{
 const w=new CatWorld(),a=w.add(1000,600);w.resize(480,500);assert.ok(a.x<=388);assert.ok(a.y<=420);
});
