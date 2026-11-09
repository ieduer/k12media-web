import { StudentSourceError } from './student-source.js';
const enc = new TextEncoder();
const encode = a => btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode = s => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export async function seal(value, secret, audience) {
  if (!secret || secret.length < 32) throw new StudentSourceError('service_unavailable',503);
  const key = await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode(secret)), 'AES-GCM',false,['encrypt']);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(audience)},key,enc.encode(JSON.stringify(value)));
  return encode(iv)+'.'+encode(new Uint8Array(data));
}
export async function unseal(token, secret, audience, kind, nonce, maxLength=12000) {
  try {
    if (!secret || secret.length<32 || typeof token!=='string' || token.length>maxLength || !/^[\w-]+\.[\w-]+$/.test(token)) throw Error();
    const [iv,data]=token.split('.').map(decode);
    const key=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode(secret)), 'AES-GCM',false,['decrypt']);
    const value=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:enc.encode(audience)},key,data)));
    if(value.kind!==kind || !Number.isFinite(value.exp) || value.exp<=Date.now() || (nonce && value.nonce!==nonce))throw Error();
    return value;
  } catch {throw new StudentSourceError('session_expired',401);}
}
export const cookieName='__Host-paper-session';
export const sessionCookie = (value, maxAge=7200) => `${cookieName}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
export function readCookie(request) {return request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';}
