import {
  useDocumentProjection,
  useEditDocument,
  type DocumentHandle,
} from '@sanity/sdk-react'
import {type Account} from './Desk'
import {VariantCard} from './VariantCard'
import {preflight, type PreflightResult} from './vendor/preflight'
import {assetInfo} from './lib/assets'

/** Statuses that mean nobody has decided yet — the pair the Studio's own button treats as candidates. */
const AWAITING = ['draft', 'needs_review']

/**
 * The asset metadata preflight needs is on the asset DOCUMENT, not on the
 * reference, so the projection dereferences it. Same for products: the gate
 * reads `incomplete`, which the catalog sync writes when the store left a field
 * empty, and blocks any post about such a product.
 */
const PROJECTION = `{
  title,
  hook,
  generatedAt,
  "campaign": campaign->title,
  "knowledgeUsed": knowledgeUsed[]->{title, kind},
  "products": products[]->{title, storeId, incomplete, storeStatus},
  "variants": variants[]{
    _key, platform, format, caption, status, scheduledAt, permalink,
    "assets": assets[]{
      _key, _type,
      "ref": asset._ref,
      "meta": asset->{mimeType, originalFilename, metadata{dimensions}}
    }
  }
}`

interface ProjectedVariant {
  _key?: string
  platform?: string
  format?: string
  caption?: string
  status?: string
  scheduledAt?: string
  permalink?: string
  assets?: {_key?: string; _type?: string; ref?: string; meta?: Record<string, unknown>}[]
}

interface Projected {
  title?: string
  hook?: string
  generatedAt?: string
  campaign?: string
  knowledgeUsed?: {title?: string; kind?: string}[]
  products?: {title?: string; storeId?: number; incomplete?: string[]; storeStatus?: string}[]
  variants?: ProjectedVariant[]
}

export function PostCard({
  handle,
  accounts,
  platformFilter,
}: {
  handle: DocumentHandle
  accounts: Account[]
  platformFilter: string
}) {
  const {data} = useDocumentProjection<Projected>({...handle, projection: PROJECTION})

  /**
   * Writing without a `path`, using a functional update.
   *
   * This matters more than it looks. The projection above selects only some of
   * each variant's fields, so writing that array back would drop the ones it did
   * not ask for — the assets, most destructively. A functional update receives
   * the CURRENT document from the store rather than anything this component
   * read, so the array being mapped over is the real one and only `status`
   * changes.
   */
  const editPost = useEditDocument(handle)

  const doc = data ?? {}
  const products = (doc.products ?? []).filter(Boolean)

  const awaiting = (doc.variants ?? []).filter(
    (v) =>
      v?._key &&
      AWAITING.includes(v.status ?? 'draft') &&
      (platformFilter === 'all' || v.platform === platformFilter),
  )

  // A post with nothing to decide is not part of the queue.
  if (awaiting.length === 0) return null

  function setStatus(variantKey: string, status: string) {
    editPost((current) => {
      const list = Array.isArray(current.variants)
        ? (current.variants as Record<string, unknown>[])
        : []
      return {
        ...current,
        variants: list.map((v) => (v?._key === variantKey ? {...v, status} : v)),
      }
    })
  }

  const blockingProducts = products.filter((p) => (p.incomplete ?? []).length > 0)

  return (
    <article className="card">
      <header className="card__head">
        <div className="card__titles">
          <h2 className="card__title">{doc.title || 'Untitled post'}</h2>
          {doc.hook && <p className="card__hook">{doc.hook}</p>}
        </div>
        <div className="card__badges">
          {doc.campaign && <span className="tag">{doc.campaign}</span>}
          {doc.generatedAt && <span className="tag tag--agent">agent</span>}
        </div>
      </header>

      <div className="card__meta">
        {products.length > 0 && (
          <span>
            {products.length === 1 ? 'Product: ' : 'Products: '}
            {products.map((p) => p.title || 'untitled').join(', ')}
          </span>
        )}
        {/*
          The field the schema describes as "filled in by the generator so you can
          see what it drew on". Saying it is empty is more useful than hiding it:
          a drafted post with no cited notes is a post written from nothing but a
          product title.
        */}
        <span className={doc.knowledgeUsed?.length ? 'cited' : 'uncited'}>
          {doc.knowledgeUsed?.length
            ? `Drew on ${doc.knowledgeUsed.length} note${doc.knowledgeUsed.length === 1 ? '' : 's'}: ${doc.knowledgeUsed
                .map((n) => n.title || n.kind)
                .join(', ')}`
            : 'No knowledge notes cited'}
        </span>
      </div>

      {blockingProducts.length > 0 && (
        <p className="card__blocked">
          The store is missing something on{' '}
          {blockingProducts.map((p) => p.title || 'a product').join(', ')} — nothing about it can be
          queued until the next catalog sync clears it.
        </p>
      )}

      <div className="card__variants">
        {awaiting.map((variant) => {
          const account =
            accounts.find((a) => a.platform === variant.platform) ?? null

          const result: PreflightResult = preflight({
            platform: variant.platform,
            format: variant.format,
            caption: variant.caption ?? '',
            assets: (variant.assets ?? []).map(assetInfo),
            products: products.map((p) => ({
              title: p.title,
              incomplete: p.incomplete,
              storeStatus: p.storeStatus,
            })),
            accountConfigured: Boolean(account),
            accountAudited: account ? account.audited === true : false,
          })

          return (
            <VariantCard
              key={variant._key}
              variant={variant}
              result={result}
              onApprove={() => setStatus(variant._key!, 'approved')}
              onHold={() => setStatus(variant._key!, 'needs_review')}
              onReject={() => setStatus(variant._key!, 'draft')}
            />
          )
        })}
      </div>
    </article>
  )
}
