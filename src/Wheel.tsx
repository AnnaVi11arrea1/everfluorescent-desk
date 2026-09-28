import {
  useDocumentProjection,
  useEditDocument,
  type DocumentHandle,
} from '@sanity/sdk-react'
import {type Account} from './Desk'
import {HubCard} from './HubCard'
import {SpokeCard} from './SpokeCard'
import {useRadialLayout} from './useRadialLayout'
import {preflight, type PreflightResult} from './vendor/preflight'
import {assetInfo} from './lib/assets'

/** Nobody has decided yet — the pair the Studio's own button treats as candidates. */
export const AWAITING = ['draft', 'needs_review']

/**
 * The asset metadata the gate needs lives on the asset document, not on the
 * reference, so this dereferences it. Products too: the gate reads `incomplete`,
 * which the catalog sync writes when the store left a field empty.
 */
const PROJECTION = `{
  title,
  hook,
  body,
  cta,
  link,
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

export interface ProjectedVariant {
  _key?: string
  platform?: string
  format?: string
  caption?: string
  status?: string
  scheduledAt?: string
  permalink?: string
  assets?: {_key?: string; _type?: string; ref?: string; meta?: Record<string, unknown>}[]
}

export interface ProjectedPost {
  title?: string
  hook?: string
  body?: string
  cta?: string
  link?: string
  generatedAt?: string
  campaign?: string
  knowledgeUsed?: {title?: string; kind?: string}[]
  products?: {title?: string; storeId?: number; incomplete?: string[]; storeStatus?: string}[]
  variants?: ProjectedVariant[]
}

/**
 * One post as a wheel: the idea at the hub, each platform's rendering orbiting
 * it, dashed lines showing what belongs to what.
 *
 * The shape is borrowed from Full-Send, where a plan sits at the centre of its
 * publication channels. It transfers because the data is the same shape — one
 * core message, many per-platform renderings of it — and a decision UI wants one
 * post at a time rather than a wall of cards.
 */
export function Wheel({handle, accounts}: {handle: DocumentHandle; accounts: Account[]}) {
  const {data} = useDocumentProjection<ProjectedPost>({...handle, projection: PROJECTION})

  /**
   * No `path`, and a functional update. The projection above selects only some of
   * each variant's fields, so writing that array back would drop the rest — the
   * assets, most destructively. A functional update receives the CURRENT document
   * from the store rather than anything this component read, so the array being
   * mapped is the real one and only `status` changes.
   */
  const editPost = useEditDocument(handle)

  const doc = data ?? {}
  const products = (doc.products ?? []).filter(Boolean)

  const awaiting = (doc.variants ?? []).filter(
    (v) => v?._key && AWAITING.includes(v.status ?? 'draft'),
  )

  const {wheelRef, hubRef, setSpokeRef, radial, geometry} = useRadialLayout(awaiting.length)

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

  if (awaiting.length === 0) {
    return (
      <div className="wheel-empty">
        <p>Every variant on this post has been decided.</p>
        <p className="muted">Pick another from the queue.</p>
      </div>
    )
  }

  const positioned = radial && geometry

  return (
    <div
      ref={wheelRef}
      className={`wheel${positioned ? ' radial' : ''}`}
      style={positioned ? {height: geometry.height} : undefined}
    >
      {positioned && (
        <svg
          className="links"
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          width={geometry.width}
          height={geometry.height}
          aria-hidden="true"
        >
          {geometry.points.map((p, i) => (
            <path
              key={i}
              className="link"
              d={`M${geometry.cx} ${geometry.cy} L${p.x} ${p.y}`}
            />
          ))}
        </svg>
      )}

      <div
        ref={hubRef}
        className="hub"
        style={positioned ? {left: geometry.cx, top: geometry.cy} : undefined}
      >
        <HubCard post={doc} />
      </div>

      <div className="spokes">
        {awaiting.map((variant, i) => {
          const account = accounts.find((a) => a.platform === variant.platform) ?? null

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

          const point = geometry?.points[i]

          return (
            <div
              key={variant._key}
              ref={setSpokeRef(i)}
              className="spoke"
              style={positioned && point ? {left: point.x, top: point.y} : undefined}
            >
              <SpokeCard
                variant={variant}
                result={result}
                onApprove={() => setStatus(variant._key!, 'approved')}
                onReject={() => setStatus(variant._key!, 'draft')}
                onReview={() => setStatus(variant._key!, 'needs_review')}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
