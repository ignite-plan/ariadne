// Claude Code에 주는 앱 도구(MCP). 127.0.0.1 임의 포트 + 토큰. Electron에 의존하지 않는다
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { McpServer, type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import YAML from 'yaml'
import { z } from 'zod'
import { loadManual, manualDir, type ManualRef } from '../../../src/core/manual.ts'
import { describeStep } from '../../../src/core/video/describe.ts'
import { applyVars, listVideos, loadVideo, parseScene, parseVideo, saveVideo, videoVars } from '../../../src/core/video/scenario.ts'
import type { ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js'
import { ariadneToolLabel, MCP_NAME } from './ariadne-tools.ts'
import { createSection, readTree } from './sections.ts'
import { removeShot, ROLES, SHOT_STEP, type OpenResult, type StgSession } from './stg.ts'

export { MCP_NAME }

export interface ToolEvent {
  tool: string
  summary: string
}

export interface AriadneMcpDeps {
  ref: ManualRef
  // 처음 STG 도구를 부를 때 만든다 (로그인 세션이 필요)
  stg: () => StgSession
  // 가이드 영상 시나리오를 STG에서 화면만 띄워 실행해 본다 (녹화·저장 없음)
  videoCheck?: (id: string, fromScene?: number) => Promise<VideoCheck>
  // 장면 하나만 채우는 작업이면 그 장면. insert면 index 다음에 새 장면을 넣는다 (처음 저장한 뒤로는 그 장면을 고친다)
  videoScene?: { id: string; index: number; insert: boolean }
  // 캡처 저장을 막는 이유 (반영 범위를 정한 최신화: 지금 STG엔 범위 밖 변경이 들어 있을 수 있다)
  noShots?: string
  // 캡처 정의만 만드는 작업: 이 이미지 id만 받고, 매뉴얼 이미지는 바꾸지 않는다 (대상 화면이 쓰는 이미지)
  defineShots?: string[]
  onEvent?: (event: ToolEvent) => void
}

export type VideoCheck = { ok: true; durationMs: number; blockedRequests: string[] } | { ok: false; error: string; scene?: number | 'cleanup'; step?: number }

const FULL = z
  .boolean()
  .optional()
  .describe(
    'true면 화면 전체 접근성 트리를 길게(최대 12000자) 돌려준다. 대화에 계속 쌓이므로 잘린 뒤쪽이 꼭 필요할 때만. 기본은 짧게 (대화상자가 열려 있으면 대화상자만, 누르기·입력 뒤 같은 화면이면 달라진 줄만)',
  )

const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] })
const fail = (error: unknown) => ({
  content: [{ type: 'text' as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }],
  isError: true,
})

function describe(result: OpenResult) {
  return [
    `URL: ${result.url}`,
    `제목: ${result.title}`,
    `스크린샷: ${result.screenshot} (보통은 읽지 않는다. 캡처 저장 직전 구성 확인에만 Read)`,
    result.blockedRequests.length ? `차단한 쓰기 요청: ${result.blockedRequests.join(', ')}` : '',
    '',
    result.changesOnly
      ? result.snapshot
        ? '같은 화면이라 앞 응답과 달라진 줄만 (나머지는 앞 응답 그대로. 전체가 필요하면 full: true):'
        : '같은 화면이고 접근성 트리에 달라진 곳이 없습니다'
      : result.scope === 'dialog'
        ? '열린 대화상자의 접근성 트리 (뒤 화면은 생략. 전체는 full: true. UI 라벨은 여기 표기 그대로 쓴다):'
        : '화면 접근성 트리 (UI 라벨은 여기 표기 그대로 쓴다):',
    result.snapshot,
  ]
    .filter((l) => l !== '')
    .join('\n')
}

// definedNow: 이 작업에서 save_shot(정의만)으로 등록한 id. 서버는 요청마다 새로 만들므로 작업 단위로 바깥에서 들고 있다
function buildServer(deps: AriadneMcpDeps, definedNow: Set<string>) {
  const server = new McpServer({ name: MCP_NAME, version: '1.0.0' })
  // 호출을 알리고, 던진 오류는 Claude가 읽을 도구 오류로 돌려준다
  const tool = <S extends ZodRawShapeCompat>(name: string, config: { description: string; inputSchema: S }, fn: ToolCallback<S>) => {
    const call = fn as (...args: unknown[]) => ReturnType<typeof text> | Promise<ReturnType<typeof text>>
    const guarded = async (...args: unknown[]) => {
      try {
        deps.onEvent?.({ tool: name, summary: ariadneToolLabel(name, (args[0] ?? {}) as Record<string, unknown>) })
        return await call(...args)
      } catch (error) {
        return fail(error)
      }
    }
    server.registerTool(name, config, guarded as ToolCallback<S>)
  }

  tool(
    'manual_outline',
    {
      description: '지금 매뉴얼의 장/화면 목록, 매뉴얼 폴더 경로, 작성 템플릿 경로, 캡처 주소를 돌려준다. 작업 시작 때 먼저 부른다',
      inputSchema: {},
    },
    () => {
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
    },
  )

  tool(
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
    (args) => {
      const path = createSection(deps.ref, args)
      return text(JSON.stringify({ path, file: join(manualDir(deps.ref), path) }))
    },
  )

  tool(
    'stg_open',
    {
      description:
        'STG 화면을 연다 (캡처 주소 기준 경로, 예: /menu). 화면 접근성 트리와 스크린샷 경로를 돌려준다. 저장/삭제는 할 수 없다',
      inputSchema: { path: z.string(), full: FULL },
    },
    async ({ path, full }) => text(describe(await deps.stg().open(path, { full }))),
  )

  tool(
    'stg_click',
    {
      description: '지금 화면에서 버튼/탭/링크 등을 누른다 (팝업, 탭, 상세 보기 열기). 저장/삭제/승인/발송류는 거절된다',
      inputSchema: {
        role: z.enum(ROLES),
        name: z.string().describe('접근성 트리에 보이는 그 요소의 이름 (role 뒤 따옴표 안). 도움말 문장이나 드롭다운의 선택값이 아니다'),
        nth: z.number().int().min(0).optional(),
        full: FULL,
      },
    },
    async ({ role, name, nth, full }) => text(describe(await deps.stg().click(role, name, nth, { full }))),
  )

  tool(
    'stg_fill',
    {
      description: '입력칸에 값을 넣는다 (생성/수정 화면을 입력 상태로 보여 줄 때). label은 접근성 트리의 입력칸 이름(textbox "…", combobox "…" 등) 그대로 쓴다. 안내 문구나 선택값이 아니다. 없으면 지금 화면의 입력칸 목록을 돌려준다. 저장 버튼은 누르지 않는다',
      inputSchema: { label: z.string(), value: z.string(), full: FULL },
    },
    async ({ label, value, full }) => text(describe(await deps.stg().fill(label, value, { full }))),
  )

  tool(
    'save_shot',
    {
      description:
        '매뉴얼 이미지를 찍어 images/<id>.png로 저장하고 shots.ts에 캡처 정의를 추가한다 (다음 릴리즈 재캡처용). 새 페이지에서 steps를 재생해 찍는다. 본문에는 ![Caption](images/<id>.png){width=6.27in} 형식으로 넣는다',
      inputSchema: {
        id: z.string().describe('caption slug. 예: menu-list'),
        path: z.string(),
        ready: z.string().optional().describe('화면 준비 완료 locator. 예: text=Total'),
        steps: z.array(SHOT_STEP).optional(),
        clip: z.string().optional().describe('찍을 영역 locator. 팝업은 [role="dialog"], 전체 화면은 생략 또는 #root'),
        mask: z.array(z.string()).optional(),
        replace: z
          .boolean()
          .optional()
          .describe('이미 있는 이미지(images/<id>.png)나 캡처 정의를 바꿀 때 true (최신화). 새 이미지는 생략'),
      },
    },
    async ({ replace, ...args }) => {
      if (deps.noShots) throw new Error(deps.noShots)
      if (deps.defineShots) {
        if (!deps.defineShots.includes(args.id)) {
          throw new Error(`이 화면의 이미지가 아닙니다: ${args.id}. 대상 화면이 쓰는 이미지만 정의한다: ${deps.defineShots.join(', ')}`)
        }
        const saved = await deps.stg().saveShot(args, true, { defineOnly: true })
        definedNow.add(args.id)
        // 찍은 결과(captured)를 매뉴얼 이미지(manual)와 Read로 비교해 같은 화면 상태인지 확인한다
        return text(JSON.stringify({ captured: saved.file, manual: saved.manualImage }))
      }
      const saved = await deps.stg().saveShot(args, replace)
      return text(JSON.stringify({ image: saved.image, file: saved.file }))
    },
  )

  // 캡처 정의만 만드는 작업: 찍어 보니 매뉴얼 이미지와 다른 화면이면 이번에 등록한 정의를 뺀다 (원래 있던 정의는 못 뺀다)
  if (deps.defineShots) {
    tool(
      'drop_shot',
      {
        description:
          '이번 작업에서 save_shot으로 등록한 캡처 정의를 뺀다. 찍은 결과가 매뉴얼 이미지와 다른 화면이고 같은 상태를 만들 수 없을 때 쓴다',
        inputSchema: { id: z.string(), reason: z.string().describe('뺀 이유 (기획자에게 보여 준다)') },
      },
      ({ id }) => {
        if (!definedNow.has(id)) throw new Error(`이번 작업에서 등록한 정의가 아닙니다: ${id}`)
        const file = join(manualDir(deps.ref), 'shots.ts')
        writeFileSync(file, removeShot(readFileSync(file, 'utf8'), id))
        definedNow.delete(id)
        return text(`캡처 정의를 뺐습니다: ${id}`)
      },
    )
  }

  // 가이드 영상 시나리오. 정해진 단계만 담은 YAML이라 임의 코드는 없다
  const outline = (id: string) => {
    const v = loadVideo(deps.ref, id)
    return v.scenes
      .map((scene, i) => [`장면 ${i + 1}: ${scene.say ?? '(내레이션 없음)'}`, ...scene.steps.map((step, j) => `  ${j + 1}. ${describeStep(step)}`)].join('\n'))
      .join('\n')
  }

  tool(
    'video_get',
    {
      description:
        '가이드 영상 시나리오 YAML(manuals/<m>/videos/<id>.yaml)과 형식 안내를 돌려준다. 시나리오를 쓰기 전에 먼저 부른다',
      inputSchema: { id: z.string() },
    },
    ({ id }) => {
      if (!listVideos(deps.ref).includes(id)) throw new Error(`영상 시나리오가 없습니다: ${id}`)
      const v = loadVideo(deps.ref, id)
      const { id: _, ...file } = v
      return text(
        JSON.stringify(
          {
            id,
            file: join(manualDir(deps.ref), 'videos', `${id}.yaml`),
            // 연결된 매뉴얼 화면 (영상에 나오는 순서)
            sections: (v.sections ?? []).map((s) => join(manualDir(deps.ref), s)),
            yaml: YAML.stringify(file),
            example: join(deps.ref.root, 'manuals', 'bo', 'videos', 'dealer-list.yaml'),
          },
          null,
          2,
        ),
      )
    },
  )

  tool(
    'video_save',
    {
      description:
        '가이드 영상 시나리오 전체를 YAML로 저장한다 (형식 검사 후). title, intro, sections, maskPersonal, mask, scenes[say, steps]. mutates(STG 저장 허용)는 켤 수 없다',
      inputSchema: { id: z.string(), yaml: z.string().describe('시나리오 YAML 전체 (id 제외)') },
    },
    ({ id, yaml }) => {
      if (deps.videoScene) throw new Error('이 작업은 장면 하나만 바꿉니다. video_save_scene을 쓰세요')
      if (!listVideos(deps.ref).includes(id)) throw new Error(`영상 시나리오가 없습니다: ${id}`)
      const next = parseVideo(id, YAML.parse(yaml))
      // 저장·삭제 버튼을 실제로 누를지는 기획자가 정한다
      if (next.mutates && !loadVideo(deps.ref, id).mutates) {
        throw new Error('mutates(STG 저장 허용)는 켤 수 없습니다. 저장 버튼 직전까지만 시나리오에 넣으세요')
      }
      saveVideo(deps.ref, next)
      return text(`저장했습니다.\n${outline(id)}`)
    },
  )

  tool(
    'video_open_scene',
    {
      description:
        '가이드 영상 시나리오의 앞 장면(0부터 scene-1까지) 단계를 STG 브라우저에서 재생해, 그 장면이 시작되는 화면을 연다. 돌려준 접근성 트리로 이어서 stg_click/stg_fill을 쓴다',
      inputSchema: { id: z.string(), scene: z.number().int().min(0).describe('이 장면(0부터)이 시작되는 화면까지 재생') },
    },
    async ({ id, scene }) => {
      const v = applyVars(loadVideo(deps.ref, id), videoVars())
      // 저장 허용 시나리오는 앞 장면을 재생하면 STG에 저장이 한 번 더 일어난다
      if (v.mutates) throw new Error('STG 저장 허용 시나리오는 Claude가 앞 장면을 재생하지 않습니다. 앱의 [STG에서 기록]을 쓰세요')
      return text(describe(await deps.stg().replay(v.scenes.slice(0, scene), v.mutates)))
    },
  )

  tool(
    'video_save_scene',
    {
      description:
        '이번 작업의 대상 장면 하나만 YAML로 저장한다 (say, caption, steps). 다른 장면과 시나리오 설정은 그대로 둔다. 처음 저장하면 새 장면이 들어가고, 다시 저장하면 그 장면을 고친다',
      inputSchema: { id: z.string(), yaml: z.string().describe('장면 하나의 YAML. 예: say: ... / steps: [...]') },
    },
    ({ id, yaml }) => {
      const target = deps.videoScene
      if (!target || target.id !== id) throw new Error('이 작업에서는 장면 하나만 저장할 수 없습니다')
      const scene = parseScene(YAML.parse(yaml))
      const v = loadVideo(deps.ref, id)
      const scenes = [...v.scenes]
      if (target.insert) {
        scenes.splice(target.index + 1, 0, scene)
        // 다음 저장부터는 방금 넣은 장면을 고친다
        target.index += 1
        target.insert = false
      } else {
        if (!scenes[target.index]) throw new Error(`장면 ${target.index + 1}이 없습니다`)
        scenes[target.index] = scene
      }
      saveVideo(deps.ref, { ...v, scenes })
      return text(`장면 ${target.index + 1}로 저장했습니다. 확인: video_check(fromScene: ${target.index})\n${outline(id)}`)
    },
  )

  tool(
    'video_check',
    {
      description:
        '저장된 가이드 영상 시나리오를 STG에서 화면만 띄워 처음부터(또는 fromScene부터) 실행해 본다. 녹화·음성 없음. 실패하면 장면·단계 번호와 이유를 돌려준다',
      inputSchema: { id: z.string(), fromScene: z.number().int().min(0).optional().describe('이 장면(0부터)부터. 앞 장면은 빠르게 재생') },
    },
    async ({ id, fromScene }) => {
      if (!deps.videoCheck) throw new Error('이 작업에서는 영상 시나리오를 실행할 수 없습니다')
      if (loadVideo(deps.ref, id).mutates) throw new Error('STG 저장 허용 시나리오는 Claude가 실행하지 않습니다')
      const result = await deps.videoCheck(id, fromScene)
      if (result.ok) {
        const blocked = result.blockedRequests.length ? `\n막은 쓰기 요청: ${result.blockedRequests.join(', ')}` : ''
        return text(`끝까지 실행했습니다 (${Math.round(result.durationMs / 1000)}초).${blocked}`)
      }
      return { ...text(`실패: ${result.error}`), isError: true }
    },
  )

  return server
}

export async function startAriadneMcp(deps: AriadneMcpDeps) {
  const token = randomBytes(24).toString('hex')
  const definedNow = new Set<string>()
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
      const server = buildServer(deps, definedNow)
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
