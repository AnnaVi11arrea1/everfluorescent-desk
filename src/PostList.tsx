import {useDocuments, type DocumentHandle} from '@sanity/sdk-react'
import {Suspense} from 'react'
import {type Account} from './Desk'
import {PostCard} from './PostCard'

/**
 * Every post, newest edit first, as document handles.
 *
 * The handles come back without content — each PostCard reads its own fields
 * through a projection inside its own Suspense boundary, so one slow post does
 * not hold up the rest of the queue, and each card stays live independently.
 *
 * A post with nothing awaiting review renders nothing. That means the filtering
 * happens a level down, in the card, rather than here: whether a post belongs in
 * the queue depends on its variants' statuses, which is exactly what the card
 * has already fetched. Asking for it twice to decide up front would be a second
 * read of the same data.
 */
export function PostList({
  accounts,
  platformFilter,
}: {
  accounts: Account[]
  platformFilter: string
}) {
  const {data, hasMore, isPending, loadMore} = useDocuments({
    documentType: 'post',
    batchSize: 25,
    orderings: [{field: '_updatedAt', direction: 'desc'}],
  })

  const handles = (data ?? []) as DocumentHandle[]

  if (handles.length === 0) {
    return (
      <p className="desk-empty">
        No posts in this dataset yet. When the agent drafts one it will appear here on its own.
      </p>
    )
  }

  return (
    <>
      <div className="desk-grid">
        {handles.map((handle) => (
          <Suspense key={handle.documentId} fallback={<div className="card card--skeleton" />}>
            <PostCard handle={handle} accounts={accounts} platformFilter={platformFilter} />
          </Suspense>
        ))}
      </div>

      {hasMore && (
        <div className="desk-more">
          <button type="button" className="btn" onClick={() => loadMore()} disabled={isPending}>
            {isPending ? 'Loading…' : 'Load older posts'}
          </button>
        </div>
      )}
    </>
  )
}
