import { spawn } from 'child_process'

/**
 * Spawn a child process without shell interpolation.
 * This keeps URLs with `&`, `?`, `=` and Unicode paths intact on Windows.
 */
export function spawnSafe(cmd: string, args: string[]): ReturnType<typeof spawn> {
  return spawn(cmd, args, {
    shell: false,
    windowsHide: true
  })
}
