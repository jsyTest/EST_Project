import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {LOCAL_ORIGIN,sourceDigest} from './two-get-package.mjs';
import {twoGetResponse} from './two-get-controller.mjs';

const PAGE='/__local/notion-2get',POST=PAGE+'/review';
const html=nonce=>`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>승인된 개인 연결 읽기 검사</title><main><h1>개인 연결 읽기 검사</h1>
<p>별도 승인된 로컬 검사입니다. 생성·수정은 하지 않습니다.</p>
<button id="review" type="button">승인된 읽기 검사</button><button id="cancel" type="button">취소</button>
<p id="status" role="status" aria-live="polite">아직 실행하지 않았습니다.</p></main>
<script nonce="${nonce}" src="${PAGE}/sdk.js"></script><script nonce="${nonce}" src="${PAGE}/client.js"></script>
<script nonce="${nonce}" type="module" src="${PAGE}/browser.mjs"></script></html>`;
function boundary(req,origin){
  const expected=new URL(origin),count=name=>req.rawHeaders.filter((v,i)=>i%2===0&&v.toLowerCase()===name).length;
  if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||count('host')!==1||req.headers.host!==expected.host||
    Object.keys(req.headers).some(k=>k==='forwarded'||k.startsWith('x-forwarded-'))||req.headers['transfer-encoding'])return false;
  if(req.method==='POST'){
    if(count('origin')!==1||count('authorization')>1||req.headers.origin!==origin ||
      (req.headers['sec-fetch-site']!==undefined&&req.headers['sec-fetch-site']!=='same-origin'))return false;
  }else if((req.headers.origin!==undefined&&req.headers.origin!==origin)||
    (req.headers['sec-fetch-site']!==undefined&&!['same-origin','none'].includes(req.headers['sec-fetch-site'])))return false;
  return true;
}
async function body(req){
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??''))throw Error();
  const size=req.headers['content-length'];if(size!==undefined&&(!/^\d+$/.test(size)||Number(size)>256))throw Error();
  const buffers=[];let bytes=0;
  for await(const chunk of req){if((bytes+=chunk.length)>256)throw Error();buffers.push(chunk);}
  const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(buffers)),value=JSON.parse(text);
  if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).length)throw Error();
}
async function send(res,response,headers={}){
  if(res.destroyed)return;
  res.writeHead(response.status,{...Object.fromEntries(response.headers),...headers});
  res.end(Buffer.from(await response.arrayBuffer()));
}
export async function startTwoGetServer({controller,sdkSource,expectedOrigin=LOCAL_ORIGIN,signals=process}={}){
  if(!controller?.authorize)throw Error('local_execution_blocked');
  const p=await controller.authorize();
  // No CDN download. Future operators must supply reviewed local SDK bytes bound to the package.
  if(typeof sdkSource!=='string'||Buffer.byteLength(sdkSource)>1048576||sourceDigest(sdkSource)!==p.sdkDigest)throw Error('local_sdk_invalid');
  const browser=await readFile(new URL('./two-get-browser.mjs',import.meta.url),'utf8');
  const client=await readFile(new URL('../../js/supabase-client.js',import.meta.url),'utf8');
  let closing=false;
  const stop=()=>{controller.cancel();if(!closing){closing=true;server.close();server.closeIdleConnections?.();}};
  const server=createServer({headersTimeout:5000,requestTimeout:5000,connectionsCheckingInterval:250},async(req,res)=>{
    const abort=new AbortController();let primary=false;
    const onAborted=()=>abort.abort(),onClose=()=>{if(!res.writableFinished)abort.abort();};
    req.once('aborted',onAborted);res.once('close',onClose);
    try{
      const url=new URL(req.url,expectedOrigin);
      if(!boundary(req,expectedOrigin)||url.origin!==expectedOrigin||url.search||url.hash||closing){
        await send(res,twoGetResponse(403,{error:{code:'local_request_rejected'}}));return;
      }
      if(req.method==='GET'&&[PAGE,PAGE+'/sdk.js',PAGE+'/client.js',PAGE+'/browser.mjs'].includes(url.pathname)){
        const current=await controller.authorize();if(current.packageDigest!==p.packageDigest)throw Error();
        const nonce=randomBytes(16).toString('base64');
        const data=url.pathname===PAGE?html(nonce):url.pathname.endsWith('/sdk.js')?sdkSource:url.pathname.endsWith('/client.js')?client:browser;
        const headers={'Content-Type':url.pathname===PAGE?'text/html; charset=utf-8':'text/javascript; charset=utf-8',
          'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',
          'Content-Security-Policy':`default-src 'none'; script-src 'self' 'nonce-${nonce}'; connect-src 'self' ${p.supabaseOrigin}; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`};
        res.writeHead(200,headers);res.end(data);return;
      }
      if(req.method!=='POST'||url.pathname!==POST){await send(res,twoGetResponse(404,{error:{code:'local_route_rejected'}}));return;}
      if(controller.busy){await send(res,twoGetResponse(409,{error:{code:'local_busy'}}));return;}
      await body(req);
      if(abort.signal.aborted)return;
      primary=!controller.busy;
      const response=await controller.review(new Request(expectedOrigin+POST,{method:'POST',headers:req.headers,body:'{}',signal:abort.signal}));
      await send(res,response);
    }catch{await send(res,twoGetResponse(400,{error:{code:'local_request_rejected'}}));}
    finally{req.removeListener('aborted',onAborted);res.removeListener('close',onClose);if(primary)stop();}
  });
  server.headersTimeout=5000;server.requestTimeout=5000;server.keepAliveTimeout=1000;server.maxHeadersCount=40;
  server.on('clientError',(_error,socket)=>{socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');});
  try{await new Promise((resolve,fail)=>{server.once('error',fail);server.listen(Number(new URL(expectedOrigin).port||80),'127.0.0.1',resolve);});}
  catch{throw Error('local_port_unavailable');}
  for(const key of ['SIGINT','SIGTERM','SIGHUP'])signals.on(key,stop);
  server.once('close',()=>{for(const key of ['SIGINT','SIGTERM','SIGHUP'])signals.removeListener(key,stop);});
  return Object.freeze({server,close:stop,get address(){return server.address();}});
}
