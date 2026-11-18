import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {existsSync} from 'node:fs';
import {startAssetServer} from './asset-server.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
export function guiEnvironment(environment=process.env){
  const result={...environment};delete result.ELECTRON_RUN_AS_NODE;delete result.NODE_OPTIONS;delete result.NODE_PATH;
  return result;
}
export class DesktopRuntime {
  constructor({logger=console,parentPid=process.pid,electronPath=null,extraArgs=[]}={}){Object.assign(this,{logger,parentPid,electronPath,extraArgs});this.closed=false;this.child=null;this.server=null;}
  async start(){
    this.server=await startAssetServer(root);
    if(this.closed){await this.server.close();return;}
    try{
      const electron=this.electronPath??require('electron');
      if(typeof electron!=='string'||!existsSync(electron))throw new Error('Electron 运行时未完成安装，请在插件目录执行 npm install 后重试。');
      this.child=spawn(electron,[join(root,'desktop/electron.cjs'),'--hajimi-url',this.server.url,'--hajimi-parent',String(this.parentPid),...this.extraArgs],{env:guiEnvironment(),stdio:['ignore','pipe','pipe'],windowsHide:true});
      this.child.stdout.on('data',chunk=>this.logger.info?.(`[哈吉咪] ${chunk.toString().trim()}`));
      this.child.stderr.on('data',chunk=>{const line=chunk.toString().trim();if(line&&!/DevTools|gpu_process_host|NSWindow|IMKClient|IMKInputSession/.test(line))this.logger.warn?.(`[哈吉咪] ${line}`);});
      await new Promise((done,reject)=>{this.child.once('spawn',done);this.child.once('error',reject);});
      this.child.once('exit',code=>{if(!this.closed&&code)this.logger.warn?.(`哈吉咪桌宠已退出（${code}）。重新启用插件可以重开。`);});
      this.logger.info?.('哈吉咪桌宠已启动；右键猫咪或使用菜单栏猫咪图标添加同伴。');
    }catch(error){await this.server.close();this.server=null;throw error;}
  }
  async stop(){
    if(this.closed)return;this.closed=true;
    const child=this.child;
    if(child&&child.exitCode===null){
      await new Promise(done=>{const timer=setTimeout(()=>{child.kill('SIGKILL');done();},2500);timer.unref();child.once('exit',()=>{clearTimeout(timer);done();});child.kill('SIGTERM');});
    }
    if(this.server){await this.server.close();this.server=null;}
  }
}
