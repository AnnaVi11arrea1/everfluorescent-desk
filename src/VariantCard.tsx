import {getPlatform} from './vendor/platformSpec'
import {type PreflightResult} from './vendor/preflight'
import {fileUrl, imageUrl} from './lib/assets'

interface Variant {
  _key?: string
  platform?: string
  format?: string
  caption?: string
  status?: string
  assets?: {_key?: string; _type?: string; ref?: string; meta?: Record<string, unknown>}[]
}

/**
 * One platform's rendering of the post, with the gate's verdict under it and the
 * buttons that move it.
 *
 * Presentational on purpose — no data hooks. The card is rendered once per
 * variant, and a fetching hook here would mean one request per variant rather
 * than one per post.
 */
export function VariantCard({
  variant,
  result,
  onApprove,
  onHold,
  onReject,
}: {
  variant: Variant
  result: PreflightResult
  onApprove: () => void
  onHold: () => void
  onReject: () => void
}) {
  const spec = getPlatform(variant.platform)
  const accent = spec?.accent ?? 'var(--desk-accent)'
  const max = spec?.caption.max ?? 0
  const recommended = spec?.caption.recommended ?? 0
  const length = result.captionLength

  const over = max > 0 && length > max
  const chatty = !over && recommended > 0 && length > recommended
  const ratio = max > 0 ? Math.min(length / max, 1) : 0

  const cover = variant.assets?.[0]
  const coverIsVideo =
    Boolean((cover?.meta as {mimeType?: string} | undefined)?.mimeType?.startsWith('video/')) ||
    cover?._type === 'file'
  const thumb = coverIsVideo ? null : imageUrl(cover?.ref, {w: 240, h: 240, fit: 'crop', auto: 'format'})
  const video = coverIsVideo ? fileUrl(cover?.ref) : null

  return (
    <section className={`variant${result.ok ? ' variant--ready' : ' variant--blocked'}`}>
      <header className="variant__head">
        <span className="variant__platform" style={{color: accent}}>
          <span className="variant__dot" style={{background: accent}} aria-hidden="true" />
          {spec?.label ?? 'Unknown platform'}
        </span>
        <span className="variant__format">{result.format?.label ?? variant.format ?? 'no format'}</span>
        <span className={`verdict${result.ok ? ' verdict--ok' : ' verdict--blocked'}`}>
          {result.ok ? 'Ready' : 'Blocked'}
        </span>
      </header>

      <div className="variant__body">
        <div className="variant__media">
          {thumb && <img src={thumb} alt="" loading="lazy" />}
          {video && <span className="variant__video">video</span>}
          {!thumb && !video && <span className="variant__video">no asset</span>}
        </div>

        <div className="variant__text">
          <p className="variant__caption">{variant.caption || <em>No caption written yet.</em>}</p>

          {/*
            The counter reads its ceiling from the same platformSpec the Studio's
            preview pane uses, so this number and the one beside the form agree.
          */}
          <div className="meter" title={`${length} of ${max} characters`}>
            <span className="meter__track">
              <span
                className={`meter__fill${over ? ' is-over' : chatty ? ' is-chatty' : ''}`}
                style={{width: `${Math.round(ratio * 100)}%`}}
              />
            </span>
            <span className="meter__label">
              {length}
              {max ? `/${max}` : ''} · {result.hashtagCount} hashtag
              {result.hashtagCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      {result.issues.length > 0 && (
        <ul className="issues">
          {result.issues.map((issue, i) => (
            <li key={`${issue.field}-${i}`} className={`issue issue--${issue.level}`}>
              <span className="issue__dot" aria-hidden="true" />
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      <footer className="variant__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={onApprove}
          disabled={!result.ok}
          title={result.ok ? 'Set this variant to approved' : result.errors[0]?.message}
        >
          Approve
        </button>
        {variant.status === 'draft' ? (
          <button type="button" className="btn" onClick={onHold}>
            Mark for review
          </button>
        ) : (
          <button type="button" className="btn" onClick={onReject}>
            Back to draft
          </button>
        )}
        <span className="variant__status">{(variant.status ?? 'draft').replace('_', ' ')}</span>
      </footer>
    </section>
  )
}
