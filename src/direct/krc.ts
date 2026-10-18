import { unzlibSync, inflateSync } from 'fflate';

/** KRC 歌词解密：跳过 4 字节头 -> 循环 XOR -> zlib 解压 */
const XOR_KEY = [64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105];

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function decodeKrc(base64: string): string {
  try {
    const raw = base64ToBytes(base64);
    const data = raw.slice(4);
    for (let i = 0; i < data.length; i++) {
      data[i] ^= XOR_KEY[i % XOR_KEY.length];
    }
    let out: Uint8Array;
    try {
      out = unzlibSync(data);
    } catch {
      out = inflateSync(data);
    }
    return new TextDecoder().decode(out);
  } catch {
    return '';
  }
}
