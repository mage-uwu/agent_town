import {spawnSync} from 'node:child_process';
import {mkdirSync,existsSync} from 'node:fs';
const compiler=process.env.CLANG ?? (existsSync('/opt/homebrew/opt/llvm/bin/clang')?'/opt/homebrew/opt/llvm/bin/clang':'clang');
mkdirSync('build',{recursive:true});mkdirSync('world',{recursive:true});
const args=['--target=wasm32','-std=c11','-O2','-Wall','-Wextra','-Werror','-ffreestanding','-fno-builtin','-nostdlib','-Wl,--no-entry','-Wl,--export-all','-Wl,--initial-memory=131072','-Wl,--max-memory=131072','engine/world.c','-o','world/engine.wasm'];
const result=spawnSync(compiler,args,{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);
console.log('Built world/engine.wasm: portable C, fixed 128 KiB memory, no imports.');
