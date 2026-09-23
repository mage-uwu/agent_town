import { FACTIONS, CLASSES } from './identities.js';
import { ACTIONS, ACTION_FRAMES, ACTION_FPS, ACTION_SIZE, ACTION_ANCHOR, unit, cross, actionTool, rigPose } from './rig.js';

/** Pure, dependency-free player generator. Coordinates: +Y up, +Z face, +X right. */
export const VERSION = 3;
export const SIZE = 48;
export const DIRECTIONS = ['front', 'back', 'left', 'right'];
export const PARTS = ['body', 'head', 'hat'];
export const RENDER_LAYERS = [...PARTS, 'tool'];
export const GENDERS = ['male', 'female', 'nonbinary'];
export const TOOL_STYLES = {sword:['longsword','falchion','rapier'],pickaxe:['crescent','prospector','warpick']};
export const TOOL_MATERIALS = {iron:{name:'Iron',base:'#9aaab3',edge:'#dae6dc'},bronze:{name:'Bronze',base:'#b4854e',edge:'#f3d39a'},obsidian:{name:'Obsidian',base:'#51465f',edge:'#a99cc8'}};
export const STYLES = {
  head: ['braided', 'full', 'trimmed', 'clean', 'bob', 'ponytail'],
  hat: ['ranger', 'wizard', 'helmet', 'hood', 'none', 'cap'],
  body: ['tunic', 'coat', 'armor', 'apron'],
};
export const PALETTES = {
  moss: { name: 'Moss & copper', cloth: '#71825b', hat: '#617348', trim: '#d4ad69', leather: '#714a39', metal: '#8b9ca3' },
  ember: { name: 'Ember & iron', cloth: '#a24e40', hat: '#794037', trim: '#e3b66f', leather: '#533d38', metal: '#919899' },
  tide: { name: 'Tide & silver', cloth: '#537f91', hat: '#3b5c79', trim: '#c7c5a0', leather: '#584737', metal: '#a1b6bd' },
  plum: { name: 'Plum & gold', cloth: '#805576', hat: '#694367', trim: '#d7ad5c', leather: '#544044', metal: '#9696a8' },
  ochre: { name: 'Ochre & earth', cloth: '#b28a43', hat: '#936638', trim: '#e4c790', leather: '#634836', metal: '#98a395' },
};
export const SKINS = ['#e4b38b', '#c79069', '#a86c4e', '#744936', '#f0ceb0'];
export const HAIRS = ['#a56438', '#5b3c2f', '#cfb074', '#cec9b4', '#33343b', '#7d4235'];

export function hash(text) {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function random(seed) {
  let a = hash(seed);
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function pick(rng, values) { return values[Math.floor(rng() * values.length)]; }
export function generatePart(part, seed, gender = 'male', classId = 'custom') {
  if (!PARTS.includes(part)) throw new Error('Unknown player part');
  const rng = random(`${part}:${seed}`);
  const headChoices=gender==='female'?['clean','bob','ponytail']:gender==='nonbinary'?['clean','trimmed','bob','ponytail']:['braided','full','trimmed','clean'];
  if(!Object.hasOwn(CLASSES,classId))throw new Error('Unknown class');
  const choices=CLASSES[classId][part]??(part==='head'?headChoices:STYLES[part]);
  const style = pick(rng, choices);
  if (part === 'head') return { seed: String(seed), style, hair: pick(rng, HAIRS), width: pick(rng, [5, 6]), brow: pick(rng, [0, 1]) };
  if (part === 'hat') return { seed: String(seed), style, height: pick(rng, [8, 9, 10]), feather: rng() > 0.35 };
  return { seed: String(seed), style, width: pick(rng, [6, 7]), buttons: rng() > 0.45 };
}
export function generateTool(type, seed) {
  if(!TOOL_STYLES[type])throw new Error('Unknown tool type');
  const rng=random(`${type}:${seed}`);
  return {type,seed:String(seed),style:pick(rng,TOOL_STYLES[type]),material:pick(rng,Object.keys(TOOL_MATERIALS)),length:pick(rng,type==='sword'?[13,15,17]:[10,12,14]),guard:pick(rng,[3,4,5]),grip:pick(rng,['#684431','#473c4c','#794743']),gem:pick(rng,['#b75c47','#6ba4a5','#c8ad5d'])};
}
export function createPlayer(seed = 'COPPER-005', gender = 'male', options = {}) {
  if(!GENDERS.includes(gender))throw new Error('Unknown gender');
  const rng = random(seed), names=gender==='female'?['Bryn','Hilda','Moss','Wren','Ada','Fenna','Thora','Merrin']:gender==='nonbinary'?['Bram','Ash','Moss','Wren','Ember','Flint','Rowan','Merrin']:['Bram','Orrin','Moss','Wren','Dorin','Flint','Torren','Merrin'];
  const player = { schemaVersion: VERSION, type: 'player', seed: String(seed), gender, faction:'unaffiliated', classId:'custom', name: pick(rng,names) + ' ' + pick(rng, ['Copperbrook', 'Ironfern', 'Ashvale', 'Stonebriar', 'Oakmantle', 'Emberfoot']), palette: pick(rng, Object.keys(PALETTES)), skin: SKINS[hash(seed) % SKINS.length], parts: Object.fromEntries(PARTS.map(part => [part, generatePart(part, seed, gender)])), equipment:'none', tools:{sword:generateTool('sword',seed),pickaxe:generateTool('pickaxe',seed)} };
  return setFaction(applyClass(player,options.classId??'custom'),options.faction??'unaffiliated');
}
export function validatePlayer(input) {
  if(input?.schemaVersion===1)input={...input,schemaVersion:2,gender:'male',equipment:'none',tools:{sword:generateTool('sword',input.seed),pickaxe:generateTool('pickaxe',input.seed)}};
  if(input?.schemaVersion===2)input={...input,schemaVersion:VERSION,faction:'unaffiliated',classId:'custom'};
  if(!input || !Object.hasOwn(FACTIONS,input.faction) || !Object.hasOwn(CLASSES,input.classId))throw new Error('Invalid faction or class.');
  if (!input || input.schemaVersion !== VERSION || input.type !== 'player' || !Object.hasOwn(PALETTES,input.palette)) throw new Error('Not a supported Agent Town player recipe.');
  if (typeof input.name !== 'string' || input.name.length > 100 || typeof input.seed !== 'string' || input.seed.length > 100) throw new Error('Invalid name or seed.');
  for (const part of PARTS) {
    const p = input.parts?.[part];
    if (!p || !STYLES[part].includes(p.style) || typeof p.seed !== 'string' || p.seed.length > 100) throw new Error(`Invalid ${part} recipe.`);
  }
  if(FACTIONS[input.faction].palette && input.palette!==FACTIONS[input.faction].palette)throw new Error('Faction members must use their shared palette.');
  const {head, hat, body} = input.parts;
  if (!SKINS.includes(input.skin) || !HAIRS.includes(head.hair) || ![5, 6].includes(head.width) || ![0, 1].includes(head.brow)) throw new Error('Invalid head recipe.');
  if (![8, 9, 10].includes(hat.height) || typeof hat.feather !== 'boolean') throw new Error('Invalid hat recipe.');
  if (![6, 7].includes(body.width) || typeof body.buttons !== 'boolean') throw new Error('Invalid body recipe.');
  if(!GENDERS.includes(input.gender)||!['none','sword','pickaxe'].includes(input.equipment))throw new Error('Invalid gender or equipment.');
  const tools={};
  for(const type of ['sword','pickaxe']) {
    const t=input.tools?.[type];
    if(!t || t.type!==type || typeof t.seed!=='string' || t.seed.length>100 || !TOOL_STYLES[type].includes(t.style) || !Object.hasOwn(TOOL_MATERIALS,t.material) || !(type==='sword'?[13,15,17]:[10,12,14]).includes(t.length) || ![3,4,5].includes(t.guard) || !['#684431','#473c4c','#794743'].includes(t.grip) || !['#b75c47','#6ba4a5','#c8ad5d'].includes(t.gem))throw new Error(`Invalid ${type} recipe.`);
    tools[type]={type,seed:t.seed,style:t.style,material:t.material,length:t.length,guard:t.guard,grip:t.grip,gem:t.gem};
  }
  // Copy only public recipe fields; imported metadata cannot affect the renderer.
  return { schemaVersion: VERSION, type: 'player', seed: input.seed, gender:input.gender, faction:input.faction, classId:input.classId, equipment:input.equipment, tools, name: input.name, palette: input.palette, skin: input.skin, parts: { head: {seed:head.seed, style:head.style, hair:head.hair, width:head.width, brow:head.brow}, hat: {seed:hat.seed, style:hat.style, height:hat.height, feather:hat.feather}, body: {seed:body.seed, style:body.style, width:body.width, buttons:body.buttons} } };
}

export function setFaction(player, faction) {
  if(!Object.hasOwn(FACTIONS,faction))throw new Error('Unknown faction');
  const next=structuredClone(player);next.faction=faction;
  if(FACTIONS[faction].palette)next.palette=FACTIONS[faction].palette;
  return next;
}
export function applyClass(player, classId) {
  if(!Object.hasOwn(CLASSES,classId))throw new Error('Unknown class');
  const next=structuredClone(player);next.classId=classId;
  if(classId==='custom')return next;
  for(const part of PARTS)next.parts[part]=generatePart(part,player.parts[part].seed,player.gender,classId);
  if(classId==='witch') {next.parts.head.style=player.gender==='male'?'trimmed':'ponytail';next.parts.hat.height=10;}
  if(classId==='gnome') {next.parts.head.style=player.gender==='male'?'full':'bob';next.parts.head.width=6;next.parts.hat.height=10;next.parts.body.width=7;}
  next.equipment=CLASSES[classId].equipment;
  return next;
}
export function playerPalette(player) {return PALETTES[FACTIONS[player.faction]?.palette??player.palette];}

const N = 64, OFFSET = 32;
const index = (x, y, z) => (y * N + z + OFFSET) * N + x + OFFSET;
function toolColors(tool) {const material=TOOL_MATERIALS[tool.material];return [material.base,material.edge,tool.grip,'#c6a767',tool.gem];}
/** Generate canonical tool geometry around a grip at (0,0,0), then inverse-sample a rigid transform. */
function transformTool(tool, position, axis) {
  const local=new Uint8Array(N**3),result=new Uint8Array(N**3);
  const put=(x,y,z,m)=>{local[index(x,y+8,z)]=m;};
  const box=(x0,y0,z0,x1,y1,z1,m)=>{for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++)put(x,y,z,m);};
  if(tool.type==='sword') {
    box(-1,-3,-1,1,4,1,13);box(-2,-4,-1,2,-2,1,14);box(-1,-4,1,1,-2,2,15);
    const guard=tool.guard;box(-guard,3,-1,guard,5,1,14);
    if(tool.style==='rapier') {box(-guard,0,-1,-guard+1,4,1,14);box(-guard,0,-1,0,1,1,14);}
    for(let y=5;y<tool.length+5;y++) {
      const t=(y-5)/tool.length,tip=t>.8;
      const half=tool.style==='rapier'?1:tool.style==='falchion'?(t>.3&&!tip?3:2):2;
      const curve=tool.style==='falchion'?Math.floor(t*2):0;
      const radius=tip?1:half;
      box(-radius+curve,y,-1,radius+curve,y+1,1,11);
      box(-radius+curve,y,0,-radius+curve+1,y+1,1,12);
    }
    box(-1,5,1,1,8,2,14);put(0,6,2,15);
  } else {
    box(-1,-5,-1,1,tool.length+1,1,13);
    for(let y=-4;y<5;y+=3)box(-1,y,-1,1,y+1,1,14);
    const reach=tool.guard+3;
    for(let x=-reach;x<=reach;x++) {
      const distance=Math.abs(x),bend=tool.style==='crescent'?Math.floor(distance*.48):tool.style==='warpick'?Math.floor(distance*.25):Math.floor(distance*.12);
      const thick=distance<reach-2?2:1;
      box(x,tool.length-bend,-1,x+1,tool.length-bend+thick,1,11);put(x,tool.length-bend+thick,0,12);
      if(tool.style==='prospector'&&x<-reach+2)box(x,tool.length-2,-2,x+1,tool.length+2,2,11);
    }
    box(-2,tool.length-1,-2,2,tool.length+2,2,14);box(-1,tool.length,2,1,tool.length+2,3,15);
  }
  const u=unit(cross(axis,Math.abs(axis[2])>.99?[0,1,0]:[0,0,1])),v=cross(u,axis);
  const corners=[];
  for(const x of [-10,10])for(const y of [-6,tool.length+6])for(const z of [-3,3])corners.push(position.map((p,i)=>p+x*u[i]+y*axis[i]+z*v[i]));
  const lo=[0,1,2].map(i=>Math.floor(Math.min(...corners.map(p=>p[i])))),hi=[0,1,2].map(i=>Math.ceil(Math.max(...corners.map(p=>p[i]))));
  for(let y=Math.max(0,lo[1]);y<Math.min(N,hi[1]);y++)for(let z=Math.max(-OFFSET,lo[2]);z<Math.min(OFFSET,hi[2]);z++)for(let x=Math.max(-OFFSET,lo[0]);x<Math.min(OFFSET,hi[0]);x++) {
    const delta=[x+.5-position[0],y+.5-position[1],z+.5-position[2]],dot=a=>a.reduce((n,k,i)=>n+k*delta[i],0);
    const lx=Math.floor(dot(u)),ly=Math.floor(dot(axis))+8,lz=Math.floor(dot(v));
    if(lx>=-OFFSET&&lx<OFFSET&&ly>=0&&ly<N&&lz>=-OFFSET&&lz<OFFSET)result[index(x,y,z)]=local[index(lx,ly,lz)];
  }
  return result;
}
export function buildToolModel(tool) {
  const layers=Object.fromEntries(RENDER_LAYERS.map(p=>[p,new Uint8Array(N**3)]));
  layers.tool=transformTool(tool,[0,12,0],[0,1,0]);
  return {layers,colors:[null,...Array(10).fill('#222222'),...toolColors(tool)],size:48,anchor:{x:24,y:41}};
}
export function buildModel(player, options = {}) {
  const action=options.action??'idle',frame=options.frame??0;
  if(!ACTIONS.includes(action))throw new Error('Unknown action');
  const equipped=actionTool(action,options.equipment??player.equipment), tool=equipped==='none'?null:player.tools[equipped];
  const { head, hat, body } = player.parts, palette = playerPalette(player);
  const layers = Object.fromEntries(RENDER_LAYERS.map(p => [p, new Uint8Array(N ** 3)]));
  const colors = [null, palette.cloth, palette.hat, palette.trim, palette.leather, palette.metal, player.skin, head.hair, '#24252c', '#e8dcad', '#b05c41', ...(tool?toolColors(tool):['#9aaab3','#dae6dc','#684431','#c6a767','#6ba4a5'])];
  let layer;
  const set = (x,y,z,m) => { if (x>=-32 && x<32 && y>=0 && y<64 && z>=-32 && z<32) layer[index(x,y,z)] = m; };
  const box = (x0,y0,z0,x1,y1,z1,m) => { for(let y=y0;y<y1;y++) for(let z=z0;z<z1;z++) for(let x=x0;x<x1;x++) set(x,y,z,m); };
  const ellipsoid = (cx,cy,cz,rx,ry,rz,m) => {
    for(let y=Math.floor(cy-ry);y<cy+ry;y++) for(let z=Math.floor(cz-rz);z<cz+rz;z++) for(let x=Math.floor(cx-rx);x<cx+rx;x++)
      if (((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2+((z+.5-cz)/rz)**2<=1) set(x,y,z,m);
  };
  layer = layers.body;
  const w = body.width-(player.gender==='female'?1:0), stride=0, rig=rigPose(action,frame,w);
  const limb=(a,b,r,m)=>{const length=Math.hypot(...a.map((v,i)=>v-b[i]));for(let t=0;t<=length;t+=.5){const f=length?t/length:0;ellipsoid(...a.map((v,i)=>v+(b[i]-v)*f),r,r,r,m);}};
  // Legs and opposite arm swing share the same rig in every view.
  for (const side of [-1,1]) {
    const x = side < 0 ? -5 : 1, step = stride * side;
    box(x,3,-2+step,x+4,10,3+step,4);
    box(x-1,1,-3+step,x+5,5,5+step,4);
    box(x-1,1,2+step,x+5,2,5+step,8);
    box(x,4,2+step,x+4,5,4+step,3);
  }
  const suitMaterial = body.style === 'armor' ? 5 : 1;
  ellipsoid(0,14,0,w+1,8,4.5,suitMaterial);
  box(-w,9,-3,w,19,4,suitMaterial);
  if(player.gender==='female') {box(-w,12,-4,-w+1,17,5,0);box(w-1,12,-4,w,17,5,0);} 
  if(body.style === 'coat') { box(-w,6,-3,-1,12,4,1); box(1,6,-3,w,12,4,1); box(-1,10,4,1,22,5,3); }
  if(body.style === 'apron') { box(-4,7,4,4,18,5,4); box(-2,17,4,2,22,5,4); box(-4,10,5,4,12,6,3); box(-w,14,-5,w,15,-4,4); }
  if(body.style === 'armor') { box(-w,16,4,w,17,5,3); box(-1,12,4,1,21,5,3); box(-w,10,-4,w,11,4,5); box(-3,13,5,3,21,6,1); box(-3,13,-5,3,21,-4,1); }
  box(-w,11,-4,w,13,5,4); box(-2,11,5,2,14,6,3); box(-1,12,6,1,13,7,4);
  for(const side of [-1,1]) {
    const x = side*(w+1), swing = -stride*side;
    if(tool&&(side===1||action==='pickaxe_swing')) {
      const hand=side===1?rig.hand:rig.hand.map((v,i)=>v+rig.axis[i]*3);
      const shoulder=[x,19,0],elbow=[(x+hand[0])*.5,Math.min(18,hand[1]-2),hand[2]*.55-1];
      limb(shoulder,elbow,2.5,suitMaterial);limb(elbow,hand,1.8,suitMaterial);ellipsoid(...hand,2.2,2.2,2.2,6);
      ellipsoid(...hand.map((v,i)=>v+(elbow[i]-v)*.25),2,2,2,3);
      continue;
    }
    ellipsoid(x,18,swing,3.5,4,3.5,suitMaterial);
    box(x-2,12,swing-2,x+2,18,swing+3,suitMaterial);
    box(x-2,12,swing-2,x+2,14,swing+3,3);
    ellipsoid(x,11,swing+.5,2.3,2.8,2.4,6);
    if(body.style==='armor') box(x-3,19,swing-2,x+3,21,swing+3,5);
  }
  box(-4,20,-2,4,23,3,3); box(-2,21,-1,2,24,3,6);
  if(body.buttons && body.style==='tunic') for(let y=15;y<=19;y+=2) set(0,y,4,3);
  // One asymmetric satchel: its side stays attached in all four directions.
  box(w-1,9,-1,w+2,14,3,4); box(w-1,13,2,w+2,14,4,3);
  // Head volumes include hair, ears, nose, brows, facial hair and a back clasp.
  layer = layers.head;
  const hw = head.width;
  ellipsoid(0,27,0,hw+1,6.8,5.2,7);
  ellipsoid(0,26,1.5,hw,5.5,4.6,6);
  for(const s of [-1,1]) ellipsoid(s*hw,26,1,1.8,2.3,1.8,6);
  box(-hw,29,-2,hw,32,3,7);
  for(let x=-hw+1;x<hw;x+=3) box(x,28,3,x+2,31,5,7);
  box(-4,26,5,-2,27,6,8); box(2,26,5,4,27,6,8);
  box(-4,28+head.brow,4,-1,29+head.brow,6,7); box(1,28+head.brow,4,4,29+head.brow,6,7);
  box(-1,24,5,1,27,7,6);
  box(-2,22,5,2,23,6,10);
  if(['braided','full','trimmed'].includes(head.style)) {
    const length = {trimmed:3, full:7, braided:8}[head.style];
    ellipsoid(0,23-length/2,3.3,hw-.5,length/2+2,3.3,7);
    box(-hw+1,23,4,hw-1,25,6,7); box(-1,24,6,1,26,7,6);
    if(head.style==='braided') for(const side of [-1,1]) {
      for(let y=15;y<23;y++) box(side*3-1,y,5,side*3+1,y+1,7-(y%2),7);
      box(side*3-1,16,5,side*3+1,18,7,3);
    }
  }
  if(head.style==='braided') { box(-2,20,-6,2,27,-4,7); box(-2,21,-6,2,23,-5,3); }
  if(head.style==='bob') {box(-hw-1,22,-4,-hw+1,29,3,7);box(hw-1,22,-4,hw+1,29,3,7);box(-hw,22,-6,hw,28,-3,7);}
  if(head.style==='ponytail') {ellipsoid(0,27,-6,3,4,2,7);box(-2,18,-7,2,27,-4,7);box(-2,24,-8,2,26,-6,3);for(let y=18;y<24;y+=2)box(-1,y,-8,2,y+1,-6,7);}
  // Hat geometry is a volume, never four independently drawn templates.
  layer = layers.hat;
  if(hat.style==='ranger') {
    ellipsoid(0,32,0,10,1.5,7,2); ellipsoid(0,34,-.5,6.8,4.7,5,2);
    box(-5,32,4,5,34,5,4); box(-2,32,5,1,34,6,3);
    if(hat.feather) { for(let y=33;y<38;y++) box(6,y,-1,8, y+1,1, y%3===0?3:9); box(5,33,0,6,37,1,4); }
  } else if(hat.style==='wizard') {
    ellipsoid(0,32,0,11,1.2,7,2);
    for(let y=32;y<30+hat.height;y++) { const r = Math.max(1,(30+hat.height-y)*.63); ellipsoid(-(y-32)*.18,y,0,r,.8,r*.8,2); }
    box(-5,33,3,5,35,5,3); box(1,37,3,3,39,4,3);
  } else if(hat.style==='cap') {
    ellipsoid(0,32,0,7.5,1.3,5.5,3);
    for(let y=32;y<30+hat.height;y++){const r=Math.max(1,(31+hat.height-y)*.72);ellipsoid((y-32)*.1,y,0,r,.8,r*.8,2);}
  } else if(hat.style==='helmet') {
    ellipsoid(0,32,0,7.8,5.5,6.2,5); box(-7,30,4,7,32,6,3);
    box(-1,32,5,1,35,7,3); box(-1,35,-4,1,38,4,1);
    for(const s of [-1,1]) { box(s<0?-8:6,26,-3,s<0?-6:8,32,2,5); box(s<0?-8:6,28,1,s<0?-6:8,30,3,3); }
  } else if(hat.style==='hood') {
    ellipsoid(0,31,-1,8,6.8,6,2);
    box(-6,26,2,6,32,8,0); // Open face, cut from this part only.
    box(-8,25,-3,-6,31,4,2); box(6,25,-3,8,31,4,2);
    box(-8,24,-5,8,26,2,2); box(-6,25,3,-4,27,5,3); box(4,25,3,6,27,5,3);
  }
  if(rig.bob)for(const part of PARTS) {
    const original=layers[part],shifted=new Uint8Array(N**3);
    for(let y=0;y<N;y++)for(let z=-OFFSET;z<OFFSET;z++)for(let x=-OFFSET;x<OFFSET;x++){const m=original[index(x,y,z)];if(m)shifted[index(x,y>8?y-rig.bob:y,z)]=m;}
    layers[part]=shifted;
  }
  if(tool) {
    const position=rig.hand.map((v,i)=>i===1?v-rig.bob:v);
    layers.tool=transformTool(tool,position,rig.axis);
  }
  return {layers, colors, action, rig: {...rig, tool:equipped}, size:action==='idle'?SIZE:ACTION_SIZE, anchor:action==='idle'?{x:24,y:43}:ACTION_ANCHOR};
}

function rgb(hex) { return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)); }
function shade(hex, level) {
  const color=rgb(hex), factor=[.48,.72,.9,1.12][level];
  return color.map((v,i)=>Math.max(0,Math.min(255,Math.round(v*factor+(level===3?[7,5,0][i]:0)))));
}
/** Orthographic ray projection: all views sample the exact same part volumes. */
export function renderModel(model, direction, visible = RENDER_LAYERS) {
  if(!DIRECTIONS.includes(direction)) throw new Error('Unknown direction');
  const size=model.size??SIZE,anchor=model.anchor??{x:24,y:43};
  const out = new Uint8ClampedArray(size*size*4), owners = new Uint8Array(size*size), depth = new Float32Array(size*size).fill(-Infinity);
  const voxels = new Uint8Array(N**3), parts = new Uint8Array(N**3);
  for(const part of RENDER_LAYERS) if(visible.includes(part)) {
    const data=model.layers[part], id=RENDER_LAYERS.indexOf(part)+1;
    for(let i=0;i<data.length;i++) if(data[i]) {voxels[i]=data[i];parts[i]=id;}
  }
  const swatches = model.colors.map(c=>c ? [0,1,2,3].map(level=>shade(c,level)) : null);
  const sample=(x,y,z)=> x>=-32&&x<32&&z>=-32&&z<32&&y>=0&&y<64 ? voxels[index(x,y,z)] : 0;
  for(let py=0;py<size;py++) for(let px=0;px<size;px++) {
    const u=px-anchor.x+.5, h=anchor.y-(py+.5);
    for(let v=31;v>=-31;v-=.25) {
      const y=Math.floor(h+v*.5);
      let x,z;
      if(direction==='front') {x=Math.floor(u);z=Math.floor(v);}
      else if(direction==='back') {x=Math.floor(-u);z=Math.floor(-v);}
      else if(direction==='left') {x=Math.floor(v);z=Math.floor(-u);}
      else {x=Math.floor(-v);z=Math.floor(u);}
      const mat=sample(x,y,z); if(!mat) continue;
      let level=2;
      if(!sample(x,y+1,z)) level=3;
      else if(sample(x,y+2,z)) level=1;
      // Broad color clusters: tiny, deterministic surface highlights, no random pixel noise.
      if(mat===7 && (x+z+48)%4===0 && level===2) level=1;
      const i=py*size+px, c=swatches[mat][level];
      out.set([...c,255],i*4); owners[i]=parts[index(x,y,z)]; depth[i]=v;
      break;
    }
  }
  // One-pixel silhouette, kept inside the shared 48px registration box.
  const before=out.slice();
  for(let y=1;y<size-1;y++) for(let x=1;x<size-1;x++) {
    const i=y*size+x;
    if(before[i*4+3]) continue;
    const neighbor=[i-1,i+1,i-size,i+size].find(j=>before[j*4+3]);
    if(neighbor!==undefined) {out.set([35,32,36,255],i*4);owners[i]=owners[neighbor];}
  }
  return { width: size, height: size, pixels: out, owners, depth };
}
export function renderPlayer(player, direction = 'front', visible = RENDER_LAYERS, options = {}) {
  return renderModel(buildModel(player,options),direction,visible);
}
export function generateSheet(player, visible = RENDER_LAYERS) {
  const width=SIZE*4, height=SIZE, pixels=new Uint8ClampedArray(width*height*4);
  const model=buildModel(player);
  DIRECTIONS.forEach((direction,col)=>{ const frame=renderModel(model,direction,visible); for(let y=0;y<SIZE;y++) pixels.set(frame.pixels.subarray(y*SIZE*4,(y+1)*SIZE*4),(y*width+col*SIZE)*4); });
  return { width,height,pixels };
}
export function animationFrames(player, action) {
  if(!ACTIONS.includes(action)||action==='idle')throw new Error('Choose a swing animation');
  return Array.from({length:ACTION_FRAMES},(_,frame)=>{const model=buildModel(player,{action,frame});return Object.fromEntries(DIRECTIONS.map(d=>[d,renderModel(model,d)]));});
}
export function generateAnimationSheet(player, action) {
  const frames=animationFrames(player,action),width=ACTION_SIZE*ACTION_FRAMES,height=ACTION_SIZE*4,pixels=new Uint8ClampedArray(width*height*4);
  DIRECTIONS.forEach((d,row)=>frames.forEach((f,col)=>{for(let y=0;y<ACTION_SIZE;y++)pixels.set(f[d].pixels.subarray(y*ACTION_SIZE*4,(y+1)*ACTION_SIZE*4),((row*ACTION_SIZE+y)*width+col*ACTION_SIZE)*4);}));
  return {width,height,pixels};
}
export function toolSheet(tool) {
  const model=buildToolModel(tool),width=SIZE*4,height=SIZE,pixels=new Uint8ClampedArray(width*height*4);
  DIRECTIONS.forEach((d,col)=>{const f=renderModel(model,d,['tool']);for(let y=0;y<SIZE;y++)pixels.set(f.pixels.subarray(y*SIZE*4,(y+1)*SIZE*4),(y*width+col*SIZE)*4);});
  return {width,height,pixels};
}
export function manifest(player) {
  const registered=part=>({image:`parts/${part}.png`,visibleLayer:`layers/${part}.png`,sameRegistration:true});
  return {
    generator:'agent-town/player',generatorVersion:VERSION,player:validatePlayer(player),
    faction:{id:player.faction,name:FACTIONS[player.faction].name,palette:playerPalette(player)},class:{id:player.classId,name:CLASSES[player.classId].name},
    image:'player.png',size:{w:192,h:48},frameSize:{w:48,h:48},alpha:true,anchor:{x:24,y:43},directionOrder:DIRECTIONS,
    frames:Object.fromEntries(DIRECTIONS.map((dir,i)=>[dir,{x:i*48,y:0,w:48,h:48}])),
    parts:Object.fromEntries(PARTS.map(p=>[p,registered(p)])),equipmentLayer:registered('tool'),
    tools:Object.fromEntries(['sword','pickaxe'].map(type=>[type,{image:`tools/${type}.png`,recipe:player.tools[type],frameSize:{w:48,h:48},gripAnchor:{x:24,y:29},directionOrder:DIRECTIONS}])),
    animations:Object.fromEntries(['sword_swing','pickaxe_swing'].map(action=>[action,{
      image:`animations/${action}.png`,size:{w:512,h:256},frameSize:{w:64,h:64},anchor:ACTION_ANCHOR,
      frameCount:ACTION_FRAMES,fps:ACTION_FPS,loop:true,hitFrame:5,equippedTool:actionTool(action,player.equipment),
      rows:DIRECTIONS,columns:'time',
      frames:Object.fromEntries(DIRECTIONS.map((d,row)=>[d,Array.from({length:ACTION_FRAMES},(_,frame)=>({x:frame*64,y:row*64,w:64,h:64,durationMs:1000/ACTION_FPS,event:frame===5?(action==='sword_swing'?'sword_hit':'pickaxe_hit'):null}))]))
    }])),
    compositing:'Overlay visible layers to reconstruct the standing player. Re-render combined voxel model after swapping parts for correct occlusion.'
  };
}
