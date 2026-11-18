import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {startAssetServer,isAllowedAsset} from '../dsh/asset-server.mjs';
import {DesktopRuntime,guiEnvironment} from '../dsh/runtime.mjs';
const {pointHitsZones,validZones,cleanState}=createRequire(import.meta.url)('../desktop/shared.cjs');
const root=new URL('../',import.meta.url).pathname;
test('桌面透明像素不阻拦鼠标，猫咪不透明区域接受拖拽',()=>{
  const mask=Array.from({length:32},(_,y)=>y===16?'0'.repeat(16)+'1'+'0'.repeat(15):'0'.repeat(32));
  const zone={x:100,y:200,w:320,h:320,mask};assert.ok(validZones([zone]));
  assert.equal(pointHitsZones(101,201,[zone]),false);assert.equal(pointHitsZones(265,365,[zone]),true);assert.equal(pointHitsZones(500,500,[zone]),false);
  assert.equal(validZones([{...zone,mask:['1']}]),false);
});
test('持久化状态仅保留位置、皮肤、尺寸和声音',()=>{
  const state=cleanState({sound:false,apiKey:'not-kept',width:1200,height:800,cats:[{x:200,y:300,skin:'gray',state:'fight'},{x:NaN,y:30}]});
  assert.deepEqual(state,{sound:false,width:1200,height:800,cats:[{x:200,y:300,skin:'gray'}]});
});
test('桌面资源服务只在独立令牌路径暴露必要资源',async()=>{
  const server=await startAssetServer(decodeURIComponent(root));
  try{
    const page=await fetch(server.url);assert.equal(page.status,200);assert.match(await page.text(),/renderer\.mjs/);assert.match(page.headers.get('content-security-policy'),/object-src 'none'/);
    for(const name of ['engine.mjs','audio.mjs','pet-view.mjs','assets/audio/manifest.json','assets/pets/hajimi-gray-v1/stress.gif'])assert.equal((await fetch(server.base+name)).status,200,name);
    for(const name of ['package.json','desktop/electron.cjs','README.md','assets/%2e%2e/package.json'])assert.equal((await fetch(server.base+name)).status,404,name);
    assert.equal((await fetch(new URL('/desktop/index.html',server.base))).status,404);
    assert.equal((await fetch(server.url,{method:'POST'})).status,405);
  }finally{await server.close();}
});
test('取消启动后不会遗留资源服务或启动桌面进程',async()=>{
  const runtime=new DesktopRuntime();await runtime.stop();await runtime.start();assert.equal(runtime.child,null);assert.equal(runtime.server?.url.startsWith('http://127.0.0.1:'),true);
  await assert.rejects(fetch(runtime.server.url));
});
test('从 DSH Node Host 启动 GUI 时移除 Node 模式变量',()=>{
  const env=guiEnvironment({PATH:'/bin',ELECTRON_RUN_AS_NODE:'1',NODE_OPTIONS:'--some-option',NODE_PATH:'/host/modules',HOME:'/home/user'});
  assert.deepEqual(env,{PATH:'/bin',HOME:'/home/user'});
  assert.equal(isAllowedAsset('assets/audio/../secrets.json'),false);assert.equal(isAllowedAsset('desktop/preload.cjs'),false);
});
