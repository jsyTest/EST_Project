import {readFile,stat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {compileSchema} from '../../js/mapping/model.mjs';
export async function mappingDryRun(path) {
 if(!path)throw new Error('사용법: node scripts/notion-poc/mapping-dry-run.mjs <mapping-model.json>');
 if((await stat(path)).size>1000000)throw new Error('모델 파일은 1 MB 이하여야 합니다.');
 const raw=await readFile(path,'utf8');
 return compileSchema(JSON.parse(raw));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 try{console.log(JSON.stringify(await mappingDryRun(process.argv[2]),null,2));}catch(e){console.error(e.message);process.exitCode=1;}
}
