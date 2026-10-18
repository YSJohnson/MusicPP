import { md5 } from './md5';

/**
 * 登录相关的加密实现（与 KuGouMusicApi 的 util/crypto.js 等价）
 * - AES-256-CBC + PKCS7（key/iv 由 MD5 派生）
 * - 酷狗用的是「原始 RSA + 左侧补零」，不是 PKCS1，这里用 BigInt 还原
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** 概念版 RSA 公钥（从 PEM 中取出的 modulus 与 exponent） */
const LITE_RSA_N =
  'c40a2d0da76511f3bb1cc2bbd3afbd8bea83b4d6b05b6c13eb8920c53f1af7679b32ba0d0edb843240ef1b836efed3ee240734c14c1399fd6594d16af22f52525d14d72e0155c6dcc8638d4f7bb94f3a0b1f4c29f991972f2a160a25eb0a9e724336be7f69bbd319ffab1c6dd8470b021dc434f3faba89f4a2a01b33bdbdd08b';
const LITE_RSA_E = '10001';

/* --------------------------------- 字节工具 -------------------------------- */

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 ? '0' + hex : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function getWebCrypto(): SubtleCrypto {
  const c = (globalThis as any).crypto;
  if (!c?.subtle) throw new Error('当前环境不支持 WebCrypto');
  return c.subtle as SubtleCrypto;
}

/* ----------------------------------- AES ---------------------------------- */

// 注意：WebCrypto 的 AES-CBC 自带 PKCS#7 填充（加解密两端都会处理），
// 这里不要再手动补位，否则会多出一个数据块。

async function aesCbcEncryptHex(plain: string, keyStr: string, ivStr: string): Promise<string> {
  const subtle = getWebCrypto();
  const keyBytes = encoder.encode(keyStr) as unknown as BufferSource;
  const key = await subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt']);
  const iv = encoder.encode(ivStr) as unknown as BufferSource;
  const data = encoder.encode(plain) as unknown as BufferSource;
  const cipher = await subtle.encrypt({ name: 'AES-CBC', iv }, key, data);
  return bytesToHex(new Uint8Array(cipher));
}

async function aesCbcDecryptHex(cipherHex: string, keyStr: string, ivStr: string): Promise<string> {
  const subtle = getWebCrypto();
  const keyBytes = encoder.encode(keyStr) as unknown as BufferSource;
  const key = await subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['decrypt']);
  const iv = encoder.encode(ivStr) as unknown as BufferSource;
  const cipherBytes = hexToBytes(cipherHex) as unknown as BufferSource;
  const plain = await subtle.decrypt({ name: 'AES-CBC', iv }, key, cipherBytes);
  return decoder.decode(new Uint8Array(plain));
}

/** 随机 key（16 位），返回 { key, aesKey, iv } —— 与 cryptoAesEncrypt 的默认行为一致 */
export function deriveAesKey(tempKey?: string): { tempKey: string; key: string; iv: string } {
  const chars = '1234567890ABCEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let t = tempKey;
  if (!t) {
    t = '';
    for (let i = 0; i < 16; i++) t += chars[Math.floor(Math.random() * chars.length)];
  }
  const key = md5(t).substring(0, 32);
  return { tempKey: t, key, iv: key.substring(16, 32) };
}

/** AES 加密（默认随机 key），返回 { str: hex, key: tempKey } */
export async function aesEncrypt(
  data: string | Record<string, any>,
  tempKey?: string,
): Promise<{ str: string; key: string }> {
  const plain = typeof data === 'string' ? data : JSON.stringify(data);
  const { tempKey: t, key, iv } = deriveAesKey(tempKey);
  const str = await aesCbcEncryptHex(plain, key, iv);
  return { str, key: t };
}

/** 使用固定 key/iv 的 AES 加密（用于 t1/t2），返回 hex */
export async function aesEncryptWithKey(
  data: string,
  keyStr: string,
  ivStr: string,
): Promise<string> {
  return aesCbcEncryptHex(data, keyStr, ivStr);
}

/** AES 解密：key 先用 MD5 派生（与 cryptoAesDecrypt 一致） */
export async function aesDecryptHex(
  cipherHex: string,
  tempKey: string,
): Promise<string | Record<string, any>> {
  const key = md5(tempKey).substring(0, 32);
  const iv = key.substring(16, 32);
  const text = await aesCbcDecryptHex(cipherHex, key, iv);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/* ----------------------------------- RSA ---------------------------------- */

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

/**
 * 酷狗登录用的 RSA 加密：
 * 明文左侧补零到密钥长度后做原始 RSA 运算，输出小写 hex
 */
export function rsaEncrypt(data: string | Record<string, any>): string {
  const plain = typeof data === 'string' ? data : JSON.stringify(data);
  const bytes = encoder.encode(plain);
  const n = BigInt('0x' + LITE_RSA_N);
  const e = BigInt('0x' + LITE_RSA_E);
  const keyLength = 128; // 1024 bit

  if (bytes.length > keyLength) throw new Error('登录参数过长');

  // 与参考实现一致：明文放在开头，右侧补零到 1024bit
  const padded = new Uint8Array(keyLength);
  padded.set(bytes);

  const m = BigInt('0x' + bytesToHex(padded));
  const c = modPow(m, e, n);
  return c.toString(16).padStart(keyLength * 2, '0');
}

/* ------------------------------- 登录常量配置 ------------------------------- */

export const LITE_T2_KEY = 'fd14b35e3f81af3817a20ae7adae7020';
export const LITE_T2_IV = '17a20ae7adae7020';
export const LITE_T1_KEY = '5e4ef500e9597fe004bd09a46d8add98';
export const LITE_T1_IV = '04bd09a46d8add98';

