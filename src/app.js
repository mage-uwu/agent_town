import { SIZE, PARTS, DIRECTIONS, STYLES, PALETTES, createPlayer, generatePart, buildModel, renderModel, generateSheet, validatePlayer, manifest } from './generator.js';
import { encodePNG, exportBundle } from './export.js';

const $ = id => document.getElementById(id);
const title = s => s[0].toUpperCase()+s.slice(1);
const labels = { braided:'Braided beard',full:'Full beard',trimmed:'Short beard',clean:'Clean shaven',ranger:'Ranger’s felt hat',wizard:'Wayfarer’s point',helmet:'Iron & brass helm',hood:'Traveler’s hood',none:'No hat',tunic:'Belted tunic',coat:'Long field coat',armor:'Forged plate',apron:'Artisan’s apron' };
const lockIcon = locked => `<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="9" width="12" height="9" rx="1"/><path d="${locked?'M6 9V6a4 4 0 0 1 8 0v3':'M6 9V6a4 4 0 0 1 8 0'}"/><path d="M10 12v3"/></svg>`;
const locks = new Set();
let player = createPlayer('COPPER-005'), direction='front', frames={}, model, rotation=null, toastTimer;
function canvas(frame, target) { target.width=frame.width;target.height=frame.height;target.getContext('2d').putImageData(new ImageData(frame.pixels,frame.width,frame.height),0,0); }
function toast(message) { $('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2800); }
function freshSeed() { const value=new Uint32Array(1);crypto.getRandomValues(value);return `TOWN-${value[0].toString(36).toUpperCase()}`; }
function stopRotation() { clearInterval(rotation);rotation=null;$('rotate-toggle').setAttribute('aria-pressed','false'); }
function selectDirection(next) {
  direction=next;canvas(frames[next],$('hero'));$('preview-label').textContent=`${next.toUpperCase()} VIEW`;
  document.querySelectorAll('.view-button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.direction===next)));
}
function refresh() {
  model=buildModel(player);frames=Object.fromEntries(DIRECTIONS.map(d=>[d,renderModel(model,d)]));
  $('seed').value=player.seed;$('player-name').textContent=player.name;
  for(const dir of DIRECTIONS) canvas(frames[dir],$(`view-${dir}`));
  for(const part of PARTS) { canvas(renderModel(model,'front',[part]),$(`part-${part}`));$(`style-${part}`).value=player.parts[part].style; }
  $('palette-name').textContent=PALETTES[player.palette].name;
  document.querySelectorAll('.palette-button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.palette===player.palette)));
  selectDirection(direction);
}
function replacePlayer(next, honorLocks=true) {
  if(honorLocks) { for(const part of locks) next.parts[part]=structuredClone(player.parts[part]); if(locks.has('hat')||locks.has('body')) next.palette=player.palette; if(locks.has('head')||locks.has('body')) next.skin=player.skin; }
  player=next;refresh();
}
for(const dir of DIRECTIONS) {
  const button=document.createElement('button');button.className='view-button';button.dataset.direction=dir;button.setAttribute('aria-label',`${title(dir)} view`);
  button.innerHTML=`<span class="view-arrow" aria-hidden="true">${{front:'↓',back:'↑',left:'←',right:'→'}[dir]}</span><canvas id="view-${dir}" width="48" height="48"></canvas><span class="view-name">${dir.toUpperCase()}</span>`;
  button.addEventListener('click',()=>{stopRotation();selectDirection(dir);});$('views').append(button);
}
['head','hat','body'].forEach((part,i)=>{
  const row=document.createElement('section');row.className='part-control';
  row.innerHTML=`<div class="part-icon"><canvas id="part-${part}" width="48" height="48" aria-label="Isolated ${part}"></canvas></div><div class="part-edit"><label for="style-${part}" class="part-title"><span>0${i+1}</span> ${part.toUpperCase()}</label><select id="style-${part}" aria-label="${title(part)} style">${STYLES[part].map(s=>`<option value="${s}">${labels[s]}</option>`).join('')}</select></div><div class="part-tools"><button class="small-button" id="reroll-${part}" aria-label="Regenerate ${part}" title="Regenerate ${part}">↻</button><button class="small-button" id="lock-${part}" aria-label="Lock ${part}" aria-pressed="false" title="Keep ${part} when generating" >${lockIcon(false)}</button></div>`;
  $('part-controls').append(row);
  $(`style-${part}`).addEventListener('change',e=>{player.parts[part].style=e.target.value;refresh();});
  $(`reroll-${part}`).addEventListener('click',()=>{player.parts[part]=generatePart(part,freshSeed());refresh();toast(`A new ${part}, in every direction.`);});
  $(`lock-${part}`).addEventListener('click',()=>{locks.has(part)?locks.delete(part):locks.add(part);const locked=locks.has(part);$(`lock-${part}`).setAttribute('aria-pressed',String(locked));$(`lock-${part}`).innerHTML=lockIcon(locked);$(`reroll-${part}`).disabled=locked;toast(`${title(part)} ${locked?'locked for generation':'unlocked'}.`);});
});
for(const [key,palette] of Object.entries(PALETTES)) {
  const button=document.createElement('button');button.className='palette-button';button.dataset.palette=key;button.setAttribute('aria-label',palette.name);button.title=palette.name;
  for(const color of [palette.cloth,palette.hat,palette.trim,palette.leather]) {const swatch=document.createElement('span');swatch.style.background=color;button.append(swatch);}
  button.addEventListener('click',()=>{player.palette=key;refresh();});$('palettes').append(button);
}
$('generate').addEventListener('click',()=>{const seed=$('seed').value.trim();if(!seed){toast('Give your character a seed first.');$('seed').focus();return;}replacePlayer(createPlayer(seed));toast('Character generated. All four views are ready.');});
$('seed').addEventListener('keydown',e=>{if(e.key==='Enter')$('generate').click();});
$('randomize').addEventListener('click',()=>{replacePlayer(createPlayer(freshSeed()));toast('Someone new has arrived.');});
$('grid-toggle').addEventListener('click',()=>{const off=$('stage').classList.toggle('no-grid');$('grid-toggle').setAttribute('aria-pressed',String(!off));});
$('rotate-toggle').addEventListener('click',()=>{if(rotation){stopRotation();return;}$('rotate-toggle').setAttribute('aria-pressed','true');const order=['front','left','back','right'];rotation=setInterval(()=>selectDirection(order[(order.indexOf(direction)+1)%4]),900);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopRotation();});
function download(bytes, filename, type) {
  const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
$('save-png').addEventListener('click',()=>{download(encodePNG(generateSheet(player)),'player.png','image/png');toast('Sprite sheet exported · 192 × 48 pixels');});
$('save-recipe').addEventListener('click',()=>{download(JSON.stringify(manifest(player),null,2),'player.json','application/json');toast('Player recipe exported.');});
$('export').addEventListener('click',()=>{try{download(exportBundle(player),'agent-town-player.zip','application/zip');toast('Player assets exported · four views, three parts, one recipe');}catch(error){toast(`Could not export: ${error.message}`);}});
$('import').addEventListener('click',()=>$('recipe-file').click());
$('recipe-file').addEventListener('change',async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw new Error('Please choose a player recipe smaller than 100 KB.');const parsed=JSON.parse(await file.text()),next=validatePlayer(parsed.player??parsed);replacePlayer(next,false);toast('Welcome back. Your player recipe is restored.');}catch(error){toast(error.message);}finally{e.target.value='';}});
const starterSeeds=['COPPER-005','TOWN-MICA','TOWN-MOON','TOWN-FERN','TOWN-ASH','TOWN-EMBER'];
for(const seed of starterSeeds) {
  const p=createPlayer(seed),button=document.createElement('button');button.className='lineup-card';button.setAttribute('aria-label',`Load ${p.name}`);
  const preview=document.createElement('canvas');canvas(renderModel(buildModel(p),'front'),preview);button.append(preview);
  const name=document.createElement('span');name.textContent=p.name.split(' ')[0].toUpperCase();button.append(name);
  const hat=document.createElement('small');hat.textContent=title(p.parts.body.style);button.append(hat);
  button.addEventListener('click',()=>{replacePlayer(createPlayer(seed));toast(`${p.name.split(' ')[0]} is at the looking glass.`);});$('lineup').append(button);
}
refresh();
