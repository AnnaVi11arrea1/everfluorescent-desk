import {useQuery} from '@sanity/sdk-react'
import {Suspense, useEffect, useState} from 'react'
import {Loading} from './App'
import {type Account} from './Desk'
import {Wheel} from './Wheel'

/**
 * The queue: one selector, and the chosen post as a wheel.
 *
 * The list is one GROQ query rather than handles plus projections, and that is
 * the right tool here — it needs one aggregate fact per post (how many variants
 * are still waiting) across every post, which is a query, not a per-document
 * read. The wheel then reads the selected post properly, through its own handle.
 *
 * A dropdown rather than a list down the side or a strip along the top. A sidebar
 * costs 250px, and the wheel needs 920px of container before it can exist at all,
 * so the rail was quietly buying itself space with the thing it exists to help you
 * look at. A strip on top gave that width back but turned ten posts into a long
 * horizontal scroll. A select costs one line and no width.
 */
const QUEUE_QUERY = `
*[_type == "post" && count(variants[status in ["draft", "needs_review"]]) > 0]
  | order(_updatedAt desc) [0...100] {
    _id,
    title,
    "generated": defined(generatedAt),
    "awaiting": count(variants[status in ["draft", "needs_review"]])
  }
`

interface QueueItem {
  _id: string
  title?: string
  generated?: boolean
  awaiting?: number
}

export function Queue({accounts}: {accounts: Account[]}) {
  const {data} = useQuery<QueueItem[]>({query: QUEUE_QUERY})
  const items = data ?? []

  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Follow the queue. If nothing is chosen, or the chosen post has just had its
  // last variant decided and dropped out of the list, move to whatever is now at
  // the top. That is what makes "decide, next" work without a Next button being
  // the only way through.
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

  const index = Math.max(
    0,
    items.findIndex((i) => i._id === selectedId),
  )
  const selected = items[index]

  const step = (by: number) => {
    const next = items[index + by]
    if (next) setSelectedId(next._id)
  }

  return (
    <>
      <div className="queue-bar">
        <label className="queue-label" htmlFor="queue-select">
          Reviewing
        </label>

        <div className="queue-picker">
          <button
            type="button"
            className="step"
            onClick={() => step(-1)}
            disabled={index === 0}
            aria-label="Previous post"
          >
            ‹
          </button>

          <select
            id="queue-select"
            className="queue-select"
            value={selected._id}
            onChange={(e) => setSelectedId(e.currentTarget.value)}
          >
            {items.map((item) => (
              <option key={item._id} value={item._id}>
                {item.title || 'Untitled post'}
                {item.generated ? ' · agent' : ''}
                {` · ${item.awaiting} waiting`}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="step"
            onClick={() => step(1)}
            disabled={index >= items.length - 1}
            aria-label="Next post"
          >
            ›
          </button>
        </div>

        <p className="queue-count">
          {index + 1} of {items.length} waiting
        </p>
      </div>

      <div className="stage">
        <Suspense key={selected._id} fallback={<Loading label="Opening the post" />}>
          <Wheel
            handle={{documentId: selected._id, documentType: 'post'}}
            accounts={accounts}
          />
        </Suspense>
      </div>
    </>
  )
}
