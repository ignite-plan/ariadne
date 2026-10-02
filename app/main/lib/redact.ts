// 로그와 신고에 들어가는 글에서 비밀 값과 개인 경로를 가린다. 보내기 직전과 로그를 쓸 때 모두 거친다
export interface RedactOptions {
  // 홈 경로는 ~로 바꾼다 (사용자 이름이 들어 있다)
  home?: string
  // 정확히 가릴 값 (GitHub 토큰, ANTHROPIC_API_KEY 등). 8자 미만은 무시한다
  secrets?: (string | undefined | null)[]
}

const PATTERNS: [RegExp, string][] = [
  [/\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '[github-token]'],
  [/\bsk-ant-[A-Za-z0-9_-]{10,}/g, '[anthropic-key]'],
  [/\b(Bearer|token)\s+[A-Za-z0-9._~+/=-]{12,}/gi, '$1 [redacted]'],
  [/(authorization|x-api-key|api[_-]?key|password|passwd|secret|cookie)(["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, '$1$2[redacted]'],
  [/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/g, '$1[redacted]@'],
  // 64자 이상 16진수/base64 덩어리 (API 키 등). 40자 커밋 해시는 남긴다
  [/\b[A-Fa-f0-9]{64,}\b/g, '[redacted-hex]'],
  [/\b[A-Za-z0-9+/]{80,}={0,2}/g, '[redacted-blob]'],
]

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function redact(text: string, { home, secrets = [] }: RedactOptions = {}) {
  let out = text
  for (const secret of secrets) {
    if (secret && secret.length >= 8) out = out.replace(new RegExp(escape(secret), 'g'), '[redacted]')
  }
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement)
  if (home && home.length > 1) out = out.replace(new RegExp(escape(home), 'g'), '~')
  return out
}
