import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { deletePassword, readPassword, writePassword } from '../keychain.ts'

// 로그인 키체인 대신 임시 키체인 파일 (검색 목록에는 넣지 않는다)
describe('키체인 암호 항목', { skip: process.platform !== 'darwin' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'ariadne-keychain-'))
  const keychain = join(dir, 'test.keychain-db')
  const item = { service: 'Ariadne Test', account: '/Users/me/Library/Application Support/Ariadne', keychain }
  before(() => {
    execFileSync('security', ['create-keychain', '-p', 'test', keychain])
    execFileSync('security', ['unlock-keychain', '-p', 'test', keychain])
  })
  after(() => {
    execFileSync('security', ['delete-keychain', keychain])
    rmSync(dir, { recursive: true, force: true })
  })

  it('없으면 null, 쓰면 읽히고, 다시 쓰면 바뀐다', () => {
    assert.equal(readPassword(item), null)
    writePassword(item, 'github_pat_11ABC_def')
    assert.equal(readPassword(item), 'github_pat_11ABC_def')
    writePassword(item, 'ghp_second')
    assert.equal(readPassword(item), 'ghp_second')
  })

  it('security만 열 수 있게 만든다 (앱 서명이 바뀌어도 묻지 않는다)', () => {
    writePassword(item, 'ghp_acl')
    const acl = execFileSync('security', ['dump-keychain', '-a', keychain], { encoding: 'utf8' })
    assert.match(acl, /\/usr\/bin\/security \(OK\)\n\s+requirement: identifier "com\.apple\.security" and anchor apple/)
    assert.doesNotMatch(acl, /cdhash/)
  })

  it('지우면 null, 없는 항목을 지워도 괜찮다', () => {
    writePassword(item, 'ghp_delete')
    deletePassword(item)
    assert.equal(readPassword(item), null)
    deletePassword(item)
  })

  it('security -i 명령을 깨는 문자는 거절한다', () => {
    assert.throws(() => writePassword(item, 'a"b'), /저장할 수 없는 문자/)
    assert.throws(() => writePassword(item, 'a\nb'), /저장할 수 없는 문자/)
  })
})
