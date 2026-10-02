// STG를 바꾸지 않기 위한 공용 규칙. Claude STG 탐색(app/main/lib/stg.ts)과 가이드 영상(video/director.ts)이 같이 쓴다

// 화면을 바꾸는 동작으로 보이는 이름. 단어 단위로 본다.
// "Create"는 정확히 그 이름일 때만 막는다 (목록의 "Create New"는 화면 이동, 딜러 생성 마지막 단계의 "Create"는 HMG Partner 연동)
const BLOCKED_LABEL =
  /\b(save|delete|remove|submit|approve|reject|send|register|publish|confirm|apply changes|deactivate|activate|terminate|reset password|upload|import|sync|resend|withdraw|discard)\b|^\s*create\s*$|저장|삭제|승인|반려|발송|전송|등록|게시|확인|적용|업로드|탈퇴|해지/i

export function isBlockedLabel(name: string) {
  return BLOCKED_LABEL.test(name)
}

// 조회로 보이는 POST만 통과시킨다 (BO 목록/검색 API 중 POST가 있다)
const READ_POST = /(search|list|query|count|lookup|tree|options|codes?|filter|preview|summary)(\b|[/?_-]|$)/i

export function isAllowedRequest(method: string, url: string) {
  const m = method.toUpperCase()
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return true
  if (m !== 'POST') return false
  let path = url
  try {
    path = new URL(url).pathname
  } catch {
    // 상대 경로면 그대로 본다
  }
  return READ_POST.test(path)
}
