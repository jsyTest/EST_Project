import {reject} from '../../server/review-errors.mjs';

// This is a distinct token-only interface. Existing synthetic six-field input is untouched.
export function promptApprovedNotionToken({authorization,input=process.stdin,output=process.stdout,
  signals=process,signal,inputMs=90000,setTimer=setTimeout,clearTimer=clearTimeout}={}) {
  if(authorization?.consumed!==true || authorization?.approved!==true || signal?.aborted) reject(403,'local_secret_not_authorized');
  if(!input.isTTY || !output.isTTY || typeof input.setRawMode!=='function' ||
    !Number.isFinite(inputMs) || inputMs<=0 || inputMs>90000) reject(400,'local_tty_required');
  const prior=input.isRaw===true, wasFlowing=input.readableFlowing===true;
  return new Promise((resolve,fail)=>{
    let pending='',finished=false,timer;
    function restore(){try{input.setRawMode(prior);}catch{}}
    function cleanup(){
      clearTimer(timer); input.removeListener('data',data); input.removeListener('error',broken); input.removeListener('end',broken);
      for(const key of ['SIGINT','SIGTERM','SIGHUP'])signals.removeListener(key,cancel);
      signals.removeListener('exit',restore);signal?.removeEventListener('abort',cancel);
      restore();if(!wasFlowing)input.pause();pending='';
    }
    function finish(code){if(finished)return;finished=true;let value=pending;cleanup();
      if(code)fail(Object.assign(new Error(code),{code}));else resolve(value);value='';}
    function cancel(){finish('local_input_cancelled');}
    function broken(){finish('local_input_failed');}
    function data(chunk){
      try{
        for(const ch of chunk.toString('utf8')){
          if(finished)break;
          if(ch==='\x03'||ch==='\x04'){cancel();break;}
          if(ch==='\r'||ch==='\n'){
            if(!/^[A-Za-z0-9_-]{20,512}$/.test(pending)){broken();break;}
            output.write('\n');finish();break;
          }
          if(ch==='\x7f'||ch==='\b')pending=pending.slice(0,-1);
          else if(/^[A-Za-z0-9_-]$/.test(ch)&&pending.length<512)pending+=ch;
          else {broken();break;}
        }
      }catch{broken();}
    }
    input.on('data',data);input.once('error',broken);input.once('end',broken);
    for(const key of ['SIGINT','SIGTERM','SIGHUP'])signals.once(key,cancel);
    signals.once('exit',restore);signal?.addEventListener('abort',cancel,{once:true});
    timer=setTimer(()=>finish('local_input_timeout'),inputMs);timer?.unref?.();
    try{input.setRawMode(true);output.write('승인된 연결 토큰 (입력 숨김, 출처를 로컬에서 확인): ');input.resume();
      if(signal?.aborted)cancel();}catch{broken();}
  });
}
