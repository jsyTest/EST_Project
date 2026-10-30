import {mkdir,lstat,open,rename,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {RunStore} from '../notion-poc/state.mjs';
import {reject} from './plan.mjs';
// Reuse PoC locking/JSON reading, with a separate namespace and durable atomic writes.
export class GenerationStore extends RunStore{
 constructor(runId,directory=resolve('.notion-generation-state')){
  const path=resolve(directory);if(path.split('/').includes('.notion-poc-state'))reject('protected_state_directory');
  super(runId,path);
 }
 async lock(){
  const current=await lstat(this.directory).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
  if(current&&(!current.isDirectory()||current.isSymbolicLink()))reject('invalid_state_directory');
  try{await super.lock();}catch(error){reject(error.message?.includes('잠금')?'run_locked':'state_lock_failed');}
 }
 async read(){try{return await super.read();}catch{reject('state_read_failed');}}
 async save(state){
  await mkdir(this.directory,{recursive:true,mode:0o700});
  const temporary=join(this.directory,`.tmp-${process.pid}-${randomUUID()}`);let file;
  try{file=await open(temporary,'wx',0o600);await file.writeFile(JSON.stringify(state,null,2)+'\n');await file.sync();await file.close();file=null;await rename(temporary,this.path);
   const directory=await open(this.directory,'r');try{await directory.sync();}catch(e){if(!['EINVAL','ENOTSUP'].includes(e.code))throw e;}finally{await directory.close();}
  }finally{if(file)await file.close().catch(()=>{});await unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 }
 targetStore(parentId){return new GenerationStore(`parent-${parentId.replaceAll('-','')}`,join(this.directory,'targets'));}
}
