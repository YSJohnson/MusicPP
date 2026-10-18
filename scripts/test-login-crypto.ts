// 对比直连实现与 KuGouMusicApi 参考实现的加密结果
import { createRequire } from 'node:module';
import { aesEncrypt, rsaEncrypt, aesDecryptHex, aesEncryptWithKey } from '../src/direct/crypto';

const require = createRequire('C:/Users/14689/SourceCode/Music++/_ref/KuGouMusicApi/package.json');
const CryptoJS = require('crypto-js');
const forge = require('node-forge');

const pem = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDECi0Np2UR87scwrvTr72L6oO01rBbbBPriSDFPxr3Z5syug0O24QyQO8bg27+0+4kBzTBTBOZ/WWU0WryL1JSXRTXLgFVxtzIY41Pe7lPOgsfTCn5kZcvKhYKJesKnnJDNr5/abvTGf+rHG3YRwsCHcQ08/q6ifSioBszvb3QiwIDAQAB
-----END PUBLIC KEY-----`;

function refRsa(data: string): string {
  const key = forge.pki.publicKeyFromPem(pem);
  const keyLength = Math.ceil(key.n.bitLength() / 8);
  const buffer = new TextEncoder().encode(data);
  const padded = new Uint8Array(keyLength);
  padded.set(buffer);
  const message = new forge.jsbn.BigInteger(
    Array.from(padded).map((b) => b.toString(16).padStart(2, '0')).join(''),
    16,
  );
  const encrypted = message.modPow(key.e, key.n);
  return encrypted.toString(16).padStart(keyLength * 2, '0');
}

function refAes(data: string, tempKey: string): string {
  const key = CryptoJS.MD5(tempKey).toString(CryptoJS.enc.Hex).substring(0, 32);
  const iv = key.substring(key.length - 16);
  const encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(data), CryptoJS.enc.Utf8.parse(key), {
    iv: CryptoJS.enc.Utf8.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return CryptoJS.enc.Hex.stringify(encrypted.ciphertext);
}

const payload = JSON.stringify({ clienttime_ms: 1792255000123, key: 'abc123def456ghi7' });
console.log('RSA  mine:', rsaEncrypt({ clienttime_ms: 1792255000123, key: 'abc123def456ghi7' }).slice(0, 40));
console.log('RSA  ref :', refRsa(payload).slice(0, 40));
console.log('RSA equal:', rsaEncrypt({ clienttime_ms: 1792255000123, key: 'abc123def456ghi7' }) === refRsa(payload));

const aesPlain = JSON.stringify({ mobile: '13800138000', code: '123456' });
const mine = await aesEncrypt(aesPlain, 'abcdefgh12345678');
const ref = refAes(aesPlain, 'abcdefgh12345678');
console.log('AES equal:', mine.str === ref, 'key:', mine.key === 'abcdefgh12345678');
console.log('AES mine:', mine.str.slice(0, 32), 'ref:', ref.slice(0, 32));

const t1 = await aesEncryptWithKey('|1792255000123', '5e4ef500e9597fe004bd09a46d8add98', '04bd09a46d8add98');
console.log('t1 equal:', t1 === refAes2('|1792255000123', '5e4ef500e9597fe004bd09a46d8add98', '04bd09a46d8add98'));

function refAes2(data: string, key: string, iv: string): string {
  const encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(data), CryptoJS.enc.Utf8.parse(key), {
    iv: CryptoJS.enc.Utf8.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return CryptoJS.enc.Hex.stringify(encrypted.ciphertext);
}

// 解密回环
const dec = await aesDecryptHex(mine.str, mine.key);
console.log('AES roundtrip:', JSON.stringify(dec));
