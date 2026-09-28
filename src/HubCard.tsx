import {type ProjectedPost} from './Wheel'

/**
 * The centre of the wheel: the one idea every spoke is a rendering of.
 *
 * Deliberately the core message and its sources, not a summary of the variants —
 * the spokes say what each platform will look like, so the hub's job is to say
 * what the post is actually about and what it was written from.
 */
export function HubCard({post}: {post: ProjectedPost}) {
  const products = (post.products ?? []).filter(Boolean)
  const cited = post.knowledgeUsed ?? []
  const blocking = products.filter((p) => (p.incomplete ?? []).length > 0)

  return (
    <div className="hub-card">
      <div className="hub-head">
        <span className="eyebrow">{post.campaign || 'No campaign'}</span>
        {post.generatedAt && <span className="pill pill--agent">agent</span>}
      </div>

      <h2 className="hub-title">{post.title || 'Untitled post'}</h2>

      {post.hook && <p className="hub-hook">{post.hook}</p>}
      {post.body && <p className="hub-body clamp">{post.body}</p>}

      {(post.cta || post.link) && (
        <p className="hub-cta">
          {post.cta}
          {post.link && (
            <>
              {post.cta ? ' · ' : ''}
              <span className="mono">{post.link.replace(/^https?:\/\//, '')}</span>
            </>
          )}
        </p>
      )}

      <dl className="hub-facts">
        {products.length > 0 && (
          <div>
            <dt>{products.length === 1 ? 'Product' : 'Products'}</dt>
            <dd>{products.map((p) => p.title || 'untitled').join(', ')}</dd>
          </div>
        )}
        <div>
          <dt>Drew on</dt>
          {/*
            The field the schema describes as "filled in by the generator so you
            can see what it drew on". Saying it is empty is more useful than
            hiding it: a drafted post citing nothing was written from a product
            title alone.
          */}
          <dd className={cited.length ? 'cited' : 'uncited'}>
            {cited.length
              ? cited.map((n) => n.title || n.kind).join(', ')
              : 'no knowledge notes'}
          </dd>
        </div>
      </dl>

      {blocking.length > 0 && (
        <p className="hub-blocked">
          The store is missing something on{' '}
          {blocking.map((p) => p.title || 'a product').join(', ')} — nothing about it can be
          queued until the next catalog sync clears it.
        </p>
      )}
    </div>
  )
}
