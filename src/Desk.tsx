import {useQuery} from '@sanity/sdk-react'
import {Suspense} from 'react'
import {Loading} from './App'
import {Queue} from './Queue'
import {PLATFORM_IDS, PLATFORMS} from './vendor/platformSpec'

/**
 * The shell: which platform accounts exist, and the queue below it.
 *
 * The accounts are fetched once here rather than per post, because preflight
 * refuses a variant whose platform has no configured account ("the worker has
 * nowhere to post") and that answer is the same for every post on screen. This is
 * the one place raw GROQ earns its keep — a query across a document type, not a
 * per-document read.
 */
export interface Account {
  platform: string
  handle?: string
  active?: boolean
  audited?: boolean
}

export function Desk() {
  const {data} = useQuery<Account[]>({
    query: `*[_type == "platformAccount"]{platform, handle, active, audited}`,
  })

  // An account that exists but is switched off counts as absent — the worker
  // would skip it either way, so the gate should say so now rather than later.
  const accounts = (data ?? []).filter((a) => a && a.active !== false)
  const missing = PLATFORM_IDS.filter((id) => !accounts.some((a) => a.platform === id))

  return (
    <main className="desk">
      <header className="desk-head">
        <div>
          <span className="eyebrow">Review desk</span>
          <h1>Drafted, waiting on you</h1>
          <p className="desk-sub">
            Approving sets the status the publish worker reads. Nothing is sent to a platform
            from here.
          </p>
        </div>

        {/* Not a filter — a standing account roster. A platform with no account
            blocks every variant for it, and that is worth seeing before you
            wonder why Approve is greyed out. */}
        <ul className="accounts" aria-label="Platform accounts">
          {PLATFORM_IDS.map((id) => {
            const account = accounts.find((a) => a.platform === id)
            return (
              <li
                key={id}
                className={`account${account ? '' : ' is-missing'}`}
                title={
                  account
                    ? `${PLATFORMS[id].label}: ${account.handle ?? 'configured'}`
                    : `${PLATFORMS[id].label}: no account, so its variants cannot be approved`
                }
              >
                <span className="pdot" style={{background: PLATFORMS[id].accent}} />
                {PLATFORMS[id].label}
              </li>
            )
          })}
        </ul>
      </header>

      {missing.length === PLATFORM_IDS.length && (
        <p className="desk-warning">
          No platform account is configured, so every variant is blocked. Add a{' '}
          <strong>Platform account</strong> in the Studio — the gate needs to know the worker has
          somewhere to post.
        </p>
      )}

      <Suspense fallback={<Loading label="Loading the queue" />}>
        <Queue accounts={accounts} />
      </Suspense>
    </main>
  )
}
