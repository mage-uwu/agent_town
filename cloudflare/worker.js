import {DurableObject} from 'cloudflare:workers';
import wasm from '../world/engine.wasm';
import {engine,WORLD_SEED,ENGINE_VERSION,newPlayer,validCommand,publicPlayer} from '../world/core.js';
const WORLD_ID='agent-town-single-world-v1';
const MAX_PLAYERS=32;
/** ONE continuous shared world. This authority is a bounded first implementation,
 * not a room factory or an MMO-scale claim. Geography can be sharded later. */
export class SharedWorld extends DurableObject {
 constructor(ctx,env){
  super(ctx,env);this.core=engine(new WebAssembly.Instance(wasm,{}));this.sql=ctx.storage.sql;
  this.sql.exec('CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY, seed INTEGER, version INTEGER, revision INTEGER)');
  this.sql.exec('INSERT OR IGNORE INTO meta VALUES (1,?,?,0)',WORLD_SEED,ENGINE_VERSION);
  const meta=this.sql.exec('SELECT * FROM meta WHERE id=1').one();
  if(meta.seed!==WORLD_SEED||meta.version!==ENGINE_VERSION)throw new Error('World migration required');
  this.sql.exec('CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, token TEXT UNIQUE NOT NULL, data TEXT NOT NULL)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS tiles (x INTEGER,y INTEGER,cx INTEGER,cy INTEGER,tile INTEGER,PRIMARY KEY(x,y))');
  this.sql.exec('CREATE INDEX IF NOT EXISTS tile_chunks ON tiles(cx,cy)');
 }
 player(id){const row=this.sql.exec('SELECT data FROM players WHERE id=?',id).toArray()[0];return row?JSON.parse(row.data):null;}
 save(p){this.sql.exec('UPDATE players SET data=? WHERE id=?',JSON.stringify(p),p.id);}
 tile(x,y){return this.sql.exec('SELECT tile FROM tiles WHERE x=? AND y=?',x,y).toArray()[0]?.tile??this.core.tile(x,y);}
 online(){return this.ctx.getWebSockets().map(ws=>this.player(ws.deserializeAttachment().id)).filter(Boolean);}
 spawn(){const taken=this.online();for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++)if(this.core.walkable(this.tile(x,y))&&!taken.some(p=>p.x===x&&p.y===y))return {x,y};throw new Error('Starting area full');}
 revision(){return this.sql.exec('SELECT revision FROM meta WHERE id=1').one().revision;}
 patches(p){const cx=Math.floor(p.x/32),cy=Math.floor(p.y/32);return this.sql.exec('SELECT x,y,tile FROM tiles WHERE cx BETWEEN ? AND ? AND cy BETWEEN ? AND ?',cx-2,cx+2,cy-2,cy+2).toArray();}
 snapshot(ws,p,type='welcome'){ws.send(JSON.stringify({type,id:p.id,seed:WORLD_SEED,engineVersion:ENGINE_VERSION,player:p,players:this.online().map(publicPlayer),patches:this.patches(p),revision:this.revision()}));}
 async fetch(request){
  const url=new URL(request.url),token=(request.headers.get('Cookie')??'').split(';').map(v=>v.trim()).find(v=>v.startsWith('at_session='))?.slice(11);
  let row=token?this.sql.exec('SELECT id FROM players WHERE token=?',token).toArray()[0]:null;
  if(url.pathname==='/api/session'&&request.method==='POST'){
   if(row)return Response.json({ok:true,world:'Agent Town',engineVersion:ENGINE_VERSION});
   if(this.ctx.getWebSockets().length>=MAX_PLAYERS)return Response.json({error:'The shared world is at its current player cap.'},{status:503});
   const session=crypto.randomUUID(),id=crypto.randomUUID();let pos;
   try{pos=this.spawn();}catch{return Response.json({error:'Starting area full'},{status:503});}
   this.sql.exec('INSERT INTO players VALUES (?,?,?)',id,session,JSON.stringify(newPlayer(id,pos.x,pos.y)));
   return Response.json({ok:true,world:'Agent Town',engineVersion:ENGINE_VERSION},{headers:{'Set-Cookie':`at_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${url.protocol==='https:'?'; Secure':''}`}});
  }
  if(url.pathname!=='/api/connect'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('Not found',{status:404});
  if(!row)return new Response('Create a session first',{status:401});
  if(this.ctx.getWebSockets().length>=MAX_PLAYERS)return new Response('World connection cap reached',{status:503});
  for(const socket of this.ctx.getWebSockets())if(socket.deserializeAttachment().id===row.id)return new Response('This player is already connected in another tab.',{status:409});
  const p=this.player(row.id),others=this.online();
  if(!this.core.walkable(this.tile(p.x,p.y))||others.some(o=>o.x===p.x&&o.y===p.y)){Object.assign(p,this.spawn());this.save(p);}
  const pair=new WebSocketPair(),client=pair[0],server=pair[1];
  this.ctx.acceptWebSocket(server);server.serializeAttachment({id:p.id,lastAction:0,window:Date.now(),count:0});
  this.snapshot(server,p);this.broadcast({type:'join',player:publicPlayer(p)},server);
  return new Response(null,{status:101,webSocket:client});
 }
 broadcast(message,except){const text=JSON.stringify(message);for(const ws of this.ctx.getWebSockets())if(ws!==except){try{ws.send(text);}catch{try{ws.close(1011,'Connection lost');}catch{}}}}
 webSocketMessage(ws,message){
  const a=ws.deserializeAttachment(),now=Date.now();
  if(typeof message!=='string'||message.length>512){ws.close(1009,'Small text commands only');return;}
  if(now-a.window>1000){a.window=now;a.count=0;}if(++a.count>30){ws.close(1008,'Too many messages');return;}
  ws.serializeAttachment(a);
  let command;try{command=JSON.parse(message);}catch{ws.send(JSON.stringify({type:'error',message:'Invalid JSON'}));return;}
  const p=this.player(a.id);if(!p){ws.close(1008,'Unknown session');return;}
  if(command?.type==='sync'){this.snapshot(ws,p,'snapshot');return;}
  if(!validCommand(command)){ws.send(JSON.stringify({type:'ack',code:1,player:p}));return;}
  if(command.seq!==p.seq+1){ws.send(JSON.stringify({type:'ack',code:9,player:p}));return;}
  if(now-a.lastAction<100){ws.send(JSON.stringify({type:'ack',code:10,player:p}));return;}
  a.lastAction=now;ws.serializeAttachment(a);
  const x=p.x+command.dx,y=p.y+command.dy,target=this.tile(x,y),occupied=this.online().some(o=>o.id!==p.id&&o.x===x&&o.y===y);
  const result=this.core.apply(p,command,target,occupied);result.player.seq=command.seq;
  let revision=this.revision();
  // Inventory, position, command sequence, tile edit, and world revision commit together.
  // WASM is scratch-only: no mutable world cache can get ahead of a failed transaction.
  this.ctx.storage.transactionSync(()=>{
   this.save(result.player);
   if(result.code===0){
    if(result.tile!==target)this.sql.exec('INSERT INTO tiles VALUES (?,?,?,?,?) ON CONFLICT(x,y) DO UPDATE SET tile=excluded.tile',x,y,Math.floor(x/32),Math.floor(y/32),result.tile);
    this.sql.exec('UPDATE meta SET revision=revision+1 WHERE id=1');revision=this.revision();
   }
  });
  ws.send(JSON.stringify({type:'ack',code:result.code,player:result.player,revision}));
  if(result.code===0){
   const patch=result.tile!==target?{x,y,tile:result.tile}:null;
   this.broadcast({type:'event',player:publicPlayer(result.player),action:command,patch,revision});
   if(Math.floor(p.x/32)!==Math.floor(result.player.x/32)||Math.floor(p.y/32)!==Math.floor(result.player.y/32))this.snapshot(ws,result.player,'snapshot');
  }
 }
 webSocketClose(ws,code){try{ws.close(code===1005?1000:code,'Disconnected');}catch{}this.broadcast({type:'leave',id:ws.deserializeAttachment()?.id},ws);}
 webSocketError(ws){try{ws.close(1011,'Socket error');}catch{}}
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/')){
   const origin=request.headers.get('Origin');
   if(origin&&origin!==url.origin)return new Response('Origin mismatch',{status:403});
   // WebSocket upgrades require fetch forwarding; every player routes to this ONE ID.
   return env.WORLD.getByName(WORLD_ID).fetch(request);
  }
  return env.ASSETS.fetch(request);
 }
};
