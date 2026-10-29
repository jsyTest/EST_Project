import {readFile,stat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createGenerationPlan} from '../js/planner/plan.mjs';
export async function generationPlanDryRun(file,settingsFile){
 if(!file)throw new Error('사용법: node scripts/generation-plan-dry-run.mjs <configuration-v1.json> [plan-settings.json]');
 for(const path of [file,settingsFile].filter(Boolean))if((await stat(path)).size>1000000)throw new Error('입력 JSON은 1 MB 이하여야 합니다.');
 const value=JSON.parse(await readFile(file,'utf8')),settings=settingsFile?JSON.parse(await readFile(settingsFile,'utf8')):{};
 return createGenerationPlan(value,settings);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.length>4)throw new Error('불필요한 인자가 있습니다.');const plan=await generationPlanDryRun(process.argv[2],process.argv[3]);console.log(JSON.stringify(plan,null,2));if(!plan.dryRunValid)process.exitCode=2;}
 catch(error){console.error(error.message);process.exitCode=1;}
}
