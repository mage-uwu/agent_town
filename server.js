import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.zip':'application/zip'};
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost'),relative=decodeURIComponent(url.pathname).replace(/^\/+/,''),file=path.resolve(root,relative||'index.html');
    if(!file.startsWith(root)||relative.split('/').some(p=>p.startsWith('.'))){res.writeHead(403);res.end('Forbidden');return;}
    const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log(`Player workshop: http://127.0.0.1:${server.address().port}`));
