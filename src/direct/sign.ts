import { md5 } from './md5';

/**
 * 酷狗客户端签名算法（与 KuGouMusicApi / util/helper.js 等价）
 * 这里固定使用「概念版 lite」参数：appid=3116, clientver=11440
 */

export const LITE_APPID = 3116;
export const LITE_CLIENTVER = 11440;
export const SRCAPPID = 2919;

const SALT_ANDROID_LITE = 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA';
const SALT_WEB = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
const SALT_SIGN_KEY_LITE = '185672dd44712f60bb1736df5a377e82';

/** 参数序列化：按 key 排序后拼成 key=value，对象值 JSON.stringify */
function serializeParams(params: Record<string, any>): string {
  return Object.keys(params)
    .sort()
    .map((key) => {
      const value = params[key];
      return `${key}=${typeof value === 'object' && value !== null ? JSON.stringify(value) : value}`;
    })
    .join('');
}

/** Android 端签名：salt + 排序参数 + body + salt 的 MD5 */
export function signatureAndroid(params: Record<string, any>, body = ''): string {
  return md5(`${SALT_ANDROID_LITE}${serializeParams(params)}${body}${SALT_ANDROID_LITE}`);
}

/** Web 端签名（登录二维码等 H5 接口） */
export function signatureWeb(params: Record<string, any>, body = ''): string {
  return md5(`${SALT_WEB}${serializeParams(params)}${body}${SALT_WEB}`);
}

/** 设备注册签名 */
export function signatureRegister(params: Record<string, any>): string {
  const values = Object.keys(params)
    .map((key) => params[key])
    .sort()
    .join('');
  return md5(`1014${values}1014`);
}

/** song/url 等接口的 key 参数 */
export function signKey(
  hash: string,
  mid: string | number,
  userid: string | number = 0,
  appid: string | number = LITE_APPID,
): string {
  return md5(`${hash}${SALT_SIGN_KEY_LITE}${appid}${mid}${userid || 0}`);
}

/** 部分接口的 sign / key 参数：MD5(appid + salt + clientver + data) */
export function signParamsKey(
  data: string | number,
  appid: string | number = LITE_APPID,
  clientver: string | number = LITE_CLIENTVER,
): string {
  return md5(`${appid}${SALT_ANDROID_LITE}${clientver}${data}`);
}
