import { readStore, writeStore } from '../lib/storage';

/** 统一的接口错误 */
export class ApiError extends Error {
  status: number;
  code?: number;
  body?: any;

  constructor(message: string, status = 0, code?: number, body?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/** 需要登录 / 设备验证 */
export class AuthRequiredError extends ApiError {
  constructor(message = '需要登录后才能继续', status = 0, code?: number, body?: any) {
    super(message, status, code, body);
    this.name = 'AuthRequiredError';
  }
}

const DFID_KEY = 'mpp.dfid.v1';

interface ClientState {
  base: string;
  token?: string;
  userid?: string;
  vipToken?: string;
  vipType?: string;
}

const state: ClientState = { base: '' };

let dfidCache = '';

/** 设备指纹：固定 dfid 有助于通过设备验证 */
export function deviceDfid(): string {
  if (dfidCache) return dfidCache;
  let d = readStore<string>(DFID_KEY, '');
  if (!d || d.length < 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz0123456789';
    d = Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    writeStore(DFID_KEY, d);
  }
  dfidCache = d;
  return d;
}

export function normalizeBase(raw: string): string {
  let b = (raw || '').trim();
  if (!b) return '';
  if (!/^https?:\/\//i.test(b)) b = 'http://' + b;
  return b.replace(/\/+$/, '');
}

export function setApiBase(base: string) {
  state.base = normalizeBase(base);
}

export function getApiBase(): string {
  return state.base;
}

export function setClientAuth(auth?: { token?: string; userid?: string; vipToken?: string; vipType?: string } | null) {
  state.token = auth?.token || undefined;
  state.userid = auth?.userid || undefined;
  state.vipToken = auth?.vipToken || undefined;
  state.vipType = auth?.vipType || undefined;
}

/** 当前登录态（直连模式需要 token / userid） */
export function getClientAuth(): { token?: string; userid?: string } {
  return { token: state.token, userid: state.userid };
}

/** 未配置 API 地址即视为直连模式 */
export function isDirectMode(): boolean {
  return !state.base;
}

export function isAuthed(): boolean {
  return !!state.token && !!state.userid && state.userid !== '0';
}

function cookieString(): string {
  // 注意：不要注入自定义 dfid。
  // 酷狗风控会校验设备标识，未注册的 dfid 反而会触发 20028 / “本次请求需要验证”，
  // 交给 API 服务端生成设备标识更稳妥。
  const parts: string[] = [];
  if (state.token) parts.push(`token=${state.token}`);
  if (state.userid) parts.push(`userid=${state.userid}`);
  if (state.vipToken) parts.push(`vip_token=${state.vipToken}`);
  if (state.vipType) parts.push(`vip_type=${state.vipType}`);
  return parts.join(';');
}

function buildQuery(params?: Record<string, any>): string {
  if (!params) return '';
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      usp.set(key, value.join(','));
      return;
    }
    usp.set(key, String(value));
  });
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export interface RawResponse {
  ok: boolean;
  status: number;
  json: any;
  text: string;
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: Record<string, any>;
  timeout?: number;
  /** 带时间戳绕过服务端 2 分钟缓存 */
  refresh?: boolean;
}

/** 底层请求：永远返回解析后的 JSON（失败也返回），供播放地址等需要精细判断的场景使用 */
export async function rawRequest(
  path: string,
  params?: Record<string, any>,
  options: RequestOptions = {},
): Promise<RawResponse> {
  if (!state.base) {
    throw new ApiError('尚未配置 API 服务器地址');
  }
  const query = { ...(params || {}) };
  if (options.refresh) query._t = Date.now();

  const url = `${state.base}${path}${buildQuery(query)}`;
  const controller = new AbortController();
  const timeout = options.timeout ?? 22000;
  const timer = setTimeout(() => controller.abort(), timeout);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  const cookie = cookieString();
  if (cookie) headers.Authorization = cookie;

  let body: string | undefined;
  if (options.method === 'POST' && options.body) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, text };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new ApiError('请求超时，请检查 API 服务器是否在线');
    }
    throw new ApiError('无法连接 API 服务器，请检查地址与网络');
  } finally {
    clearTimeout(timer);
  }
}

/** 常规请求：失败直接抛错 */
export async function request<T = any>(
  path: string,
  params?: Record<string, any>,
  options: RequestOptions = {},
): Promise<T> {
  const res = await rawRequest(path, params, options);
  const json = res.json;

  if (!res.ok) {
    const code = Number(json?.error_code ?? json?.errcode ?? json?.code ?? 0) || undefined;
    const message =
      json?.error || json?.errmsg || json?.message || json?.msg || `请求失败 (${res.status})`;
    if (code === 20028 || code === 20010 || /需要验证|未登录|请登录|check r failed/i.test(String(message))) {
      throw new AuthRequiredError(String(message), res.status, code, json);
    }
    throw new ApiError(String(message), res.status, code, json);
  }
  return json as T;
}

/* ----------------------------------- 简单内存缓存 ---------------------------------- */

const cacheStore = new Map<string, { expire: number; value: any }>();

export function cacheKey(path: string, params?: Record<string, any>): string {
  return path + JSON.stringify(params ?? {});
}

export function getCached<T>(key: string): T | undefined {
  const hit = cacheStore.get(key);
  if (!hit) return undefined;
  if (hit.expire < Date.now()) {
    cacheStore.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function setCached(key: string, value: any, ttl = 120_000) {
  if (cacheStore.size > 120) cacheStore.clear();
  cacheStore.set(key, { expire: Date.now() + ttl, value });
}

export function clearApiCache() {
  cacheStore.clear();
}

/** 带缓存的 GET */
export async function cachedRequest<T = any>(
  path: string,
  params?: Record<string, any>,
  ttl = 120_000,
): Promise<T> {
  const key = cacheKey(path, params);
  const hit = getCached<T>(key);
  if (hit !== undefined) return hit;
  const data = await request<T>(path, params);
  setCached(key, data, ttl);
  return data;
}
