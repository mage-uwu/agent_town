import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createPlayer,generatePart,buildModel,renderModel,generateSheet,validatePlayer,manifest,PARTS,DIRECTIONS,STYLES} from '../src/generator.js';
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
  assert.equal(checked,320);
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
  const player=createPlayer('COPPER-005'),bundle=exportBundle(player),files=readZIP(bundle),meta=JSON.parse(files['player.json']);assert.equal(Object.keys(files).length,9);
  assert.deepEqual(meta,manifest(player));const whole=decodePNG(files[meta.image]),layers=PARTS.map(p=>decodePNG(files[meta.parts[p].visibleLayer]));
  for(const p of PARTS){assert.ok(files[meta.parts[p].image]);const isolated=decodePNG(files[meta.parts[p].image]);assert.equal(isolated.w,whole.w);assert.equal(isolated.h,whole.h);}
  const composite=Buffer.alloc(whole.pixels.length);
  for(const layer of layers)for(let i=0;i<composite.length;i+=4)if(layer.pixels[i+3]){assert.equal(composite[i+3],0,'visible layers should not overlap');layer.pixels.copy(composite,i,i,i+4);}
  assert.deepEqual(composite,whole.pixels);
  assert.equal(digest(bundle),digest(exportBundle(player)));
});
