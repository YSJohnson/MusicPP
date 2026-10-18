import type { Song } from '../api/types';
import { getClientAuth } from '../api/client';
import { device, freshDfid } from './device';
import {
  LITE_APPID,
  LITE_CLIENTVER,
  SRCAPPID,
  signKey,
  signParamsKey,
  signatureAndroid,
  signatureRegister,
  signatureWeb,
} from './sign';

/** 直连模式的请求错误 */
export class KugouError extends Error {
  status: number;
  code?: number;
  body?: any;

  constructor(message: string, status = 0, code?: number, body?: any) {
    super(message);
    this.name = 'KugouError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export interface KugouRequestConfig {
  baseURL?: string;
  url: string;
  method?: 'GET' | 'POST';
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string | number>;
  encryptType?: 'android' | 'web' | 'register';
  /** 自动生成 song/url 需要的 key 参数 */
  encryptKey?: boolean;
  notSign?: boolean;
  clearDefaultParams?: boolean;
  clearDefaultHeaders?: boolean;
  timeout?: number;
  /** 覆盖本次请求的 dfid */
  dfid?: string;
  /** 覆盖本次请求的 userid（例如登录后的个人接口） */
  userid?: string | number;
}

const GATEWAY = 'https://gateway.kugou.com';
const UA = 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi';

function buildQuery(params: Record<string, any>): string {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'object') {
      usp.set(key, JSON.stringify(value));
      return;
    }
    usp.set(key, String(value));
  });
  const s = usp.toString();
  return s ? `?${s}` : '';
}

/**
 * 直连酷狗网关的底层请求：
 * 1. 注入设备参数与请求头
 * 2. 生成 signature（android / web / register）
 * 3. 发送请求并解析 JSON
 */
export async function kugouRequest<T = any>(config: KugouRequestConfig): Promise<T> {
  const dev = device();
  const auth = getClientAuth();
  // 与官方客户端/API 服务保持一致：默认不带设备 dfid（'-'）。
  // 实测带上随机 dfid 反而会触发 20028 风控，song/url 等接口再单独用随机值。
  const dfid = config.dfid || '-';
  const mid = dev.mid;
  const uuid = '-';
  const token = auth.token || '';
  const userid = config.userid ?? auth.userid ?? 0;
  const clienttime = Math.floor(Date.now() / 1000);

  const defaultParams: Record<string, any> = {
    dfid,
    mid,
    uuid,
    appid: LITE_APPID,
    clientver: LITE_CLIENTVER,
    clienttime,
  };
  if (token) defaultParams.token = token;
  if (userid && Number(userid) !== 0) defaultParams.userid = userid;

  const params: Record<string, any> = config.clearDefaultParams
    ? { ...(config.params || {}) }
    : { ...defaultParams, ...(config.params || {}) };

  const method = config.method || 'GET';
  const hasBody = config.data !== undefined && config.data !== null;
  const bodyString = hasBody
    ? typeof config.data === 'object'
      ? JSON.stringify(config.data)
      : String(config.data)
    : '';

  if (config.encryptKey) {
    params.key = signKey(params.hash, mid, params.userid ?? 0, params.appid ?? LITE_APPID);
  }

  if (!params.signature && !config.notSign) {
    switch (config.encryptType) {
      case 'web':
        params.signature = signatureWeb(params, bodyString);
        break;
      case 'register':
        params.signature = signatureRegister(params);
        break;
      default:
        params.signature = signatureAndroid(params, bodyString);
    }
  }

  const baseHeaders: Record<string, string> = {
    'User-Agent': config.clearDefaultHeaders ? UA : UA,
    dfid,
    clienttime: String(params.clienttime ?? clienttime),
    mid,
    'kg-rc': '1',
    'kg-thash': '5d816a0',
    'kg-rec': '1',
    'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F',
  };

  if (hasBody) baseHeaders['Content-Type'] = 'application/json';

  const headers: Record<string, string> = { ...baseHeaders };
  Object.entries(config.headers || {}).forEach(([k, v]) => {
    headers[k] = String(v);
  });

  const base = config.baseURL || GATEWAY;
  const url = `${base}${config.url}${buildQuery(params)}`;

  const raw = await sendRequest(url, method, headers, hasBody ? bodyString : undefined, config.timeout ?? 22000);

  let body: any = null;
  try {
    body = raw.text ? JSON.parse(raw.text) : null;
  } catch {
    body = null;
  }

  if (!raw.ok || !body) {
    throw new KugouError(`请求失败 (${raw.status})`, raw.status, undefined, body || raw.text);
  }

  // 与 KuGouMusicApi 的判定保持一致：
  // - status === 0 视为失败（多数业务接口）
  // - error_code 非 0 视为失败（少部分接口，歌词接口的 errcode=200 表示成功，不能误判）
  const errorCode = body?.error_code;
  const code = Number(errorCode ?? body?.errcode ?? 0);
  const failed = body?.status === 0 || (errorCode !== undefined && Number(errorCode) !== 0);
  if (failed) {
    // 部分接口把错误文案放在 data（字符串）里，例如登录失败时的「验证码错误」
    const message = String(
      (typeof body?.data === 'string' && body.data.trim()) ||
        body?.error ||
        body?.errmsg ||
        body?.msg ||
        body?.message ||
        '请求被拒绝',
    );
    throw new KugouError(message, raw.status, code || undefined, body);
  }

  return body as T;
}

interface RawHttpResult {
  ok: boolean;
  status: number;
  text: string;
}

/** 是否是 Capacitor 原生环境 */
function isNative(): boolean {
  const cap = (globalThis as any).Capacitor;
  return !!cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform();
}

/**
 * 发送 HTTP 请求：
 * - 原生环境走 CapacitorHttp（OkHttp），不受 CORS 限制
 * - 浏览器 / Node 环境走 fetch
 */
async function sendRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  timeout: number,
): Promise<RawHttpResult> {
  if (isNative()) {
    try {
      const { CapacitorHttp } = await import('@capacitor/core');
      const res = await CapacitorHttp.request({
        url,
        method,
        headers,
        data: body,
        connectTimeout: timeout,
        readTimeout: timeout,
      });
      let text = '';
      if (typeof res.data === 'string') text = res.data;
      else if (res.data !== undefined && res.data !== null) text = JSON.stringify(res.data);
      return { ok: res.status >= 200 && res.status < 300, status: res.status, text };
    } catch (err: any) {
      throw new KugouError(err?.message ? `网络请求失败：${err.message}` : '网络请求失败');
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body || undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new KugouError('请求超时，请检查网络');
    throw new KugouError('网络请求失败，请检查网络连接');
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------ 常用参数封装 ------------------------------ */

export const lite = {
  appid: LITE_APPID,
  clientver: LITE_CLIENTVER,
  srcappid: SRCAPPID,
};

export { signParamsKey, freshDfid, device };

export const songAlbumId = (song: Song) => Number(song.albumId ?? 0);
