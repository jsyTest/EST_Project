import {readFile,stat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {NotionClient} from '../notion-poc/client.mjs';
import {prepareStandard,validateStandardApproval,reject} from './plan.mjs';
import {StandardStore} from './store.mjs';
import {standardPreflight} from './remote.mjs';
import {verifyStandard} from './verify.mjs';
import {executeStandard} from './engine.mjs';
async function json(path){if(!path)reject('missing_file');if((await stat(path)).size>1000000)reject('input_file_limit');try{return JSON.parse(await readFile(path,'utf8'));}catch{reject('invalid_json_file');}}
export async function main(args,env=process.env){
 const command=args[0]??'dry-run',o={};if(!['dry-run','preflight','apply','resume','verify','inspect'].includes(command))reject('unknown_command');
 for(let i=1;i<args.length;i+=2){const k=args[i];if(!['--plan','--target','--fixture','--run-id','--approval','--confirm-request','--state-dir'].includes(k)||!args[i+1]||args[i+1].startsWith('--')||Object.hasOwn(o,k))reject('invalid_arguments');o[k]=args[i+1];}
 const runId=o['--run-id'],store=new StandardStore(runId,o['--state-dir']);
 if(command==='inspect'){const s=await store.read();if(!s)reject('run_not_found');return s;}
 const plan=await json(o['--plan']),target=await json(o['--target']),fixture=await json(o['--fixture']),prepared=prepareStandard(plan,target,runId,fixture);
 if(command==='dry-run')return prepared;
 let approval;if(['apply','resume'].includes(command)){approval=await json(o['--approval']);validateStandardApproval(approval,prepared);if(o['--confirm-request']!==prepared.requestHash)reject('request_hash_confirmation_required');}
 if(!env.NOTION_API_TOKEN?.trim())reject('notion_token_missing');const client=new NotionClient({token:env.NOTION_API_TOKEN.trim(),maxRetries:0});
 if(command==='preflight')return standardPreflight(client,prepared.target);
 if(command==='verify'){const state=await store.read();if(!state)reject('run_not_found');await standardPreflight(client,prepared.target);return verifyStandard(client,prepared,state);}
 return executeStandard({plan,target,fixture,runId,approval,client,store,resume:command==='resume'});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const r=await main(process.argv.slice(2));console.log(JSON.stringify(r,null,2));if(r.status&&r.status!=='verified'||r.ok===false)process.exitCode=2;}catch(e){console.error(JSON.stringify({status:'stopped',code:/^[a-z0-9_]{1,80}$/.test(e?.code??'')?e.code:'local_or_execution_error'}));process.exitCode=1;}}
