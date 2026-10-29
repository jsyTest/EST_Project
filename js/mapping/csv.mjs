import {normalizeName,nameKey} from './model.mjs';
export const MAX_HEADER_BYTES=65536;
// Parse exactly one CSV record; embedded newlines and escaped quotes are part of that record.
export function firstRecord(text,{eof=false}={}) {
 text=text.replace(/^\uFEFF/,''); const fields=[];let value='',state='start';
 for(let i=0;i<text.length;i++) {
  const c=text[i];
  if(state==='quoted') {
   if(c==='"') {if(i+1===text.length&&!eof)return null;if(text[i+1]==='"'){value+='"';i++;}else state='closed';}
   else value+=c;
  } else if(c===',') {fields.push(value);value='';state='start';}
  else if(c==='\r'||c==='\n') {fields.push(value);return fields;}
  else if(state==='closed')throw new Error('닫는 인용부호 뒤에는 쉼표나 줄바꿈이 필요합니다.');
  else if(c==='"') {if(state!=='start')throw new Error('CSV 인용부호 위치가 잘못되었습니다.');state='quoted';}
  else {value+=c;state='plain';}
 }
 if(!eof)return null;
 if(state==='quoted')throw new Error('CSV 헤더의 인용부호가 닫히지 않았습니다.');
 if(!text)throw new Error('빈 CSV 파일입니다.');
 fields.push(value);return fields;
}
export function describeColumns(fields) {
 const keys=fields.map(nameKey);
 return fields.map((original,index)=>({index,original,normalized:normalizeName(original),issues:[...(!keys[index]?['빈 컬럼명']:[]),...(keys[index]&&keys.filter(k=>k===keys[index]).length>1?['정규화 후 중복 컬럼명']:[])]}));
}
export async function readCsvHeader(file,{encoding='utf-8'}={}) {
 if(!['utf-8','euc-kr'].includes(encoding))throw new Error('UTF-8 또는 EUC-KR/CP949를 선택하세요.');
 const decoder=new TextDecoder(encoding,{fatal:true});let text='';
 // Chunks may contain a few bytes after the first newline; they are discarded without parsing/storing response rows.
 for(let offset=0;offset<file.size&&offset<MAX_HEADER_BYTES;offset+=1024) {
  const end=Math.min(offset+1024,file.size,MAX_HEADER_BYTES);
  const bytes=new Uint8Array(await file.slice(offset,end).arrayBuffer());
  // Decode only through the header terminator. For quoted multiline headers the record parser continues.
  // Byte-by-byte decoding prevents malformed/private response rows affecting a valid header.
  for(const byte of bytes) {
   try{text+=decoder.decode(Uint8Array.of(byte),{stream:true});}catch{throw new Error('헤더 인코딩 오류: UTF-8 또는 EUC-KR/CP949를 바꿔 확인하세요.');}
   if(byte===10||byte===13) {const fields=firstRecord(text);if(fields)return describeColumns(fields);}
  }
  if(end===file.size) {
   try{text+=decoder.decode();}catch{throw new Error('헤더 인코딩 오류: 선택한 인코딩을 확인하세요.');}
   return describeColumns(firstRecord(text,{eof:true}));
  }
 }
 if(!file.size)throw new Error('빈 CSV 파일입니다.');
 throw new Error('첫 CSV 레코드가 64 KiB를 초과합니다. 헤더 구조를 확인하세요.');
}
