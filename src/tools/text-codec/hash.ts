import { md5 } from '@noble/hashes/legacy.js';
import sm3 from 'sm-crypto/src/sm3/index.js';
import { hexBytes, utf8Bytes } from './convert';

export type HashAlgorithm = 'MD5' | 'SHA-256' | 'SHA-512' | 'SM3';
export async function generateHash(input: string, algorithm: HashAlgorithm): Promise<string> {
  const bytes = utf8Bytes(input);
  if (algorithm === 'MD5') return hexBytes(md5(bytes));
  if (algorithm === 'SM3') return sm3(bytes);
  return hexBytes(new Uint8Array(await crypto.subtle.digest(algorithm, bytes)));
}
