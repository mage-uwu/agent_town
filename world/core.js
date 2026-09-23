export const WORLD_SEED=1709123;
export const ENGINE_VERSION=1;
export const LIMIT=1048576;
export const BIOMES=['','Forest','Beach','Ocean','Volcanic','Jungle'];
export const OBJECTS=['','Pine','Oak','Palm','Jungle tree','Boulder','Iron ore','Fiber'];
export const ERRORS=['OK','Unknown action','Out of reach','Path blocked','Nothing to collect','Tile occupied','Not enough resources','Cannot build here','Inventory full'];
export function engine(instance){
 const e=instance.exports;
 if(e.at_version()!==ENGINE_VERSION)throw new Error('World engine version mismatch');
 return {
  raw:e,
  tile:(x,y)=>e.at_base(WORLD_SEED,x,y)>>>0,
  variant:(x,y)=>e.at_variant(WORLD_SEED,x,y)>>>0,
  walkable:t=>Boolean(e.at_walkable(t)),
  chunk(cx,cy){if(!e.at_chunk(WORLD_SEED,cx,cy))throw new Error('Outside world');return new Uint32Array(e.memory.buffer,e.at_chunk_data(),1024).slice();},
  apply(p,command,tile,occupied=false){
   e.at_set_player(p.x,p.y,p.wood,p.stone,p.ore,p.fiber,p.revision);
   const code=e.at_apply(command.kind,command.dx,command.dy,command.structure??0,tile,Number(occupied));
   const data=new DataView(e.memory.buffer,e.at_player_data(),28);
   const next={...p,x:data.getInt32(0,true),y:data.getInt32(4,true)};
   ['wood','stone','ore','fiber','revision'].forEach((key,i)=>next[key]=data.getUint32(8+i*4,true));
   return {code,player:next,tile:e.at_result_tile()>>>0};
  }
 };
}
export async function loadEngine(url=new URL('./engine.wasm',import.meta.url)){
 const response=await fetch(url);if(!response.ok)throw new Error('Could not load C world engine');
 const {instance}=await WebAssembly.instantiate(await response.arrayBuffer(),{});return engine(instance);
}
export function validCommand(m){return m&&m.type==='action'&&Number.isSafeInteger(m.seq)&&m.seq>0&&Number.isInteger(m.kind)&&m.kind>=1&&m.kind<=4&&Number.isInteger(m.dx)&&Math.abs(m.dx)<=1&&Number.isInteger(m.dy)&&Math.abs(m.dy)<=1&&(m.dx!==0||m.dy!==0)&&Number.isInteger(m.structure??0)&&(m.structure??0)>=0&&(m.structure??0)<=19;}
export function newPlayer(id,x=0,y=0){return {id,x,y,wood:0,stone:0,ore:0,fiber:0,revision:0,seq:0};}
export function publicPlayer(p){return {id:p.id,x:p.x,y:p.y};}
