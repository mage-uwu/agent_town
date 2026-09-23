/** Pure, dependency-free player generator. Coordinates: +Y up, +Z face, +X right. */
export const VERSION = 1;
export const SIZE = 48;
export const DIRECTIONS = ['front', 'back', 'left', 'right'];
export const PARTS = ['body', 'head', 'hat'];
export const STYLES = {
  head: ['braided', 'full', 'trimmed', 'clean'],
  hat: ['ranger', 'wizard', 'helmet', 'hood', 'none'],
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
export function generatePart(part, seed) {
  if (!PARTS.includes(part)) throw new Error('Unknown player part');
  const rng = random(`${part}:${seed}`);
  const style = pick(rng, STYLES[part]);
  if (part === 'head') return { seed: String(seed), style, hair: pick(rng, HAIRS), width: pick(rng, [5, 6]), brow: pick(rng, [0, 1]) };
  if (part === 'hat') return { seed: String(seed), style, height: pick(rng, [8, 9, 10]), feather: rng() > 0.35 };
  return { seed: String(seed), style, width: pick(rng, [6, 7]), buttons: rng() > 0.45 };
}
export function createPlayer(seed = 'COPPER-042') {
  const rng = random(seed);
  return { schemaVersion: VERSION, type: 'player', seed: String(seed), name: pick(rng, ['Bram', 'Orrin', 'Moss', 'Wren', 'Hilda', 'Flint', 'Thora', 'Merrin']) + ' ' + pick(rng, ['Copperbrook', 'Ironfern', 'Ashvale', 'Stonebriar', 'Oakmantle', 'Emberfoot']), palette: pick(rng, Object.keys(PALETTES)), skin: SKINS[hash(seed) % SKINS.length], parts: Object.fromEntries(PARTS.map(part => [part, generatePart(part, seed)])) };
}
export function validatePlayer(input) {
  if (!input || input.schemaVersion !== VERSION || input.type !== 'player' || !PALETTES[input.palette]) throw new Error('Not a supported Agent Town player recipe.');
  if (typeof input.name !== 'string' || input.name.length > 100 || typeof input.seed !== 'string' || input.seed.length > 100) throw new Error('Invalid name or seed.');
  for (const part of PARTS) {
    const p = input.parts?.[part];
    if (!p || !STYLES[part].includes(p.style) || typeof p.seed !== 'string' || p.seed.length > 100) throw new Error(`Invalid ${part} recipe.`);
  }
  const {head, hat, body} = input.parts;
  if (!SKINS.includes(input.skin) || !HAIRS.includes(head.hair) || ![5, 6].includes(head.width) || ![0, 1].includes(head.brow)) throw new Error('Invalid head recipe.');
  if (![8, 9, 10].includes(hat.height) || typeof hat.feather !== 'boolean') throw new Error('Invalid hat recipe.');
  if (![6, 7].includes(body.width) || typeof body.buttons !== 'boolean') throw new Error('Invalid body recipe.');
  // Copy only public recipe fields; imported metadata cannot affect the renderer.
  return { schemaVersion: VERSION, type: 'player', seed: input.seed, name: input.name, palette: input.palette, skin: input.skin, parts: { head: {seed:head.seed, style:head.style, hair:head.hair, width:head.width, brow:head.brow}, hat: {seed:hat.seed, style:hat.style, height:hat.height, feather:hat.feather}, body: {seed:body.seed, style:body.style, width:body.width, buttons:body.buttons} } };
}

const N = 48, OFFSET = 24;
const index = (x, y, z) => (y * N + z + OFFSET) * N + x + OFFSET;
export function buildModel(player, pose = 0) {
  const { head, hat, body } = player.parts, palette = PALETTES[player.palette];
  const layers = Object.fromEntries(PARTS.map(p => [p, new Uint8Array(N ** 3)]));
  const colors = [null, palette.cloth, palette.hat, palette.trim, palette.leather, palette.metal, player.skin, head.hair, '#24252c', '#e8dcad', '#b05c41'];
  let layer;
  const set = (x,y,z,m) => { if (x>=-24 && x<24 && y>=0 && y<48 && z>=-24 && z<24) layer[index(x,y,z)] = m; };
  const box = (x0,y0,z0,x1,y1,z1,m) => { for(let y=y0;y<y1;y++) for(let z=z0;z<z1;z++) for(let x=x0;x<x1;x++) set(x,y,z,m); };
  const ellipsoid = (cx,cy,cz,rx,ry,rz,m) => {
    for(let y=Math.floor(cy-ry);y<cy+ry;y++) for(let z=Math.floor(cz-rz);z<cz+rz;z++) for(let x=Math.floor(cx-rx);x<cx+rx;x++)
      if (((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2+((z+.5-cz)/rz)**2<=1) set(x,y,z,m);
  };
  layer = layers.body;
  const w = body.width, stride = [0, 2, 0, -2][pose % 4];
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
  if(body.style === 'coat') { box(-w,6,-3,-1,12,4,1); box(1,6,-3,w,12,4,1); box(-1,10,4,1,22,5,3); }
  if(body.style === 'apron') { box(-4,7,4,4,18,5,4); box(-2,17,4,2,22,5,4); box(-4,10,5,4,12,6,3); box(-w,14,-5,w,15,-4,4); }
  if(body.style === 'armor') { box(-w,16,4,w,17,5,3); box(-1,12,4,1,21,5,3); box(-w,10,-4,w,11,4,5); }
  box(-w,11,-4,w,13,5,4); box(-2,11,5,2,14,6,3); box(-1,12,6,1,13,7,4);
  for(const side of [-1,1]) {
    const x = side*(w+1), swing = -stride*side;
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
  if(head.style !== 'clean') {
    const length = {trimmed:3, full:7, braided:8}[head.style];
    ellipsoid(0,23-length/2,3.3,hw-.5,length/2+2,3.3,7);
    box(-hw+1,23,4,hw-1,25,6,7); box(-1,24,6,1,26,7,6);
    if(head.style==='braided') for(const side of [-1,1]) {
      for(let y=15;y<23;y++) box(side*3-1,y,5,side*3+1,y+1,7-(y%2),7);
      box(side*3-1,16,5,side*3+1,18,7,3);
    }
  }
  if(head.style==='braided') { box(-2,20,-6,2,27,-4,7); box(-2,21,-6,2,23,-5,3); }
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
  } else if(hat.style==='helmet') {
    ellipsoid(0,32,0,7.8,5.5,6.2,5); box(-7,30,4,7,32,6,3);
    box(-1,32,5,1,35,7,3); box(-1,35,-4,1,38,4,3);
    for(const s of [-1,1]) { box(s<0?-8:6,26,-3,s<0?-6:8,32,2,5); box(s<0?-8:6,28,1,s<0?-6:8,30,3,3); }
  } else if(hat.style==='hood') {
    ellipsoid(0,31,-1,8,6.8,6,2);
    box(-6,26,2,6,32,8,0); // Open face, cut from this part only.
    box(-8,25,-3,-6,31,4,2); box(6,25,-3,8,31,4,2);
    box(-8,24,-5,8,26,2,2); box(-6,25,3,-4,27,5,3); box(4,25,3,6,27,5,3);
  }
  return {layers, colors};
}

function rgb(hex) { return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)); }
function shade(hex, level) {
  const color=rgb(hex), factor=[.48,.72,.9,1.12][level];
  return color.map((v,i)=>Math.max(0,Math.min(255,Math.round(v*factor+(level===3?[7,5,0][i]:0)))));
}
/** Orthographic ray projection: all views sample the exact same part volumes. */
export function renderModel(model, direction, visible = PARTS) {
  if(!DIRECTIONS.includes(direction)) throw new Error('Unknown direction');
  const out = new Uint8ClampedArray(SIZE*SIZE*4), owners = new Uint8Array(SIZE*SIZE), depth = new Float32Array(SIZE*SIZE).fill(-Infinity);
  const voxels = new Uint8Array(N**3), parts = new Uint8Array(N**3);
  for(const part of PARTS) if(visible.includes(part)) {
    const data=model.layers[part], id=PARTS.indexOf(part)+1;
    for(let i=0;i<data.length;i++) if(data[i]) {voxels[i]=data[i];parts[i]=id;}
  }
  const swatches = model.colors.map(c=>c ? [0,1,2,3].map(level=>shade(c,level)) : null);
  const sample=(x,y,z)=> x>=-24&&x<24&&z>=-24&&z<24&&y>=0&&y<48 ? voxels[index(x,y,z)] : 0;
  for(let py=0;py<SIZE;py++) for(let px=0;px<SIZE;px++) {
    const u=px-23.5, h=43-(py+.5);
    for(let v=18;v>=-18;v-=.25) {
      const y=Math.floor(h+v*.5);
      let x,z;
      if(direction==='front') {x=Math.floor(u);z=Math.floor(v);}
      else if(direction==='back') {x=Math.floor(-u);z=Math.floor(-v);}
      else if(direction==='left') {x=Math.floor(-v);z=Math.floor(u);}
      else {x=Math.floor(v);z=Math.floor(-u);}
      const mat=sample(x,y,z); if(!mat) continue;
      let level=2;
      if(!sample(x,y+1,z)) level=3;
      else if(sample(x,y+2,z)) level=1;
      // Broad color clusters: tiny, deterministic surface highlights, no random pixel noise.
      if(mat===7 && (x+z+48)%4===0 && level===2) level=1;
      const i=py*SIZE+px, c=swatches[mat][level];
      out.set([...c,255],i*4); owners[i]=parts[index(x,y,z)]; depth[i]=v;
      break;
    }
  }
  // One-pixel silhouette, kept inside the shared 48px registration box.
  const before=out.slice();
  for(let y=1;y<SIZE-1;y++) for(let x=1;x<SIZE-1;x++) {
    const i=y*SIZE+x;
    if(before[i*4+3]) continue;
    const neighbor=[i-1,i+1,i-SIZE,i+SIZE].find(j=>before[j*4+3]);
    if(neighbor!==undefined) {out.set([35,32,36,255],i*4);owners[i]=owners[neighbor];}
  }
  return { width: SIZE, height: SIZE, pixels: out, owners, depth };
}
export function renderPlayer(player, direction = 'front', visible = PARTS, pose = 0) {
  return renderModel(buildModel(player,pose),direction,visible);
}
export function generateSheet(player, visible = PARTS) {
  const width=SIZE*4, height=SIZE, pixels=new Uint8ClampedArray(width*height*4);
  const model=buildModel(player);
  DIRECTIONS.forEach((direction,col)=>{ const frame=renderModel(model,direction,visible); for(let y=0;y<SIZE;y++) pixels.set(frame.pixels.subarray(y*SIZE*4,(y+1)*SIZE*4),(y*width+col*SIZE)*4); });
  return { width,height,pixels };
}
export function manifest(player) {
  return { generator:'agent-town/player', generatorVersion:VERSION, player:validatePlayer(player), image:'player.png', size:{w:192,h:48}, frameSize:{w:48,h:48}, alpha:true, anchor:{x:24,y:43}, directionOrder:DIRECTIONS, frames:Object.fromEntries(DIRECTIONS.map((dir,i)=>[dir,{x:i*48,y:0,w:48,h:48}])), parts:Object.fromEntries(PARTS.map(p=>[p,{image:`parts/${p}.png`,visibleLayer:`layers/${p}.png`,sameRegistration:true,compositing:'Overlay visible layers to reconstruct this player. Re-render combined voxel model after swapping parts for correct occlusion.'}])) };
}
