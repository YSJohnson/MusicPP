import { readStore, writeStore } from '../lib/storage';
import { hexToDecimalString, md5 } from './md5';

const KEY = 'mpp.device.v1';

export interface DeviceInfo {
  /** 设备全局标识（md5(uuid4)） */
  guid: string;
  /** 设备 MID（酷狗用 MD5 后的大整数表示） */
  mid: string;
  /** 设备指纹，24 位大写字母数字 */
  dfid: string;
  /** 10 位开发设备号 */
  dev: string;
  mac: string;
  webgl: string;
}

let cached: DeviceInfo | null = null;

const POOL = '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function randomString(len: number, pool = POOL): string {
  let out = '';
  for (let i = 0; i < len; i++) out += pool[Math.floor(Math.random() * pool.length)];
  return out;
}

function uuid4(): string {
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${((Math.random() * 4) | 8).toString(16)}${hex().slice(1)}-${hex()}${hex()}${hex()}`;
}

/** 生成 / 读取本机设备标识（持久化，保证多次启动一致） */
export function device(): DeviceInfo {
  if (cached) return cached;

  let stored = readStore<DeviceInfo | null>(KEY, null);
  if (!stored || !stored.mid || !stored.dfid) {
    const guid = md5(uuid4());
    stored = {
      guid,
      mid: hexToDecimalString(md5(guid)),
      dfid: randomString(24),
      dev: randomString(10),
      mac: '02:00:00:00:00:00',
      webgl: '9655615838832711846',
    };
    writeStore(KEY, stored);
  }
  cached = stored;
  return stored;
}

/** song/url 这类接口每次用一个随机 dfid（与官方客户端行为一致） */
export function freshDfid(): string {
  return randomString(24);
}
