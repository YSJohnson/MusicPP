import { device, randomString } from './device';
import { KugouError, kugouRequest } from './http';
import {
  aesDecryptHex,
  aesEncrypt,
  aesEncryptWithKey,
  LITE_T1_IV,
  LITE_T1_KEY,
  LITE_T2_IV,
  LITE_T2_KEY,
  rsaEncrypt,
} from './crypto';
import { signParamsKey } from './sign';

/** 发送手机验证码 */
export async function sendSmsCode(mobile: string): Promise<{ count?: number }> {
  const body = await kugouRequest<any>({
    baseURL: 'http://login.user.kugou.com',
    url: '/v7/send_mobile_code',
    method: 'POST',
    data: { businessid: 5, mobile, plat: 3 },
    encryptType: 'android',
  });
  return body?.data ?? {};
}

export interface SmsLoginResult {
  token: string;
  userid: string;
  vipType?: number;
}

/** 手机号 + 验证码登录 */
export async function loginBySms(mobile: string, code: string): Promise<SmsLoginResult> {
  const dateTime = Date.now();
  const dev = device();
  const dfid = randomString(24);

  const encrypt = await aesEncrypt({ mobile, code });
  const mobileMasked = `${mobile.substring(0, 2)}*****${mobile.substring(10, 11)}`;
  const t2 = await aesEncryptWithKey(
    `${dev.guid}|0f607264fc6318a92b9e13c65db7cd3c|${dev.mac}|${dev.dev}|${dateTime}`,
    LITE_T2_KEY,
    LITE_T2_IV,
  );
  const t1 = await aesEncryptWithKey(`|${dateTime}`, LITE_T1_KEY, LITE_T1_IV);

  const body = await kugouRequest<any>({
    baseURL: 'https://loginserviceretry.kugou.com',
    url: '/v7/login_by_verifycode',
    method: 'POST',
    dfid,
    data: {
      plat: 1,
      support_multi: 1,
      t1,
      t2,
      clienttime_ms: dateTime,
      mobile: mobileMasked,
      key: signParamsKey(dateTime),
      pk: rsaEncrypt({ clienttime_ms: dateTime, key: encrypt.key }).toUpperCase(),
      params: encrypt.str,
      dfid,
      dev: dev.dev,
      gitversion: '5f0b7c4',
    },
    encryptType: 'android',
    headers: {
      'support-calm': '1',
      'User-Agent': 'Android16-1070-11440-130-0-LOGIN-wifi',
    },
  });

  let payload: Record<string, any> = body?.data ?? {};
  const secu = payload?.secu_params;
  if (secu) {
    const decrypted = await aesDecryptHex(secu, encrypt.key);
    payload =
      typeof decrypted === 'object'
        ? { ...payload, ...(decrypted as Record<string, any>) }
        : { ...payload, token: decrypted };
  }

  const token = payload?.token;
  const userid = payload?.userid;
  if (!token || !userid) {
    throw new KugouError('登录失败：未获取到账号信息', 0, undefined, body);
  }

  return {
    token: String(token),
    userid: String(userid),
    vipType: Number(payload?.vip_type || 0),
  };
}
