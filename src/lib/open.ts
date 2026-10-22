/**
 * 打开外部链接。
 * Capacitor WebView 会拦截非同源跳转并用系统浏览器打开，
 * 这里统一用 <a target="_blank"> 触发，桌面浏览器也会开新标签页。
 */
export function openExternal(url: string, onError?: (message: string) => void) {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    onError?.(err instanceof Error ? err.message : '无法打开链接');
  }
}
