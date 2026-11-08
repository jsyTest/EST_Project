import {createHash} from 'node:crypto';
import {readFile, lstat} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {reject} from '../../server/review-errors.mjs';
import {notionId} from '../../server/notion/test-configuration.mjs';
import {NOTION_VERSION} from '../../js/planner/catalog.mjs';
import {LOCAL_READ_POLICY} from './approval.mjs';

export const LOCAL_ORIGIN = 'http://127.0.0.1:8796';
export const CODE_PATHS = Object.freeze([
  ...['server','controller','package','secret','browser'].map(n=>`scripts/notion-local/two-get-${n}.mjs`),
  'scripts/notion-local/approval.mjs', 'server/notion/test-readonly.mjs',
  'server/notion/test-auth.mjs', 'server/notion/test-configuration.mjs',
  'server/draft-ownership.mjs', 'server/supabase-readonly.mjs', 'server/review-errors.mjs',
  'js/planner/catalog.mjs', 'js/supabase-client.js',
  'scripts/notion-poc/tests/notion-two-get-controller.test.mjs',
  'scripts/notion-poc/tests/notion-two-get-server.test.mjs'
]);
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HEX = /^[a-f0-9]{64}$/;
export const sourceDigest = source => createHash('sha256').update(source).digest('hex');
export function packageDigest(value) { return sourceDigest(JSON.stringify(canonical(value))); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
export async function computeCodeDigest(root=ROOT) {
  const hash=createHash('sha256');
  for(const path of CODE_PATHS) {
    try {
      const file=join(resolve(root),path), info=await lstat(file);
      if(!info.isFile() || info.isSymbolicLink() || info.size>1048576) reject(503,'local_code_invalid');
      const bytes=await readFile(file);
      hash.update(path+'\0'+bytes.length+'\0'); hash.update(bytes);
    } catch {reject(503,'local_code_invalid');}
  }
  return hash.digest('hex');
}
function exact(value,keys) {
  if(!value || Object.getPrototypeOf(value)!==Object.prototype ||
    Object.keys(value).length!==keys.length || keys.some(k=>!Object.hasOwn(value,k)) ||
    Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!Object.hasOwn(d,'value'))) reject(403,'local_package_invalid');
}
const PKEYS=['version','userId','workspaceId','botId','parentId','draftId','scope','policy','apiVersion','origin',
  'codeDigest','sdkDigest','supabaseOrigin','publishableKeyDigest','expiresAt','credentialKind','acceptBroaderPermissions','evidence'];
const RKEYS=['version','approved','packageDigest','codeDigest','expiresAt','approvalRef'];
export function validateReviewedReadPackage({reviewPackage,receipt,codeDigest,now=Date.now(),expectedOrigin=LOCAL_ORIGIN}) {
  exact(reviewPackage,PKEYS); exact(receipt,RKEYS);
  const p=reviewPackage,r=receipt;
  const ids=['userId','workspaceId','botId','parentId','draftId'].map(k=>notionId(p[k]));
  let origin;
  try {origin=new URL(expectedOrigin);} catch {reject(403,'local_package_invalid');}
  let supabase;
  try {supabase=new URL(p.supabaseOrigin);} catch {reject(403,'local_package_invalid');}
  if(ids.some((v,i)=>!v || v!==p[['userId','workspaceId','botId','parentId','draftId'][i]]) ||
    new Set(ids).size!==5 || p.version!==1 || p.scope!=='personal-private-test' ||
    p.policy!==LOCAL_READ_POLICY || p.apiVersion!==NOTION_VERSION ||
    origin.protocol!=='http:' || origin.hostname!=='127.0.0.1' || origin.origin!==expectedOrigin ||
    p.origin!==expectedOrigin || p.credentialKind!=='internal-connection' || p.acceptBroaderPermissions!==true ||
    p.evidence!=='NB-V2-013F-G' || !HEX.test(p.sdkDigest) || !HEX.test(p.publishableKeyDigest) ||
    supabase.origin!==p.supabaseOrigin || supabase.protocol!=='https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(supabase.hostname) ||
    supabase.port || supabase.username || supabase.password || !HEX.test(p.codeDigest) ||
    !HEX.test(codeDigest) || p.codeDigest!==codeDigest ||
    !Number.isSafeInteger(now) || !Number.isSafeInteger(p.expiresAt) || p.expiresAt<=now) reject(403,'local_package_invalid');
  if(r.version!==1 || r.approved!==true || r.packageDigest!==packageDigest(p) ||
    r.codeDigest!==codeDigest || !Number.isSafeInteger(r.expiresAt) || r.expiresAt<=now || r.expiresAt>p.expiresAt ||
    typeof r.approvalRef!=='string' || !/^approval-[a-z0-9-]{1,48}$/.test(r.approvalRef)) reject(403,'local_receipt_invalid');
  return Object.freeze({...p,approvalRef:r.approvalRef,packageDigest:r.packageDigest});
}
