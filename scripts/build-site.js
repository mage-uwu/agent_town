import {cpSync,mkdirSync} from 'node:fs';
mkdirSync('build/site',{recursive:true});
for(const path of ['world','src','dist','index.html','style.css'])cpSync(path,`build/site/${path}`,{recursive:true});
console.log('Built Cloudflare static assets in build/site');
