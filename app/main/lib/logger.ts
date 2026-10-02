// ~/Library/Logs/Ariadne/ariadne.log. 한 줄 = 한 기록. 1MB가 넘으면 .1로 넘긴다
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { redact, type RedactOptions } from './redact.ts'

export type Level = 'info' | 'warn' | 'error'

export interface LogEntry {
  time: string
  level: Level
  // 어디서 났는지: main, renderer, ipc:<채널>, draft, toast …
  source: string
  message: string
}

export interface Logger {
  file: string
  write(level: Level, source: string, message: string): void
  error(source: string, error: unknown): void
  tail(lines?: number): string[]
  recentErrors(count?: number): LogEntry[]
}

export function errorText(error: unknown) {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`
  return typeof error === 'string' ? error : JSON.stringify(error)
}

const parse = (line: string): LogEntry | undefined => {
  const m = line.match(/^(\S+) (INFO|WARN|ERROR) \[([^\]]+)\] (.*)$/)
  return m ? { time: m[1], level: m[2].toLowerCase() as Level, source: m[3], message: m[4].replace(/\\n/g, '\n') } : undefined
}

export function createLogger(dir: string, options: { maxBytes?: number; redact?: () => RedactOptions } = {}): Logger {
  const maxBytes = options.maxBytes ?? 1024 * 1024
  const file = join(dir, 'ariadne.log')
  const read = () => {
    const parts = [`${file}.1`, file].filter((f) => existsSync(f)).map((f) => readFileSync(f, 'utf8'))
    return parts.join('').split('\n').filter(Boolean)
  }
  const logger: Logger = {
    file,
    write(level, source, message) {
      try {
        mkdirSync(dir, { recursive: true })
        if (existsSync(file) && statSync(file).size > maxBytes) renameSync(file, `${file}.1`)
        const clean = redact(message, options.redact?.()).replace(/\r?\n/g, '\\n')
        appendFileSync(file, `${new Date().toISOString()} ${level.toUpperCase()} [${source}] ${clean}\n`)
      } catch {
        // 로그를 못 써도 앱은 계속 돈다
      }
    },
    error(source, error) {
      logger.write('error', source, errorText(error))
    },
    tail(lines = 200) {
      return read().slice(-lines)
    },
    recentErrors(count = 10) {
      return read()
        .map(parse)
        .filter((e): e is LogEntry => e?.level === 'error')
        .slice(-count)
    },
  }
  return logger
}
