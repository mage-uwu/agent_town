import { SIZE, PARTS, DIRECTIONS, buildModel, renderModel, generateSheet, manifest } from './generator.js';

const encoder = new TextEncoder();
const crcTable = Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++) n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes) { let crc=0xffffffff; for(const b of bytes) crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0; }
function concat(...arrays) { const result=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let at=0;for(const a of arrays){result.set(a,at);at+=a.length;}return result; }
function u32be(n) { return new Uint8Array([n>>>24,n>>>16&255,n>>>8&255,n&255]); }
function chunk(type, data) { const body=concat(encoder.encode(type),data);return concat(u32be(data.length),body,u32be(crc32(body))); }
/** Lossless RGBA PNG; stored DEFLATE blocks avoid browser or native dependencies. */
export function encodePNG({width,height,pixels}) {
  const rows=new Uint8Array(height*(width*4+1));
  for(let y=0;y<height;y++) rows.set(pixels.subarray(y*width*4,(y+1)*width*4),y*(width*4+1)+1);
  const blocks=[new Uint8Array([0x78,0x01])];
  for(let at=0;at<rows.length;at+=65535) {const n=Math.min(65535,rows.length-at);blocks.push(new Uint8Array([at+n===rows.length?1:0,n&255,n>>>8,(~n)&255,((~n)>>>8)&255]),rows.subarray(at,at+n));}
  let a=1,b=0;for(const n of rows){a=(a+n)%65521;b=(b+a)%65521;}blocks.push(u32be((b<<16|a)>>>0));
  return concat(new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',concat(u32be(width),u32be(height),new Uint8Array([8,6,0,0,0]))),chunk('IDAT',concat(...blocks)),chunk('IEND',new Uint8Array()));
}
/** Small standards-compliant ZIP writer, deterministic with no external library. */
export function encodeZIP(files) {
  const local=[],central=[];let offset=0;
  for(const [path,value] of Object.entries(files)) {
    const name=encoder.encode(path), data=typeof value==='string'?encoder.encode(value):value, crc=crc32(data);
    const header=new Uint8Array(30),v=new DataView(header.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);
    local.push(header,name,data);
    const c=new Uint8Array(46),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(14,33,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);central.push(c,name);
    offset+=header.length+name.length+data.length;
  }
  const directory=concat(...central),end=new Uint8Array(22),ev=new DataView(end.buffer),count=Object.keys(files).length;
  ev.setUint32(0,0x06054b50,true);ev.setUint16(8,count,true);ev.setUint16(10,count,true);ev.setUint32(12,directory.length,true);ev.setUint32(16,offset,true);
  return concat(...local,directory,end);
}
export function exportBundle(player) {
  const meta=manifest(player),files={'player.png':encodePNG(generateSheet(player)), 'player.json':JSON.stringify(meta,null,2)};
  const model=buildModel(player),frames=DIRECTIONS.map(d=>renderModel(model,d));
  for(const part of PARTS) {
    files[`parts/${part}.png`]=encodePNG(generateSheet(player,[part]));
    const id=PARTS.indexOf(part)+1,width=SIZE*4,pixels=new Uint8ClampedArray(width*SIZE*4);
    frames.forEach((frame,col)=>{for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const i=y*SIZE+x;if(frame.owners[i]===id)pixels.set(frame.pixels.subarray(i*4,i*4+4),(y*width+col*SIZE+x)*4);}});
    files[`layers/${part}.png`]=encodePNG({width,height:SIZE,pixels});
  }
  files['README.txt']='AGENT TOWN / PLAYER ASSET\n\nAll PNGs are native resolution, transparent RGBA.\nFour columns: front, back, left, right. Each frame is 48 x 48 pixels.\nFeet anchor: (24, 43). Use nearest-neighbor scaling.\n\nplayer.png: complete character.\nparts/: complete isolated assets, using the same registration.\nlayers/: visible portions of each part; overlay these to reconstruct player.png exactly.\nTo swap parts, rerender the shared model for correct depth and occlusion.\nplayer.json: editable recipe, frame coordinates and version. Import into the workshop to recreate.\n';
  return encodeZIP(files);
}
