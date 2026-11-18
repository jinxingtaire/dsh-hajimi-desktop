import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {extname,resolve,sep} from 'node:path';

const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.gif':'image/gif','.m4a':'audio/mp4','.wav':'audio/wav'};
const entries=new Set(['desktop/index.html','desktop/renderer.mjs','desktop/desktop.css','engine.mjs','audio.mjs','pet-view.mjs']);
export function isAllowedAsset(path){
  return entries.has(path)||/^assets\/(audio|pets)\//.test(path)&&['.gif','.png','.json','.m4a','.wav'].includes(extname(path))&&!path.split('/').some(p=>p==='..'||p.startsWith('.'));
}
/** Serve only packaged pet assets on loopback under an ephemeral unguessable prefix. */
export async function startAssetServer(root){
  const prefix=`/${randomBytes(24).toString('hex')}/`;
  const server=createServer(async(req,res)=>{
    try{
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
      const raw=req.url.split('?')[0];
      if(!raw.startsWith(prefix)){res.writeHead(404);res.end();return;}
      let name;try{name=decodeURIComponent(raw.slice(prefix.length));}catch{res.writeHead(400);res.end();return;}
      if(!isAllowedAsset(name)){res.writeHead(404);res.end();return;}
      const path=resolve(root,name);
      if(!path.startsWith(resolve(root)+sep)){res.writeHead(404);res.end();return;}
      const info=await stat(path);if(!info.isFile()){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':types[extname(path)],'Content-Length':info.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'"});
      if(req.method==='HEAD'){res.end();return;}
      createReadStream(path).on('error',()=>res.destroy()).pipe(res);
    }catch{if(!res.headersSent)res.writeHead(404);res.end();}
  });
  await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
  const base=`http://127.0.0.1:${server.address().port}${prefix}`;
  return {base,url:base+'desktop/index.html',close:()=>new Promise(done=>{server.closeAllConnections();server.close(done);})};
}
