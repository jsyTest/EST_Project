import {readFile,stat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {NotionClient} from '../notion-poc/client.mjs';
import {prepareExecution,freezeBasicPlan,validateApproval,reject} from './plan.mjs';
import {GenerationStore} from './store.mjs';
import {basicPreflight,executeBasic,verifyBasic} from './engine.mjs';
async function json(path,max=1000000){if(!path)reject('missing_file');if((await stat(path)).size>max)reject('input_file_limit');try{return JSON.parse(await readFile(path,'utf8'));}catch{reject('invalid_json_file');}}
export function publicRun(state){return {task:state.task,runId:state.runId,planId:state.planId,planHash:state.planHash,requestHash:state.requestHash,status:state.status,target:state.target,remote:state.remote,propertyIds:state.propertyIds,writeAttempts:state.writeAttempts,startedAt:state.startedAt,updatedAt:state.updatedAt,verification:state.verification,error:state.error,reconciliation:state.reconciliation,reusedExistingRun:state.reusedExistingRun??false};}
export async function main(args,env=process.env){
 const command=args[0]??'dry-run',options={};
 if(!['dry-run','preflight','apply','resume','verify','inspect'].includes(command))reject('unknown_command');
 for(let i=1;i<args.length;i+=2){const key=args[i];if(!['--plan','--target','--run-id','--approval','--confirm-request','--state-dir'].includes(key)||!args[i+1]||args[i+1].startsWith('--')||Object.hasOwn(options,key))reject('invalid_arguments');options[key]=args[i+1];}
 const runId=options['--run-id'];
 if(command==='inspect'){if(Object.keys(options).some(k=>!['--run-id','--state-dir'].includes(k)))reject('invalid_arguments');const state=await new GenerationStore(runId,options['--state-dir']).read();if(!state)reject('run_not_found');return publicRun(state);}
 const plan=await json(options['--plan']);
 if(command==='dry-run'&&!options['--target'])return {mode:'dry-run',spec:freezeBasicPlan(plan),networkRequests:0,parent:'unassigned',creationApproval:'required'};
 const prepared=prepareExecution(plan,await json(options['--target'],65536),runId);
 if(command==='dry-run')return prepared;
 let approval;
 if(['apply','resume'].includes(command)){approval=await json(options['--approval'],65536);validateApproval(approval,prepared);if(options['--confirm-request']!==prepared.requestHash)reject('request_hash_confirmation_required');}
 if(!env.NOTION_API_TOKEN?.trim())reject('notion_token_missing');
 // No automatic retries, including POST 429. Explicit inspection/resume decides next steps.
 const client=new NotionClient({token:env.NOTION_API_TOKEN.trim(),maxRetries:0});
 if(command==='preflight')return basicPreflight(client,prepared.target);
 const store=new GenerationStore(runId,options['--state-dir']);
 if(command==='verify'){const state=await store.read();if(!state)reject('run_not_found');await basicPreflight(client,prepared.target);return verifyBasic(client,prepared,state);}
 return publicRun(await executeBasic({plan,target:prepared.target,runId,approval,store,client,resume:command==='resume'}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const result=await main(process.argv.slice(2));console.log(JSON.stringify(result,null,2));if(result.status&&result.status!=='verified'||result.ok===false)process.exitCode=2;}catch(error){console.error(JSON.stringify({status:'stopped',code:/^[a-z0-9_]{1,80}$/.test(error?.code??'')?error.code:'local_or_execution_error'}));process.exitCode=1;}}
