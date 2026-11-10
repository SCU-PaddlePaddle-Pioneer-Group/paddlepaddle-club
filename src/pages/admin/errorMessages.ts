/**
 * 管理端错误文案映射（D 负责）。
 * 业务判断依据 HTTP 状态码 + error.code（细则 §8 与 C 契约 §10），不依赖 message 文案；
 * 本映射只把 code 转成用户可读文案。接入 B 的 api.ts 后由各页面调用。
 */

/** 登录接口（POST /api/admin/login）错误文案 */
const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: '账号或密码错误',
  RATE_LIMITED: '尝试过于频繁，请稍后再试',
  ORIGIN_NOT_ALLOWED: '请求来源未被允许，请通过 http://localhost:3000 打开管理后台',
  INTERNAL_ERROR: '登录失败，请稍后重试',
}

export function loginErrorMessage(code: string): string {
  return LOGIN_ERROR_MESSAGES[code] ?? '登录失败，请稍后重试'
}
