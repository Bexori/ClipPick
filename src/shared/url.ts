export function getHostname(input: string): string {
  try {
    return new URL(input).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function getPathname(input: string): string {
  try {
    return new URL(input).pathname.toLowerCase()
  } catch {
    return ''
  }
}

export function isBilibiliUrl(input: string): boolean {
  const hostname = getHostname(input)
  return hostname.includes('bilibili.com') || hostname === 'b23.tv'
}

export function isPlaylistUrl(input: string): boolean {
  const hostname = getHostname(input)
  const pathname = getPathname(input)
  if (!hostname) return false

  // YouTube playlist / channel
  if (hostname.includes('youtube.com') || hostname === 'youtu.be') {
    if (pathname.includes('/playlist')) return true
    if (pathname.startsWith('/@') || pathname.startsWith('/channel/') || pathname.startsWith('/c/')) return true
    // Short link with list param
    if (hostname === 'youtu.be' && input.includes('list=')) return true
  }

  // Bilibili collections
  if (hostname.includes('bilibili.com') && pathname.includes('/collection')) return true
  // Bilibili user space
  if (hostname === 'space.bilibili.com') return true

  // Generic: any URL with playlist/list param
  if (input.includes('playlist?list=') || input.includes('&list=')) return true

  return false
}

export function getPlaylistLabel(input: string): string {
  const hostname = getHostname(input)
  const pathname = getPathname(input)

  if (hostname.includes('youtube.com') || hostname === 'youtu.be') {
    if (pathname.includes('/playlist')) return 'YouTube 播放列表'
    if (pathname.startsWith('/@') || pathname.startsWith('/channel/') || pathname.startsWith('/c/')) return 'YouTube 频道'
  }
  if (hostname === 'space.bilibili.com') return 'B站用户空间'
  if (hostname.includes('bilibili.com') && pathname.includes('/collection')) return 'B站合集'

  return '播放列表'
}
