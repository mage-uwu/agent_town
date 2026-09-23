import {FACTIONS,CLASSES} from '../src/identities.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createPlayer,generatePart,buildModel,renderModel,generateSheet,validatePlayer,manifest,PARTS,DIRECTIONS,STYLES,RENDER_LAYERS,GENDERS,TOOL_STYLES,generateTool,applyClass,setFaction,playerPalette,animationFrames,generateAnimationSheet,toolSheet} from '../src/generator.js';
import {encodePNG,exportBundle,crc32} from '../src/export.js';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

function decodePNG(bytes) {
  const b=Buffer.from(bytes);assert.deepEqual([...b.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  const chunks=[];let w,h;
  for(let at=8;at<b.length;) {const len=b.readUInt32BE(at),type=b.toString('ascii',at+4,at+8),body=b.subarray(at+8,at+8+len);assert.equal(crc32(b.subarray(at+4,at+8+len)),b.readUInt32BE(at+8+len));if(type==='IHDR'){w=body.readUInt32BE(0);h=body.readUInt32BE(4);assert.equal(body[9],6);}if(type==='IDAT')chunks.push(body);at+=len+12;}
  const raw=inflateSync(Buffer.concat(chunks)),pixels=Buffer.alloc(w*h*4);assert.equal(raw.length,h*(w*4+1));
  for(let y=0;y<h;y++){assert.equal(raw[y*(w*4+1)],0);raw.copy(pixels,y*w*4,y*(w*4+1)+1,(y+1)*(w*4+1));}
  return {w,h,pixels};
}
function readZIP(bytes) {
  const b=Buffer.from(bytes),files={};let at=0;
  while(b.readUInt32LE(at)===0x04034b50) {const len=b.readUInt32LE(at+18),nameLen=b.readUInt16LE(at+26),extra=b.readUInt16LE(at+28),name=b.toString('utf8',at+30,at+30+nameLen),start=at+30+nameLen+extra;assert.equal(b.readUInt16LE(at+8),0);files[name]=b.subarray(start,start+len);assert.equal(crc32(files[name]),b.readUInt32LE(at+14));at=start+len;}
  assert.equal(b.readUInt32LE(at),0x02014b50);assert.equal(b.readUInt32LE(b.length-22),0x06054b50);assert.equal(b.readUInt16LE(b.length-12),Object.keys(files).length);return files;
}
test('seed and serialized recipe reproduce identical sprites',()=>{
  const a=createPlayer('COPPER-005'),b=createPlayer('COPPER-005');assert.deepEqual(a,b);
  const restored=validatePlayer(JSON.parse(JSON.stringify(a)));
  assert.equal(digest(generateSheet(a).pixels),digest(generateSheet(restored).pixels));
  assert.notEqual(digest(generateSheet(a).pixels),digest(generateSheet(createPlayer('TOWN-FERN')).pixels));
});
test('regenerating a head preserves the independent hat and body models',()=>{
  const player=createPlayer('COPPER-005'),before=buildModel(player);
  player.parts.head=generatePart('head','OTHER');const after=buildModel(player);
  assert.deepEqual(before.layers.hat,after.layers.hat);assert.deepEqual(before.layers.body,after.layers.body);assert.notDeepEqual(before.layers.head,after.layers.head);
  for(const part of ['hat','body']) for(const direction of DIRECTIONS) assert.equal(digest(renderModel(before,direction,[part]).pixels),digest(renderModel(after,direction,[part]).pixels));
});
test('every style combination has four distinct, unclipped, binary-alpha views',()=>{
  const player=createPlayer('COPPER-005');let checked=0;
  for(const head of STYLES.head)for(const hat of STYLES.hat)for(const body of STYLES.body){
    player.parts.head.style=head;player.parts.hat.style=hat;player.parts.body.style=body;const model=buildModel(player),hashes=[];
    for(const dir of DIRECTIONS){const f=renderModel(model,dir);hashes.push(digest(f.pixels));let opaque=0;
      for(let y=0;y<48;y++)for(let x=0;x<48;x++){const alpha=f.pixels[(y*48+x)*4+3];assert.ok(alpha===0||alpha===255);if(alpha)opaque++;if(x===0||y===0||x===47||y===47)assert.equal(alpha,0,`${head}/${hat}/${body}/${dir} clipped`);}
      assert.ok(opaque>180);checked++;
    }
    assert.equal(new Set(hashes).size,4);
  }
  assert.equal(checked,576);
});
test('no hat produces a fully transparent isolated hat sheet',()=>{
  const p=createPlayer();p.parts.hat.style='none';assert.ok(generateSheet(p,['hat']).pixels.every(x=>x===0));
});
test('invalid imports are rejected before rendering',()=>{
  const valid=createPlayer();assert.throws(()=>validatePlayer({...valid,schemaVersion:99}));
  const bad=structuredClone(valid);bad.parts.head.width=10000;assert.throws(()=>validatePlayer(bad));
  assert.throws(()=>validatePlayer(null));assert.throws(()=>validatePlayer({...valid,palette:'unknown'}));assert.throws(()=>validatePlayer({...valid,name:7}));
});
test('exported PNG survives an independent zlib decode without changing a pixel',()=>{
  const sheet=generateSheet(createPlayer('COPPER-005')),decoded=decodePNG(encodePNG(sheet));assert.equal(decoded.w,192);assert.equal(decoded.h,48);assert.deepEqual(new Uint8Array(decoded.pixels),new Uint8Array(sheet.pixels));
});
test('ZIP has valid checksums, exact layer reconstruction, and resolvable manifest paths',()=>{
  const player=createPlayer('COPPER-005');player.equipment='sword';const bundle=exportBundle(player),files=readZIP(bundle),meta=JSON.parse(files['player.json']);assert.equal(Object.keys(files).length,15);
  assert.deepEqual(meta,manifest(player));const whole=decodePNG(files[meta.image]),layers=[...PARTS.map(p=>decodePNG(files[meta.parts[p].visibleLayer])),decodePNG(files[meta.equipmentLayer.visibleLayer])];
  for(const p of PARTS){assert.ok(files[meta.parts[p].image]);const isolated=decodePNG(files[meta.parts[p].image]);assert.equal(isolated.w,whole.w);assert.equal(isolated.h,whole.h);}
  const composite=Buffer.alloc(whole.pixels.length);
  for(const layer of layers)for(let i=0;i<composite.length;i+=4)if(layer.pixels[i+3]){assert.equal(composite[i+3],0,'visible layers should not overlap');layer.pixels.copy(composite,i,i,i+4);}
  assert.deepEqual(composite,whole.pixels);
  for(const action of ['sword_swing','pickaxe_swing']){const a=meta.animations[action],decoded=decodePNG(files[a.image]);assert.equal(decoded.w,a.size.w);assert.equal(decoded.h,a.size.h);assert.equal(a.frames.front.length,8);assert.equal(a.frames.front[5].event,action==='sword_swing'?'sword_hit':'pickaxe_hit');}
  for(const type of ['sword','pickaxe'])assert.ok(files[meta.tools[type].image]);
  assert.equal(digest(bundle),digest(exportBundle(player)));
});


test('gender recipes are repeatable and allow every head style',()=>{
  for(const gender of GENDERS){const p=createPlayer('COPPER-005',gender);assert.equal(validatePlayer(p).gender,gender);assert.deepEqual(p,createPlayer('COPPER-005',gender));for(const style of STYLES.head){p.parts.head.style=style;assert.equal(validatePlayer(p).parts.head.style,style);}}
  const old=createPlayer('OLD');delete old.gender;delete old.equipment;delete old.tools;old.schemaVersion=1;const migrated=validatePlayer(old);assert.equal(migrated.schemaVersion,3);assert.equal(migrated.gender,'male');assert.ok(migrated.tools.pickaxe);
});
test('tools have repeatable geometry and real seed diversity',()=>{
  for(const type of ['sword','pickaxe']) {
    const hashes=new Set();
    for(let n=0;n<24;n++){const tool=generateTool(type,`TOOL-${n}`);assert.deepEqual(tool,generateTool(type,`TOOL-${n}`));hashes.add(digest(toolSheet(tool).pixels));}
    assert.ok(hashes.size>=20,`${type} variants should change rendered assets`);
  }
  const p=createPlayer();p.equipment='sword';const before=buildModel(p);p.tools.sword=generateTool('sword','DIFFERENT');const after=buildModel(p);
  for(const part of PARTS)assert.deepEqual(before.layers[part],after.layers[part]);assert.notDeepEqual(before.layers.tool,after.layers.tool);
  assert.throws(()=>validatePlayer({...p,gender:'unknown'}));const bad=structuredClone(p);bad.tools.sword.length=999;assert.throws(()=>validatePlayer(bad));
});
test('both actions move the body and tool, loop cleanly, and keep all variants in frame',()=>{
  let framesChecked=0;
  for(const gender of GENDERS)for(const type of ['sword','pickaxe'])for(const style of TOOL_STYLES[type])for(const length of type==='sword'?[13,17]:[10,14]) {
    const p=createPlayer('COPPER-005',gender);p.parts.hat.style='wizard';p.parts.hat.height=10;p.tools[type].style=style;p.tools[type].length=length;p.tools[type].guard=5;
    const action=`${type}_swing`,frames=animationFrames(p,action);
    for(const d of DIRECTIONS){assert.equal(digest(frames[0][d].pixels),digest(frames[7][d].pixels),'loop seam');assert.ok(new Set(frames.map(f=>digest(f[d].pixels))).size>=6,'visible motion in each view');}
    for(const f of frames)for(const direction of DIRECTIONS){const image=f[direction];assert.equal(image.width,64);for(let n=0;n<64;n++)for(const i of [n,63*64+n,n*64,n*64+63])assert.equal(image.pixels[i*4+3],0,`${gender}/${type}/${style}/${length}/${direction} clipped`);framesChecked++;}
    const start=buildModel(p,{action,frame:0}),hit=buildModel(p,{action,frame:5});assert.notDeepEqual(start.layers.body,hit.layers.body);assert.notDeepEqual(start.layers.tool,hit.layers.tool);
  }
  assert.equal(framesChecked,1152);
});
test('action atlas positions and pixels match the corresponding live frames',()=>{
  const p=createPlayer('COPPER-005','female'),sheet=generateAnimationSheet(p,'pickaxe_swing'),frames=animationFrames(p,'pickaxe_swing'),meta=manifest(p).animations.pickaxe_swing;
  const png=decodePNG(encodePNG(sheet));assert.equal(png.w,512);assert.equal(png.h,256);
  for(const direction of DIRECTIONS)for(const frame of [0,3,5,7]){const rect=meta.frames[direction][frame],live=frames[frame][direction];for(let y=0;y<64;y++){const at=((rect.y+y)*512+rect.x)*4;assert.deepEqual(new Uint8Array(png.pixels.subarray(at,at+256)),new Uint8Array(live.pixels.subarray(y*256,(y+1)*256)));}}
});
test('left and right mean the direction the player faces on screen',()=>{
  const model=buildModel(createPlayer());for(const layer of Object.values(model.layers))layer.fill(0);
  // A marker in front of the face (+Z) must appear left of center when facing left.
  model.layers.head[(24*64+6+32)*64+32]=6;
  const centroid=direction=>{const frame=renderModel(model,direction);let total=0,n=0;for(let y=0;y<48;y++)for(let x=0;x<48;x++)if(frame.pixels[(y*48+x)*4+3]){total+=x;n++;}return total/n;};
  assert.ok(centroid('left')<24);assert.ok(centroid('right')>24);
});


test('every faction shares its palette across seeds, genders, and classes',()=>{
  for(const [faction,definition] of Object.entries(FACTIONS))if(definition.palette) {
    let colors;
    for(const gender of GENDERS)for(const classId of ['witch','gnome','knight','townsfolk']){
      const p=createPlayer(`FACTION-${gender}-${classId}`,gender,{classId,faction});assert.equal(p.palette,definition.palette);assert.equal(validatePlayer(p).faction,faction);
      const current=buildModel(p).colors.slice(1,6);if(colors)assert.deepEqual(current,colors);else colors=current;
      assert.deepEqual(manifest(p).faction.palette,playerPalette(p));
    }
  }
  const p=createPlayer('ONE','female',{classId:'knight',faction:'mossbound'}),other=setFaction(p,'violet_coven');
  assert.equal(other.classId,'knight');assert.deepEqual(other.parts,p.parts);assert.deepEqual(other.tools,p.tools);
  for(const layer of RENDER_LAYERS)assert.deepEqual(buildModel(p).layers[layer],buildModel(other).layers[layer]);
  assert.notEqual(digest(generateSheet(p).pixels),digest(generateSheet(other).pixels));
  const bad=structuredClone(p);bad.palette='plum';assert.throws(()=>validatePlayer(bad),/shared palette/);
  assert.throws(()=>validatePlayer({...p,faction:'constructor'}));assert.throws(()=>validatePlayer({...p,classId:'missing'}));
});
test('class presets are distinct and do not erase faction or generated tool variants',()=>{
  const original=createPlayer('CLASS','female',{faction:'tidewatch'}),hashes=[];
  for(const id of ['witch','gnome','knight','townsfolk']){
    const p=applyClass(original,id);assert.equal(p.classId,id);assert.equal(p.faction,original.faction);assert.equal(p.palette,original.palette);assert.deepEqual(p.tools,original.tools);assert.equal(p.equipment,CLASSES[id].equipment);assert.ok(CLASSES[id].hat.includes(p.parts.hat.style));assert.ok(CLASSES[id].body.includes(p.parts.body.style));hashes.push(digest(generateSheet(p).pixels));
    assert.deepEqual(p,createPlayer('CLASS','female',{classId:id,faction:'tidewatch'}));
    assert.equal(validatePlayer(JSON.parse(JSON.stringify(manifest(p).player))).classId,id);
  }
  assert.equal(new Set(hashes).size,4);assert.equal(original.classId,'custom');
  const old=createPlayer('LEGACY');old.schemaVersion=2;delete old.classId;delete old.faction;const migrated=validatePlayer(old);assert.equal(migrated.faction,'unaffiliated');assert.equal(migrated.classId,'custom');assert.deepEqual(migrated.tools,old.tools);
});
test('each class supports both swing animations without clipping in any view',()=>{
  for(const classId of ['witch','gnome','knight','townsfolk'])for(const gender of GENDERS)for(const action of ['sword_swing','pickaxe_swing']){
    const p=createPlayer('CLASS-ACTION',gender,{classId,faction:'emberguard'}),frames=animationFrames(p,action);
    for(const frame of frames)for(const d of DIRECTIONS){const image=frame[d];for(let n=0;n<64;n++)for(const i of [n,63*64+n,n*64,n*64+63])assert.equal(image.pixels[i*4+3],0,`${classId}/${gender}/${action}/${d} clipped`);}
  }
});
