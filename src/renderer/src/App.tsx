import { useEffect, useState, type JSX } from 'react'
import type { RuntimeInfo } from '../../shared/ipc'

const APP_TITLE = '文脉 / FolioTrace'

export function App(): JSX.Element {
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null)

  useEffect(() => {
    let active = true

    const load = async (): Promise<void> => {
      try {
        const info = await window.folio.getRuntimeInfo()
        if (active) setRuntime(info)
      } catch {
        if (active) setRuntime(null)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  return (
    <main className="shell">
      <header className="brand">
        <span className="brand-mark" aria-hidden="true">
          文
        </span>
        <span className="brand-name">{APP_TITLE}</span>
      </header>

      <section className="stage" aria-labelledby="stage-title">
        <p className="eyebrow">本地文档材料工作台</p>
        <h1 id="stage-title">{APP_TITLE}</h1>
        <p className="lead">让每一版有来处，让每份材料有联系。</p>
        <p className="status" role="status">
          <span className="status-dot" aria-hidden="true" />
          开发环境已就绪
        </p>
        <p className="runtime">
          {runtime
            ? `Electron ${runtime.electronVersion} · Chromium ${runtime.chromeVersion} · 应用 ${runtime.appVersion}`
            : '正在连接主进程…'}
        </p>
      </section>

      <footer className="foot">M1 · 桌面壳与最小桥接 · 尚未连接真实业务目录</footer>
    </main>
  )
}
