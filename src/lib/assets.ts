/**
 * Sanity asset references carry everything a URL needs, so nothing has to be
 * fetched to build one:
 *
 *   image-ab12…-1080x1350-jpg → …/images/<project>/<dataset>/ab12…-1080x1350.jpg
 *   file-ab12…-mp4            → …/files/<project>/<dataset>/ab12….mp4
 *
 * A reference that does not parse returns null rather than a broken URL, because
 * a card showing a missing image is better than one showing a 404.
 */
const PROJECT_ID = '70komvgl'
const DATASET = 'production'

export function imageUrl(ref?: string, params?: Record<string, string | number>): string | null {
  if (!ref) return null
  const parts = ref.split('-')
  if (parts[0] !== 'image' || parts.length !== 4) return null
  const [, id, dimensions, ext] = parts
  const url = `https://cdn.sanity.io/images/${PROJECT_ID}/${DATASET}/${id}-${dimensions}.${ext}`
  if (!params) return url
  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString()
  return `${url}?${query}`
}

export function fileUrl(ref?: string): string | null {
  if (!ref) return null
  const parts = ref.split('-')
  if (parts[0] !== 'file' || parts.length !== 3) return null
  const [, id, ext] = parts
  return `https://cdn.sanity.io/files/${PROJECT_ID}/${DATASET}/${id}.${ext}`
}

interface RawAsset {
  _type?: string
  ref?: string
  meta?: Record<string, unknown>
}

/**
 * Shapes one projected asset the way preflight expects it.
 *
 * `durationSeconds` is deliberately left undefined rather than set to 0: the gate
 * treats an unknown duration as "not checked, and said so" instead of "fine".
 * Nothing here can measure a clip — Sanity stores no duration in asset metadata —
 * so a video's length is checked by whoever opens it in the Studio, where the
 * browser loads the file and measures it.
 */
export function assetInfo(asset: RawAsset) {
  const meta = (asset?.meta ?? {}) as {
    mimeType?: string
    originalFilename?: string
    metadata?: {dimensions?: {width?: number; height?: number}}
  }
  const mimeType = meta.mimeType
  return {
    id: asset?.ref,
    filename: meta.originalFilename,
    mimeType,
    width: meta.metadata?.dimensions?.width,
    height: meta.metadata?.dimensions?.height,
    isVideo: Boolean(mimeType?.startsWith('video/')) || asset?._type === 'file',
    durationSeconds: undefined,
  }
}
