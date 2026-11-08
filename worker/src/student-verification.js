import {StudentSourceError} from './student-source.js';
const bytes = new TextEncoder();
const b64 = value => btoa(String.fromCharCode(...new Uint8Array(value)));
// Only the public wrapping key is deployed. The private key stays in the
// operator's existing secret store; public routes cannot decrypt this vault.
export async function encryptVerification(value, publicJwk) {
  const publicKey = await crypto.subtle.importKey('jwk', JSON.parse(publicJwk), {name:'RSA-OAEP',hash:'SHA-256'}, false, ['encrypt']);
  const key = await crypto.subtle.generateKey({name:'AES-GCM',length:256}, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:bytes.encode('paper-student-verification-v1')}, key, bytes.encode(JSON.stringify(value)));
  const wrappedKey = await crypto.subtle.encrypt({name:'RSA-OAEP'}, publicKey, await crypto.subtle.exportKey('raw',key));
  return {version:1,algorithm:'RSA-OAEP-256+A256GCM',iv:b64(iv),key:b64(wrappedKey),ciphertext:b64(ciphertext)};
}
export async function recordVerification(env, receipt, phase, value) {
  if (!env.STUDENT_VERIFICATION || !env.STUDENT_VERIFICATION_PUBLIC_KEY) throw new StudentSourceError('verification_storage_unavailable',503);
  try {
    const at = new Date().toISOString();
    const encrypted = await encryptVerification({at,receipt,phase,...value},env.STUDENT_VERIFICATION_PUBLIC_KEY);
    const key = `v1/${phase}/${at}/${receipt}`;
    await env.STUDENT_VERIFICATION.put(key,JSON.stringify(encrypted),{expirationTtl:7*86400,metadata:{at,receipt,phase}});
  } catch {throw new StudentSourceError('verification_storage_unavailable',503);}
}
