import {useQuery} from '@sanity/sdk-react'
import {Suspense, useState} from 'react'
import {Loading} from './App'
import {PostList} from './PostList'
import {PLATFORM_IDS, PLATFORMS} from './vendor/platformSpec'

/**
 * Which platform accounts exist, and the filter bar.
 *
 * The accounts are fetched once here rather than per post: preflight refuses a
 * variant whose platform has no configured account ("the worker has nowhere to
 * post"), and that answer is the same for every post on the page. This is the
 * one place raw GROQ earns its keep — it is a single query across a document
 * type, not a per-document read, so handles plus projections would be the wrong
 * tool.
 */
export interface Account {
  platform: string
  handle?: string
  active?: boolean
  audited?: boolean
}

export function Desk() {
  const [platform, setPlatform] = useState<string>('all')

  const {data} = useQuery<Account[]>({
    query: `*[_type == "platformAccount"]{platform, handle, active, audited}`,
  })

  // An account row that exists but is switched off counts as absent — the
  // worker would skip it either way, so the gate should say so now.
  const accounts = (data ?? []).filter((a) => a && a.active !== false)

  return (
    <main className="desk">
      <header className="desk-head">
        <div>
          <h1>Review desk</h1>
          <p className="desk-sub">
            Drafted by the agent, waiting on you. Approving sets the status the publish worker
            reads — nothing is sent to a platform from here.
          </p>
        </div>
      </header>

      <nav className="desk-filters" aria-label="Filter by platform">
        <FilterChip
          id="all"
          label="Everything"
          current={platform}
          onSelect={setPlatform}
          accent="var(--desk-accent)"
        />
        {PLATFORM_IDS.map((id) => (
          <FilterChip
            key={id}
            id={id}
            label={PLATFORMS[id].label}
            current={platform}
            onSelect={setPlatform}
            accent={PLATFORMS[id].accent}
            warn={!accounts.some((a) => a.platform === id)}
          />
        ))}
      </nav>

      {accounts.length === 0 && (
        <p className="desk-warning">
          No platform account is configured, so every variant here is blocked. Add a{' '}
          <strong>Platform account</strong> in the Studio — the gate needs to know the worker has
          somewhere to post.
        </p>
      )}

      <Suspense fallback={<Loading label="Loading posts" />}>
        <PostList accounts={accounts} platformFilter={platform} />
      </Suspense>
    </main>
  )
}

function FilterChip({
  id,
  label,
  current,
  onSelect,
  accent,
  warn = false,
}: {
  id: string
  label: string
  current: string
  onSelect: (id: string) => void
  accent: string
  warn?: boolean
}) {
  const active = current === id
  return (
    <button
      type="button"
      className={`desk-chip${active ? ' is-active' : ''}`}
      style={active ? {borderColor: accent, color: accent} : undefined}
      onClick={() => onSelect(id)}
      aria-pressed={active}
      title={warn ? `No ${label} account is configured yet` : undefined}
    >
      {label}
      {warn && <span className="desk-chip__warn" aria-label="no account configured" />}
    </button>
  )
}
