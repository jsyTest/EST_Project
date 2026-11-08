const PATH='/__local/notion-2get/review';
const MESSAGES={ready:'제한된 읽기 검사를 마쳤습니다. 생성·수정은 하지 않았습니다.',
  loading:'승인·인증을 확인하고 있습니다. 필요한 입력은 로컬 터미널에서만 진행합니다.',
  cancelled:'검사를 취소했습니다. 자동으로 다시 실행하지 않습니다.',failed:'검사를 완료하지 못했습니다. 자동으로 다시 실행하지 않습니다.'};
export function mountLocalTwoGet({sdk,output,runButton,cancelButton,win,fetchImpl=fetch,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  let attempted=false,disposed=false,abort,subscription,sequence=0;
  function cancel(){sequence++;abort?.abort();if(!disposed)output.textContent=MESSAGES.cancelled;}
  const authChange=event=>{if(attempted&&event!=='INITIAL_SESSION')cancel();};
  subscription=sdk.auth.onAuthStateChange(authChange)?.data?.subscription;
  win.addEventListener('pagehide',cancel);win.addEventListener('beforeunload',cancel);
  async function review(){
    if(attempted||disposed)return;attempted=true;runButton.disabled=true;
    abort=new AbortController();const signal=abort.signal,ticket=++sequence;
    let timer,token,user;
    const current=()=>!disposed&&!signal.aborted&&sequence===ticket;
    const until=operation=>new Promise((resolve,fail)=>{
      const stop=()=>fail(Error());if(signal.aborted){stop();return;}
      signal.addEventListener('abort',stop,{once:true});
      Promise.resolve(operation).then(resolve,fail).finally(()=>signal.removeEventListener('abort',stop));
    });
    try{
      timer=setTimer(cancel,180000);
      const first=await until(sdk.auth.getSession());if(!current())return;
      const session=first?.data?.session;if(first.error||!session?.access_token||!session?.user?.id)throw Error();
      token=session.access_token;user=session.user.id;
      output.textContent=MESSAGES.loading;
      const response=await until(fetchImpl(PATH,{method:'POST',cache:'no-store',redirect:'error',signal,
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:'{}'}));
      if(!current())return;
      const text=await until(response.text());if(!current())return;if(text.length>8192)throw Error();
      const value=JSON.parse(text),latest=await until(sdk.auth.getSession());
      if(!current())return;
      if(latest?.error||latest?.data?.session?.user?.id!==user||latest?.data?.session?.access_token!==token){cancel();return;}
      if(!response.ok||value.webExecutionReady!==false||value.notionExecution!=='not_executed'||value.notionWrites!==0||
        value.supabaseWrites!==0||value.privacyVerified!==false||value.creationPermissionVerified!==false||
        value.serverAuthVerified!==true||value.draftOwnerVerified!==true||
        !Number.isInteger(value.notionDispatches)||value.notionDispatches!==2||
        !['simulation','approved-local'].includes(value.validationMode)||
        value.target?.botMatched!==true||value.target?.workspaceMatched!==true||value.target?.parentMatched!==true)throw Error();
      output.textContent=(value.validationMode==='simulation'?'가상 검사: ':'')+MESSAGES.ready;
    }catch{if(current())output.textContent=MESSAGES.failed;}
    finally{clearTimer(timer);token=undefined;user=undefined;abort?.abort();cleanup();}
  }
  runButton.addEventListener('click',review);cancelButton.addEventListener('click',cancel);
  function cleanup(){subscription?.unsubscribe();
    win.removeEventListener('pagehide',cancel);win.removeEventListener('beforeunload',cancel);
    runButton.removeEventListener('click',review);cancelButton.removeEventListener('click',cancel);}
  function dispose(){if(disposed)return;cancel();disposed=true;cleanup();}
  return Object.freeze({review,cancel,dispose});
}
if(typeof window!=='undefined'&&typeof document!=='undefined'&&window.location.pathname==='/__local/notion-2get'){
  const sdk=window.supabaseClient,output=document.getElementById('status');
  if(sdk?.auth&&output)mountLocalTwoGet({sdk,output,runButton:document.getElementById('review'),cancelButton:document.getElementById('cancel'),win:window});
}
