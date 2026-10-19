// Apple Silicon은 서명이 아예 없는 바이너리를 실행하지 않는다. Developer ID가 없어 Apple 공증은 못 받는다.
// - 릴리스(CI): 사내 자체 서명 인증서(MAC_SIGN_IDENTITY)로 서명한다. macOS가 앱을 "이 인증서로 서명한 kr.co.ignite.ariadne"로
//   알아봐서, 업데이트해도 폴더 권한을 다시 묻지 않는다. 키체인은 Team ID가 없어 이걸로 해결되지 않는다 (main/lib/keychain.ts)
// - 개발 PC: 인증서가 없으면 ad-hoc 서명 (이 경우 macOS는 빌드마다 다른 앱으로 본다)
const { execFileSync } = require('node:child_process')
const { join } = require('node:path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const app = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  const identity = process.env.MAC_SIGN_IDENTITY
  const keychain = process.env.MAC_SIGN_KEYCHAIN
  const sign = identity ? ['--sign', identity, ...(keychain ? ['--keychain', keychain] : [])] : ['--sign', '-']
  execFileSync('codesign', ['--force', '--deep', ...sign, app], { stdio: 'inherit' })
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' })
  if (identity) {
    // 인증서 기준으로 알아보는지 확인 (cdhash면 업데이트마다 권한을 다시 묻는다)
    const requirement = execFileSync('codesign', ['-d', '-r-', app], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    if (!/designated => identifier "[^"]+" and certificate root = H"/.test(requirement)) {
      throw new Error(`서명 기준이 인증서가 아닙니다: ${requirement.trim()}`)
    }
  }
}
