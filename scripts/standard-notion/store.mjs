import {resolve,join} from 'node:path';
import {GenerationStore} from '../basic-notion/store.mjs';
import {reject} from './plan.mjs';
export class StandardStore extends GenerationStore{
 constructor(runId,directory=resolve('.notion-standard-state')){const path=resolve(directory);if(path.split('/').some(part=>['.notion-generation-state','.notion-poc-state'].includes(part)))reject('protected_state_directory');super(runId,path);}
 targetStore(parentId){return new StandardStore(`parent-${parentId.replaceAll('-','')}`,join(this.directory,'targets'));}
}
