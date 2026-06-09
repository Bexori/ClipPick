const { spawn } = require('child_process')
const path = require('path')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const bin = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-vite.cmd' : 'electron-vite',
)

const child = spawn(bin, ['dev'], {
  cwd: path.join(__dirname, '..'),
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
