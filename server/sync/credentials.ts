import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';

export const issueSecret = (prefix:string):string => prefix+'_'+randomBytes(32).toString('base64url');
export const digestSecret = (value:string):string => createHash('sha256').update(value,'utf8').digest('hex');
export function matchesSecret(value:string,digest:string):boolean {
  return /^[a-f0-9]{64}$/.test(digest) && timingSafeEqual(Buffer.from(digestSecret(value),'hex'),Buffer.from(digest,'hex'));
}
export const validSecret = (value:unknown,prefix:string):value is string =>
  typeof value==='string' && value.length===prefix.length+44 && value.startsWith(prefix+'_') && /^[A-Za-z0-9_-]{43}$/.test(value.slice(prefix.length+1));
