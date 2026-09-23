import {readFile,mkdir,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=file=>readFile(new URL(file,root),'utf8');
const [html,css,...modules]=await Promise.all(['index.html','style.css','src/generator.js','src/export.js','src/app.js'].map(read));
const js=modules.map(s=>s.replace(/^import .*?;\n/gm,'').replace(/^export /gm,'')).join('\n');
const standalone=html.replace('<link rel="stylesheet" href="style.css">',()=>`<style>${css.replace(/^@import[^;]+;\n/,'')}</style>`).replace('<script type="module" src="src/app.js"></script>',()=>`<script type="module">${js}</script>`);
await mkdir(new URL('dist/',root),{recursive:true});await writeFile(new URL('dist/player-workshop.html',root),standalone);
console.log('Built dist/player-workshop.html (self-contained; no install or server needed)');
