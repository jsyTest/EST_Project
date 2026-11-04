import test from 'node:test';
import assert from 'node:assert/strict';
import {readVerifiedOwnedDraft, OWNERSHIP_VERIFICATION} from '../../../server/draft-ownership.mjs';
import {createReviewHandler} from '../../../server/drafts-review.mjs';
import {createNotionPreviewHandler} from '../../../server/notion/preview-handler.mjs';
import {emptyConfiguration} from '../../../js/drafts/model.mjs';
import {reviewSavedDraft} from '../../../server/review-plan.mjs';

const USER='11111111-1111-4111-8111-111111111111', OTHER='22222222-2222-4222-8222-222222222222';
const DRAFT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', UPDATED='2026-11-04T01:02:03.123456Z';
const env={SUPABASE_URL:'https://ownership-test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC'};
const configuration=emptyConfiguration();
configuration.mapping.model.properties.push({localId:'title',name:'가상 항목',type:'title',included:true,targetDb:'applicants',mappingStatus:'confirmed',options:[],origin:'manual'});
const row={id:DRAFT,user_id:USER,updated_at:UPDATED,schema_version:1,configuration};
function request(path,signal) {
  return new Request('http://127.0.0.1'+path,{method:'POST',signal,headers:{Authorization:'Bearer SYNTHETIC','Content-Type':'application/json'},
    body:JSON.stringify({draftId:DRAFT,expectedUpdatedAt:UPDATED,expectedPlanHash:reviewSavedDraft(row).planHash})});
}
for (const [path, factory] of [['/api/drafts/review',createReviewHandler],['/api/notion/plans/review',createNotionPreviewHandler]]) {
  test(`NB013F: ${path} reports only verified booleans after fresh Auth and owner filter`,async()=>{
    const calls=[];
    const fetchImpl=async(address,options)=>{
      const url=new URL(address); calls.push(url.pathname);
      assert.equal(options.method,'GET'); assert.equal(options.redirect,'error'); assert.equal(options.cache,'no-store');
      if(url.pathname==='/auth/v1/user')return Response.json({id:USER,email:'PRIVATE_EMAIL',user_metadata:{id:OTHER}});
      assert.equal(url.searchParams.get('user_id'),'eq.'+USER);
      assert.equal(url.searchParams.get('id'),'eq.'+DRAFT);
      return Response.json([row]);
    };
    const handler=factory({env,fetchImpl});
    for(let i=0;i<2;i++) {
      const response=await handler(request(path)),body=await response.json();
      assert.equal(response.status,200);
      for(const [key,value]of Object.entries(OWNERSHIP_VERIFICATION))assert.equal(body[key],value);
      assert.equal(body.notionRequests,0); assert.equal(body.supabaseWrites,0);
      assert.doesNotMatch(JSON.stringify(body),new RegExp([USER,OTHER,'PRIVATE_EMAIL','SYNTHETIC','user_id','Authorization'].join('|')));
    }
    assert.deepEqual(calls,['/auth/v1/user','/rest/v1/education_drafts','/auth/v1/user','/rest/v1/education_drafts']);
  });
  for(const kind of ['foreign','anonymous','expired','admin-spoof'])test(`NB013F: ${path} ${kind} cannot produce ownership success`,async()=>{
    const calls=[];
    const fetchImpl=async address=>{
      const url=new URL(address);calls.push(url.pathname);
      if(url.pathname==='/auth/v1/user')return Response.json({id:kind==='admin-spoof'?OTHER:USER,is_anonymous:kind==='anonymous',
        app_metadata:{pplus_role:'admin'},user_metadata:{user_id:USER}}, {status:kind==='expired'?401:200});
      return Response.json([{...row,user_id:kind==='foreign'?OTHER:USER}]);
    };
    const response=await factory({env,fetchImpl})(request(path)),body=await response.json();
    assert.equal(response.status,['anonymous','expired'].includes(kind)?401:404);
    assert.notEqual(body.serverAuthVerified,true);assert.notEqual(body.draftOwnerVerified,true);
    if(['anonymous','expired'].includes(kind))assert.deepEqual(calls,['/auth/v1/user']);
  });
}
for(const stage of ['before-auth','after-auth','after-draft'])test(`NB013F: cancellation ${stage} cannot return a verified owner`,async()=>{
  const controller=new AbortController(),calls=[];
  if(stage==='before-auth')controller.abort();
  const client={getUser:async()=>{calls.push('auth');if(stage==='after-auth')controller.abort();return {id:USER};},
    getDraft:async()=>{calls.push('draft');controller.abort();return row;}};
  await assert.rejects(readVerifiedOwnedDraft(client,DRAFT,controller.signal),error=>error.code==='invalid_session');
  assert.deepEqual(calls,stage==='before-auth'?[]:stage==='after-auth'?['auth']:['auth','draft']);
});
