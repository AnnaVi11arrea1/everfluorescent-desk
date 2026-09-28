import {getPlatform} from './vendor/platformSpec'
import {type PreflightResult} from './vendor/preflight'
import {fileUrl, imageUrl} from './lib/assets'
import {type ProjectedVariant} from './Wheel'

/**
 * One spoke: what a single platform will publish, and whether the gate will let
 * it. No data hooks — the wheel reads the post once and hands each spoke its
 * slice, so a post with four variants is still one request.
 */
export function SpokeCard({
  variant,
  result,
  onApprove,
  onReject,
  onReview,
}: {
  variant: ProjectedVariant
  result: PreflightResult
  onApprove: () => void
  onReject: () => void
  onReview: () => void
}) {
  const spec = getPlatform(variant.platform)
  const accent = spec?.accent ?? 'var(--accent)'
  const max = spec?.caption.max ?? 0
  const recommended = spec?.caption.recommended ?? 0
  const length = result.captionLength

  const over = max > 0 && length > max
  const chatty = !over && recommended > 0 && length > recommended

  const cover = variant.assets?.[0]
  const coverIsVideo =
    Boolean((cover?.meta as {mimeType?: string} | undefined)?.mimeType?.startsWith('video/')) ||
    cover?._type === 'file'
  const thumb = coverIsVideo
    ? null
    : imageUrl(cover?.ref, {w: 320, h: 320, fit: 'crop', auto: 'format'})
  const video = coverIsVideo ? fileUrl(cover?.ref) : null

  return (
    <div className={`preview${result.ok ? ' is-ready' : ' is-blocked'}`}>
      <div className="spoke-label">
        <span className="pdot" style={{background: accent, boxShadow: `0 0 0 3px ${accent}33`}} />
        <span className="pname">{spec?.label ?? 'Unknown platform'}</span>
        <span className="edited">{result.format?.label ?? variant.format ?? 'no format'}</span>
      </div>

      <div className="preview-media">
        {thumb && <img src={thumb} alt="" loading="lazy" />}
        {video && <span className="preview-none">video</span>}
        {!thumb && !video && <span className="preview-none">no asset</span>}
      </div>

      <div className="preview-body">
        <p className="preview-caption">
          {variant.caption || <em>No caption written yet.</em>}
        </p>

        <div className="spoke-meta">
          {result.errors.slice(0, 2).map((issue, i) => (
            <span key={`e${i}`} className="issue error" title={issue.message}>
              {issue.message}
            </span>
          ))}
          {result.errors.length === 0 &&
            result.warnings.slice(0, 1).map((issue, i) => (
              <span key={`w${i}`} className="issue warn" title={issue.message}>
                {issue.message}
              </span>
            ))}
          {/* Reads its ceiling from the same platformSpec the Studio's preview
              pane uses, so this number and the one beside the form agree. */}
          <span className={`count${over ? ' over' : chatty ? ' chatty' : ''}`}>
            {length}
            {max ? `/${max}` : ''} · {result.hashtagCount}#
          </span>
        </div>
      </div>

      <div className="spoke-actions">
        <button
          type="button"
          className="btn send"
          onClick={onApprove}
          disabled={!result.ok}
          title={result.ok ? 'Set this variant to approved' : result.errors[0]?.message}
        >
          Approve
        </button>
        {variant.status === 'draft' ? (
          <button type="button" className="btn ghost" onClick={onReview}>
            Mark for review
          </button>
        ) : (
          <button type="button" className="btn ghost" onClick={onReject}>
            Back to draft
          </button>
        )}
      </div>
    </div>
  )
}
