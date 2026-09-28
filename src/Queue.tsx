import {useQuery} from '@sanity/sdk-react'
import {Suspense, useEffect, useState} from 'react'
import {Loading} from './App'
import {type Account} from './Desk'
import {Wheel} from './Wheel'
import {PLATFORMS} from './vendor/platformSpec'

/**
 * Master/detail: a rail of posts awaiting a decision, and the selected one as a
 * wheel.
 *
 * The rail is one GROQ query rather than handles plus projections, and that is
 * the right tool here: it needs one aggregate fact per post — how many variants
 * are still waiting — across every post, which is a query, not a per-document
 * read. The wheel then reads the selected post properly, through a projection on
 * its own handle.
 */
const RAIL_QUERY = `
*[_type == "post" && count(variants[status in ["draft", "needs_review"]]) > 0]
  | order(_updatedAt desc) [0...50] {
    _id,
    title,
    _updatedAt,
    "generated": defined(generatedAt),
    "awaiting": count(variants[status in ["draft", "needs_review"]]),
    "platforms": array::unique(variants[status in ["draft", "needs_review"]].platform)
  }
`

interface RailItem {
  _id: string
  title?: string
  _updatedAt?: string
  generated?: boolean
  awaiting?: number
  platforms?: (string | null)[]
}

export function Queue({accounts}: {accounts: Account[]}) {
  const {data} = useQuery<RailItem[]>({query: RAIL_QUERY})
  const items = data ?? []

  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Follow the queue: if nothing is chosen, or the chosen post has just had its
  // last variant decided and dropped out of the rail, move to the top of what is
  // left. That is what makes "decide, next" work without a button for it.
  useEffect(() => {
    if (items.length === 0) {
      if (selectedId !== null) setSelectedId(null)
      return
    }
    if (!selectedId || !items.some((i) => i._id === selectedId)) {
      setSelectedId(items[0]._id)
    }
  }, [items, selectedId])

  if (items.length === 0) {
    return (
      <div className="wheel-empty">
        <p>Nothing waiting.</p>
        <p className="muted">
          Every drafted variant has been decided. New drafts appear here on their own.
        </p>
      </div>
    )
  }

  const selected = items.find((i) => i._id === selectedId) ?? items[0]

  return (
    <div className="desk-split">
      <nav className="rail" aria-label="Posts awaiting a decision">
        <p className="rail-head">
          {items.length} post{items.length === 1 ? '' : 's'} waiting
        </p>
        <ul>
          {items.map((item) => (
            <li key={item._id}>
              <button
                type="button"
                className={`rail-item${item._id === selected._id ? ' is-active' : ''}`}
                onClick={() => setSelectedId(item._id)}
                aria-current={item._id === selected._id}
              >
                <span className="rail-title">{item.title || 'Untitled post'}</span>
                <span className="rail-meta">
                  {(item.platforms ?? [])
                    .filter(Boolean)
                    .map((p) => PLATFORMS[p as keyof typeof PLATFORMS]?.label ?? p)
                    .join(' · ') || 'no platform'}
                  {item.generated && <span className="rail-dot" title="drafted by the agent" />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="stage">
        <Suspense key={selected._id} fallback={<Loading label="Opening the post" />}>
          <Wheel
            handle={{documentId: selected._id, documentType: 'post'}}
            accounts={accounts}
          />
        </Suspense>
      </div>
    </div>
  )
}
