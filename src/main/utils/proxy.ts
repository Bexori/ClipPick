export function getProxyArgs(): string[] {
  const proxy =
    process.env.VIDEOBOX_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.ALL_PROXY ||
    ''

  return proxy.trim() ? ['--proxy', proxy.trim()] : []
}
