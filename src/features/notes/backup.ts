import type {AppData} from './data';
import {now} from '../../utils/format';
export function downloadBackup(data:AppData):void {
  const payload={version:2,app:'keep',exportedAt:now(),notes:data.notes,labels:data.labels};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const anchor=document.createElement('a');
  anchor.href=url;anchor.download=`keep-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),2500);
}
