import { useEffect, useState } from 'react'
import { useLicense } from './billing/license'
import { BILLING_ENABLED, limitsFor } from './billing/plan'
import { Pricing } from './billing/Pricing'
import { Privacy } from './legal/Privacy'
import { Terms } from './legal/Terms'
import { Support } from './support/Support'
import { Suggestions } from './support/Suggestions'
import { Cleaner } from './ui/Cleaner'

type Route = 'home' | 'precios' | 'privacidad' | 'terminos' | 'soporte' | 'sugerencias'

const ROUTES: Route[] = ['precios', 'privacidad', 'terminos', 'soporte', 'sugerencias']

function readRoute(): Route {
  const r = window.location.hash.replace(/^#\/?/, '')
  return (ROUTES as string[]).includes(r) ? (r as Route) : 'home'
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute)
  const license = useLicense()

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          <span className="logo" aria-hidden="true">
            ✦
          </span>
          <span>DataClean</span>
          {license.plan === 'pro' && <span className="badge pro">Pro</span>}
        </a>
        <span className="privacy">🔒 Tus archivos se procesan en este navegador y no se suben a ningún servidor</span>
        <nav className="topnav" aria-label="Ayuda">
          <a href="#/soporte">Ayuda</a>
          <a href="#/sugerencias">Sugerencias</a>
        {BILLING_ENABLED && license.plan === 'free' && (
          <a className="upgrade" href="#/precios">
            Plan Pro
          </a>
        )}
        </nav>
      </header>

      {/* El limpiador se mantiene montado para no perder el trabajo al consultar otras páginas. */}
      <div hidden={route !== 'home'}>
        <Cleaner limits={limitsFor(license.plan)} canUpgrade={BILLING_ENABLED && license.plan === 'free'} />
      </div>
      {route !== 'home' && (
        <main>
          {route === 'precios' && <Pricing license={license} />}
          {route === 'privacidad' && <Privacy />}
          {route === 'terminos' && <Terms />}
          {route === 'soporte' && <Support />}
          {route === 'sugerencias' && <Suggestions />}
        </main>
      )}

      <footer className="footer">
        <span>© {new Date().getFullYear()} DataClean</span>
        <nav aria-label="Enlaces del sitio">
          <a href="#/soporte">Servicio al cliente</a>
          <a href="#/sugerencias">Buzón de sugerencias</a>
          {BILLING_ENABLED && <a href="#/precios">Planes</a>}
          <a href="#/terminos">Términos y condiciones</a>
          <a href="#/privacidad">Aviso de privacidad</a>
        </nav>
      </footer>
    </div>
  )
}
