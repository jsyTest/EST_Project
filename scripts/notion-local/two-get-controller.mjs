import {ReviewError,reject} from '../../server/review-errors.mjs';
import {authenticateTestUser} from '../../server/notion/test-auth.mjs';
import {createReadonlySupabase,readConfiguration} from '../../server/supabase-readonly.mjs';
import {readVerifiedOwnedDraft} from '../../server/draft-ownership.mjs';
import {createTestNotionReader} from '../../server/notion/test-readonly.mjs';
import {readTestConfiguration,TEST_ENV_NAMES} from '../../server/notion/test-configuration.mjs';
import {consumeLocalApproval} from './approval.mjs';
import {promptApprovedNotionToken} from './two-get-secret.mjs';
import {validateReviewedReadPackage,computeCodeDigest,sourceDigest,LOCAL_ORIGIN} from './two-get-package.mjs';

const SAFE=new Set(['auth_required','invalid_session','test_user_not_allowed','draft_not_found','draft_access_denied',
  'server_not_configured','test_connection_not_configured','auth_unavailable','upstream_unavailable','upstream_timeout',
  'upstream_rate_limited','invalid_upstream_response','local_execution_blocked','local_package_invalid','local_receipt_invalid',
  'local_code_invalid','local_package_changed','local_busy','local_already_attempted','local_cancelled','local_deadline',
  'local_approval_invalid','local_approval_already_consumed','local_approval_store_unsafe','local_approval_store_failed',
  'local_approval_budget_exhausted','local_input_cancelled','local_input_failed','local_input_timeout','local_tty_required',
  'local_secret_not_authorized','notion_unauthorized','notion_access_denied','notion_target_not_found','notion_rate_limited',
  'notion_unavailable','notion_timeout','invalid_notion_response','notion_bot_mismatch','notion_workspace_mismatch',
  'notion_internal_identity_unconfirmed','notion_parent_mismatch','notion_target_archived','notion_target_in_trash',
  'notion_target_locked','notion_target_privacy_unconfirmed','notion_target_not_standalone_page']);
export function twoGetResponse(status,body={}) {
  return Response.json({...body,webExecutionReady:false,notionExecution:'not_executed',notionWrites:0,supabaseWrites:0,
    privacyVerified:false,creationPermissionVerified:false},{status,headers:{'Cache-Control':'private, no-store, max-age=0',
      'CDN-Cache-Control':'no-store','Vary':'Authorization, Origin','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}
function fenced(operation,signal){
  return new Promise((resolve,fail)=>{
    const abort=()=>fail(new ReviewError(408,'local_cancelled'));
    if(signal.aborted){abort();return;}
    signal.addEventListener('abort',abort,{once:true});
    Promise.resolve(operation).then(resolve,fail).finally(()=>signal.removeEventListener('abort',abort));
  });
}

// No ambient env, native fetch, credential files or automatic listener/CLI are consulted.
export function createTwoGetController({mode='blocked',reviewPackage,receipt,directory,baseEnv={},authFetch,notionFetch,
  getToken=promptApprovedNotionToken,digestProvider=computeCodeDigest,now=Date.now,expectedOrigin=LOCAL_ORIGIN,
  consume=consumeLocalApproval,validationMode='simulation',overallMs=180000,setTimer=setTimeout,clearTimer=clearTimeout}={}) {
  let pending=false,attempted=false,active;
  async function authorize(){
    if(mode!=='approved-local' || typeof authFetch!=='function' || typeof notionFetch!=='function' ||
      !['simulation','approved-local'].includes(validationMode) || !Number.isFinite(overallMs) || overallMs<=0 || overallMs>180000) reject(503,'local_execution_blocked');
    return validateReviewedReadPackage({reviewPackage,receipt,codeDigest:await digestProvider(),now:now(),expectedOrigin});
  }
  const cancel=()=>active?.abort();
  async function review(request){
    if(pending)return twoGetResponse(409,{error:{code:'local_busy'},notionDispatches:0});
    if(attempted)return twoGetResponse(409,{error:{code:'local_already_attempted'},notionDispatches:0});
    pending=true;attempted=true;
    const local=new AbortController();active=local;
    const signal=AbortSignal.any([request.signal,local.signal]);
    let deadline=false,approval,token,configuration,phase='authorization',dispatches=0,supabaseGets=0;
    const timer=setTimer(()=>{deadline=true;local.abort();},overallMs);timer?.unref?.();
    const current=()=>{if(signal.aborted)reject(408,deadline?'local_deadline':'local_cancelled');};
    try{
      current();
      const p=await fenced(authorize(),signal);current();
      const captured=p.packageDigest;
      const url=new URL(request.url);
      if(request.method!=='POST'||url.origin!==expectedOrigin||url.pathname!=='/__local/notion-2get/review'||url.search)reject(403,'local_execution_blocked');
      // Boundary/body enforcement also lives in the socket server; direct callers stay closed.
      if(request.headers.get('origin')!==expectedOrigin || request.headers.get('host')!==new URL(expectedOrigin).host ||
        !/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??''))reject(403,'local_execution_blocked');
      const {readLimited}=await import('../../server/review-errors.mjs');
      let body;try{body=JSON.parse(await readLimited(request.body,256,signal));}catch{reject(400,'local_execution_blocked');}
      if(!body||Array.isArray(body)||Object.keys(body).length)reject(400,'local_execution_blocked');
      const bearer=request.headers.get('authorization')??'';
      if(!/^Bearer ([A-Za-z0-9._~-]{1,8192})$/i.test(bearer))reject(401,'auth_required');
      const env={SUPABASE_URL:baseEnv.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:baseEnv.SUPABASE_PUBLISHABLE_KEY,
        [TEST_ENV_NAMES.user]:p.userId};
      if(readConfiguration(env).origin!==p.supabaseOrigin || sourceDigest(env.SUPABASE_PUBLISHABLE_KEY)!==p.publishableKeyDigest)reject(403,'local_package_invalid');
      const authAdapter=(address,options)=>{
        current();if(++supabaseGets>6)reject(503,'local_execution_blocked');
        return authFetch(address,options);
      };
      const scoped=new Request(request.url,{headers:{Authorization:bearer},signal});
      async function checkpoint(){
        current();
        const refreshed=await authorize();current();
        if(refreshed.packageDigest!==captured)reject(403,'local_package_changed');
        const user=await authenticateTestUser({request:scoped,env,fetchImpl:authAdapter});current();
        const client=createReadonlySupabase({configuration:readConfiguration(env),token:bearer.slice(7),fetchImpl:authAdapter,signal});
        const row=await readVerifiedOwnedDraft(client,p.draftId,signal);current();
        if(row.user_id.toLowerCase()!==user.id||user.id!==p.userId)reject(404,'draft_not_found');
      }
      phase='authentication';await fenced(checkpoint(),signal);current();
      phase='consumption';
      const fixed={workspaceId:p.workspaceId,botId:p.botId,parentId:p.parentId};
      approval=await fenced(consume({directory,userId:p.userId,configuration:fixed,
        audit:{packageDigest:captured,codeDigest:p.codeDigest,approvalRef:p.approvalRef}}),signal);current();
      phase='secret';token=await fenced(getToken({authorization:Object.freeze({approved:true,consumed:true}),signal}),signal);current();
      phase='revalidation';await fenced(checkpoint(),signal);current();
      const full={...env,[TEST_ENV_NAMES.workspace]:p.workspaceId,[TEST_ENV_NAMES.bot]:p.botId,
        [TEST_ENV_NAMES.parent]:p.parentId,[TEST_ENV_NAMES.scope]:p.scope,[TEST_ENV_NAMES.token]:token};
      configuration=readTestConfiguration(full,p.userId);delete full[TEST_ENV_NAMES.token];
      const wrapped=approval.wrap(async(address,options)=>{
        current();const latest=await authorize();current();
        if(latest.packageDigest!==captured)reject(403,'local_package_changed');
        return notionFetch(address,options);
      });
      const reader=createTestNotionReader({configuration,strictInternalIdentity:true,allowNetwork:true,signal,fetchImpl:wrapped});
      phase='notion';const result=await fenced(reader.reviewTarget(),signal);current();
      phase='complete';dispatches=approval.requestCount;
      return twoGetResponse(200,{validationMode,phase,serverAuthVerified:true,draftOwnerVerified:true,notionDispatches:dispatches,supabaseGets,
        targetReadVerified:validationMode==='approved-local',mockTargetReadVerified:validationMode==='simulation',
        target:{botMatched:result.botMatched,workspaceMatched:result.workspaceMatched,parentMatched:result.parentMatched,
          lockStatus:result.lockStatus,publishStatus:result.publishStatus}});
    }catch(error){
      const code=deadline?'local_deadline':signal.aborted?'local_cancelled':SAFE.has(error?.code)?error.code:'local_execution_failed';
      return twoGetResponse(error instanceof ReviewError?error.status:signal.aborted?408:500,{validationMode,phase,
        notionDispatches:approval?.requestCount??dispatches,supabaseGets,targetReadVerified:false,mockTargetReadVerified:false,error:{code}});
    }finally{
      clearTimer(timer);local.abort();approval?.close();token=undefined;configuration=undefined;active=undefined;pending=false;
    }
  }
  return Object.freeze({authorize,review,cancel,get busy(){return pending;}});
}
