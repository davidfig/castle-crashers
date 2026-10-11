#!/usr/bin/env node
// Lets agents sharing one working tree see each other's work, with no agent having to
// remember to register. Claude Code hooks (.claude/settings.json) call this script:
//   session-start  SessionStart      prints who else is active into the new agent's context
//   prompt         UserPromptSubmit  records what the session is working on (its prompt)
//   edit           PreToolUse        records each file an agent edits, and warns it when
//                                    another live session edited the same file recently
//   stop           Stop              marks the session idle (its turn is over, it waits on the user)
//   end            SessionEnd        drops the session (also fired when the app archives it)
// Humans and agents can look at the current picture with:
//   node tools/agent-work.mjs list
// State lives in .tmp/agent-work.json (gitignored). Sessions with no activity for
// ACTIVE_MS drop out on their own, so a crashed or forgotten session never lingers.
import { mkdirSync, rmdirSync, readFileSync, writeFileSync, renameSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, isAbsolute } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = join(ROOT, '.tmp', 'agent-work.json')
const LOCK = FILE + '.lock'
const ACTIVE_MS = 30 * 60_000 // a session quiet this long is gone; also the overlap window
const STALE_LOCK_MS = 10_000
const TASK_MAX = 140

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const short = (sid) => String(sid).slice(0, 8)
const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60_000)
  return m < 1 ? 'just now' : `${m} min ago`
}

async function withState(fn) {
  mkdirSync(dirname(FILE), { recursive: true })
  const start = Date.now()
  for (;;) {
    try {
      mkdirSync(LOCK)
      break
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      try {
        if (Date.now() - statSync(LOCK).mtimeMs > STALE_LOCK_MS) rmdirSync(LOCK)
      } catch {}
      if (Date.now() - start > 5_000) throw new Error('timed out waiting for ' + LOCK)
      await sleep(20 + Math.random() * 40)
    }
  }
  try {
    let state
    try {
      state = JSON.parse(readFileSync(FILE, 'utf8'))
    } catch {
      state = { sessions: {} }
    }
    const now = Date.now()
    for (const [sid, s] of Object.entries(state.sessions)) if (now - s.last > ACTIVE_MS) delete state.sessions[sid]
    const out = fn(state, now)
    const tmp = FILE + '.tmp' + process.pid
    writeFileSync(tmp, JSON.stringify(state, null, 1))
    renameSync(tmp, FILE)
    return out
  } finally {
    try {
      rmdirSync(LOCK)
    } catch {}
  }
}

function session(state, sid, now) {
  return (state.sessions[sid] ??= { task: '', started: now, last: now, files: {}, warned: {} })
}

function describe(sid, s) {
  const files = Object.entries(s.files)
    .sort((a, b) => b[1] - a[1])
    .map(([f]) => f)
  const list = files.length ? files.slice(0, 8).join(', ') + (files.length > 8 ? ` (+${files.length - 8} more)` : '') : 'no edits yet'
  const state = s.idle ? `idle since ${ago(s.idle)}` : `active ${ago(s.last)}`
  return `- [${short(sid)}] ${state}: ${s.task || '(no prompt recorded)'}\n    files: ${list}`
}

function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}')
  } catch {
    return {}
  }
}

const hooks = {
  'session-start'(input) {
    const others = withState((state, now) => {
      session(state, input.session_id, now).last = now
      return Object.entries(state.sessions).filter(([sid]) => sid !== input.session_id)
    })
    return others.then((list) => {
      if (!list.length) return
      console.log(
        `Other agents are working in this tree right now (from tools/agent-work.mjs; it updates itself, nothing to register). ` +
          `Steer clear of their files, or work around them:\n` +
          list.map(([sid, s]) => describe(sid, s)).join('\n'),
      )
    })
  },

  prompt(input) {
    const text = String(input.prompt ?? '').replace(/\s+/g, ' ').trim()
    return withState((state, now) => {
      const s = session(state, input.session_id, now)
      s.last = now
      delete s.idle
      // A short follow-up ("yes", "go on") says less about the task than the prompt before it.
      if (text && (!s.task || text.length >= 40)) s.task = text.length > TASK_MAX ? text.slice(0, TASK_MAX - 1) + '…' : text
    })
  },

  edit(input) {
    const raw = input.tool_input?.file_path ?? input.tool_input?.notebook_path
    if (!raw) return
    const abs = isAbsolute(raw) ? raw : join(input.cwd ?? ROOT, raw)
    const file = relative(ROOT, abs)
    if (file.startsWith('..')) return
    return withState((state, now) => {
      const me = session(state, input.session_id, now)
      me.last = now
      delete me.idle
      me.files[file] = now
      const clashes = Object.entries(state.sessions).filter(
        ([sid, s]) => sid !== input.session_id && s.files[file] && now - s.files[file] < ACTIVE_MS && s.files[file] > (me.warned[file] ?? 0),
      )
      if (!clashes.length) return
      me.warned[file] = now
      return clashes
    }).then((clashes) => {
      if (!clashes) return
      const who = clashes.map(([sid, s]) => `[${short(sid)}] (edited it ${ago(s.files[file])}${s.idle ? ', now idle' : ''}; working on: ${s.task || 'unknown'})`)
      const msg =
        `Heads up: another agent is also editing ${file}: ${who.join('; ')}. ` +
        `Re-read the file before changing it, keep your edit narrow, and don't revert lines you didn't write. ` +
        `Run \`node tools/agent-work.mjs list\` to see everything in flight.`
      console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: msg } }))
    })
  },

  stop(input) {
    return withState((state, now) => {
      const s = state.sessions[input.session_id]
      if (s) s.idle = now
    })
  },

  end(input) {
    return withState((state) => {
      delete state.sessions[input.session_id]
    })
  },
}

const [cmd] = process.argv.slice(2)

if (hooks[cmd]) {
  // A hook must never get in the way of the agent's work, whatever goes wrong here.
  try {
    await hooks[cmd](readInput())
  } catch {}
  process.exit(0)
} else if (cmd === 'list') {
  const list = await withState((state) => Object.entries(state.sessions).sort((a, b) => b[1].last - a[1].last))
  console.log(list.length ? list.map(([sid, s]) => describe(sid, s)).join('\n') : '(no other agents active)')
} else if (cmd === 'add' || cmd === 'remove') {
  console.log('agent-work is automatic now (Claude Code hooks track prompts and edits); nothing to register or remove.')
} else {
  console.error('usage: node tools/agent-work.mjs list')
  process.exit(1)
}
