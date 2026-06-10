import { spawn } from 'child_process'
import * as os from 'os'

/**
 * Spawn a child process with Unicode-safe arguments on Windows.
 * Uses chcp 65001 (UTF-8 code page) when non-ASCII arguments are present.
 */
export function spawnSafe(cmd: string, args: string[]): ReturnType<typeof spawn> {
  if (os.platform() === 'win32') {
    const hasUnicode = args.some(a => /[^\x00-\x7F]/.test(a))
    if (hasUnicode) {
      const quoted = args.map(a => {
        if (/[^\x00-\x7F]/.test(a) || a.includes(' ')) {
          return `"${a.replace(/"/g, '""')}"`
        }
        return a
      }).join(' ')
      return spawn(`chcp 65001 >nul && "${cmd}" ${quoted}`, { shell: true })
    }
  }
  return spawn(cmd, args)
}
