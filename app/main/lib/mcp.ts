// Claude Code에 주는 앱 도구(MCP). 127.0.0.1 임의 포트 + 토큰. Electron에 의존하지 않는다
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { loadManual, manualDir, type ManualRef } from '../../../src/core/manual.ts'
import { createSection, readTree } from './sections.ts'
import type { OpenResult, Role, ShotInput, StgSession } from './stg.ts'

export const MCP_NAME = 'ariadne'

export interface ToolEvent {
  tool: string
  summary: string
}

export interface AriadneMcpDeps {
  ref: ManualRef
  // 처음 STG 도구를 부를 때 만든다 (로그인 세션이 필요)
  stg: () => StgSession
  onEvent?: (event: ToolEvent) => void
}

const ROLES = ['button', 'link', 'tab', 'menuitem', 'checkbox', 'radio', 'combobox', 'option', 'treeitem', 'row'] as const

const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] })
const fail = (error: unknown) => ({
  content: [{ type: 'text' as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }],
  isError: true,
})

function describe(result: OpenResult) {
  return [
    `URL: ${result.url}`,
    `제목: ${result.title}`,
    `스크린샷: ${result.screenshot} (Read로 볼 수 있음)`,
    result.blockedRequests.length ? `차단한 쓰기 요청: ${result.blockedRequests.join(', ')}` : '',
    '',
    '화면 접근성 트리 (UI 라벨은 여기 표기 그대로 쓴다):',
    result.snapshot,
  ]
    .filter((l) => l !== '')
    .join('\n')
}

function buildServer(deps: AriadneMcpDeps) {
  const server = new McpServer({ name: MCP_NAME, version: '1.0.0' })
  const run = async <T>(tool: string, summary: string, fn: () => Promise<T> | T) => {
    deps.onEvent?.({ tool, summary })
    return fn()
  }

  server.registerTool(
    'manual_outline',
    {
      description: '지금 매뉴얼의 장/화면 목록, 매뉴얼 폴더 경로, 작성 템플릿 경로, 캡처 주소를 돌려준다. 작업 시작 때 먼저 부른다',
      inputSchema: {},
    },
    async () => {
      try {
        return await run('manual_outline', '매뉴얼 목차 확인', () => {
          const tree = readTree(deps.ref)
          const manual = loadManual(deps.ref)
          const dir = manualDir(deps.ref)
          return text(
            JSON.stringify(
              {
                manual: deps.ref.manual,
                title: tree.title,
                folder: dir,
                template: existsSync(join(dir, '_template.md')) ? join(dir, '_template.md') : join(deps.ref.root, 'manuals', 'bo', '_template.md'),
                example: join(deps.ref.root, 'manuals', 'bo', '02-dealer-management', '01-dealer-list-view.md'),
                captureBaseUrl: manual.capture?.baseUrl,
                chapters: tree.chapters.map((c, index) => ({
                  index,
                  no: c.no,
                  dir: c.dir,
                  title: c.title,
                  sections: c.sections.map((s) => ({ path: s.path, title: s.title })),
                })),
              },
              null,
              2,
            ),
          )
        })
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'create_section',
    {
      description:
        '매뉴얼에 화면(섹션) 파일을 만들고 manual.yaml에 등록한다. 새 장이면 newChapterTitle과 chapterIndex(0부터, 그 위치에 끼워 넣고 뒤 장 번호를 민다). 돌려준 file에 Write로 본문을 쓴다',
      inputSchema: {
        title: z.string().describe('화면 이름 (영어). 예: Menu List View'),
        chapterDir: z.string().optional().describe('기존 장 폴더. 예: 08-menu-management'),
        newChapterTitle: z.string().optional().describe('새 장 이름 (영어). 예: Menu Management'),
        chapterIndex: z.number().int().min(0).optional().describe('새 장을 넣을 위치 (0부터)'),
      },
    },
    async (args) => {
      try {
        return await run('create_section', `화면 만들기: ${args.title}`, () => {
          const path = createSection(deps.ref, args)
          return text(JSON.stringify({ path, file: join(manualDir(deps.ref), path) }))
        })
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'stg_open',
    {
      description:
        'STG 화면을 연다 (캡처 주소 기준 경로, 예: /menu). 화면 접근성 트리와 스크린샷 경로를 돌려준다. 저장/삭제는 할 수 없다',
      inputSchema: { path: z.string() },
    },
    async ({ path }) => {
      try {
        return await run('stg_open', `화면 열기: ${path}`, async () => text(describe(await deps.stg().open(path))))
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'stg_click',
    {
      description: '지금 화면에서 버튼/탭/링크 등을 누른다 (팝업, 탭, 상세 보기 열기). 저장/삭제/승인/발송류는 거절된다',
      inputSchema: {
        role: z.enum(ROLES),
        name: z.string().describe('접근성 트리에 보이는 이름'),
        nth: z.number().int().min(0).optional(),
      },
    },
    async ({ role, name, nth }) => {
      try {
        return await run('stg_click', `누르기: ${name}`, async () =>
          text(describe(await deps.stg().click(role as Role, name, nth))),
        )
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'stg_fill',
    {
      description: '입력칸에 값을 넣는다 (생성/수정 화면을 입력 상태로 보여 줄 때). 저장 버튼은 누르지 않는다',
      inputSchema: { label: z.string(), value: z.string() },
    },
    async ({ label, value }) => {
      try {
        return await run('stg_fill', `입력: ${label}`, async () => text(describe(await deps.stg().fill(label, value))))
      } catch (error) {
        return fail(error)
      }
    },
  )

  const step = z.union([
    z.object({ click: z.object({ role: z.enum(ROLES), name: z.string(), nth: z.number().int().min(0).optional() }) }),
    z.object({ fill: z.object({ label: z.string(), value: z.string() }) }),
    z.object({ waitFor: z.string().describe('CSS/텍스트 locator. 예: text=Menu Information') }),
  ])

  server.registerTool(
    'save_shot',
    {
      description:
        '매뉴얼 이미지를 찍어 images/<id>.png로 저장하고 shots.ts에 캡처 정의를 추가한다 (다음 릴리즈 재캡처용). 새 페이지에서 steps를 재생해 찍는다. 본문에는 ![Caption](images/<id>.png){width=6.27in} 형식으로 넣는다',
      inputSchema: {
        id: z.string().describe('caption slug. 예: menu-list'),
        path: z.string(),
        ready: z.string().optional().describe('화면 준비 완료 locator. 예: text=Total'),
        steps: z.array(step).optional(),
        clip: z.string().optional().describe('찍을 영역 locator. 팝업은 [role="dialog"], 전체 화면은 생략 또는 #root'),
        mask: z.array(z.string()).optional(),
      },
    },
    async (args) => {
      try {
        return await run('save_shot', `캡처 저장: ${args.id}`, async () => {
          const saved = await deps.stg().saveShot(args as ShotInput)
          return text(JSON.stringify({ image: saved.image, file: saved.file }))
        })
      } catch (error) {
        return fail(error)
      }
    },
  )

  return server
}

export async function startAriadneMcp(deps: AriadneMcpDeps) {
  const token = randomBytes(24).toString('hex')
  const httpServer = http.createServer(async (req, res) => {
    if (req.headers.authorization !== `Bearer ${token}` || !req.url?.startsWith('/mcp')) {
      res.writeHead(401).end()
      return
    }
    try {
      let body: unknown
      if (req.method === 'POST') {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined
      }
      // stateless: 요청마다 서버를 만든다. STG 브라우저 세션은 deps.stg가 유지한다
      const server = buildServer(deps)
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
      res.on('close', () => {
        void transport.close()
        void server.close()
      })
      await server.connect(transport)
      await transport.handleRequest(req, res, body)
    } catch (error) {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: String(error) }, id: null }))
    }
  })
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
  const { port } = httpServer.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    token,
    // claude --mcp-config에 넘길 JSON
    config: { mcpServers: { [MCP_NAME]: { type: 'http', url: `http://127.0.0.1:${port}/mcp`, headers: { Authorization: `Bearer ${token}` } } } },
    close: () => new Promise<void>((resolve) => httpServer.close(() => resolve())),
  }
}
