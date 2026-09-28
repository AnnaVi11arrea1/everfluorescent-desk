import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react'

/**
 * The wheel's geometry, ported from Full-Send's `layout()`.
 *
 * Spokes orbit the hub on an ellipse. The horizontal radius is whatever the
 * container allows; the vertical one is *solved* rather than chosen — it is the
 * smallest `ry` at which no card overlaps the hub or another card. That is why a
 * two-spoke wheel sits tight and an eight-spoke one opens up, without any
 * per-count tuning.
 *
 * Below the width a wheel geometrically fits in, or above eight spokes, there is
 * no ellipse worth drawing and the layout falls back to a stacked spine (CSS, see
 * .wheel:not(.radial)).
 */

/**
 * The narrowest container a four-spoke wheel fits in, derived rather than picked.
 *
 * The cards at 3 and 9 o'clock sit at sin(angle) = 0, so they can only clear the
 * hub HORIZONTALLY — raising ry cannot help them, because that branch of the
 * solver requires s > 0.01. So rx must be at least hubW/2 + cardW/2 + gap, and rx
 * is W/2 - cardW/2 - 12:
 *
 *   rx  ≥ 160 + 130 + 24 = 314      (hub 320 wide, spoke 260 wide, gap 24)
 *   W   ≥ 2 × (314 + 130 + 12) = 912
 *
 * Full-Send uses 1000px, which is right for a page that owns the window. Here the
 * container is a panel inside the Sanity Dashboard, so every pixel spent on the
 * queue rail comes off this budget — hence measuring the real container and using
 * the real floor instead of a round number.
 */
const RADIAL_MIN_WIDTH = 920
const MAX_SPOKES = 8
const GAP = 24
const MAX_RX = 560
const MAX_RY = 1400
/** How much wider than tall the ellipse may get before it stops reading as a wheel. */
const MAX_ASPECT = 1.35

export interface Point {
  x: number
  y: number
}

export interface Geometry {
  height: number
  cx: number
  cy: number
  width: number
  points: Point[]
}

export function useRadialLayout(count: number) {
  const wheelRef = useRef<HTMLDivElement | null>(null)
  const hubRef = useRef<HTMLDivElement | null>(null)
  const spokeRefs = useRef<(HTMLElement | null)[]>([])

  /**
   * Measured from the wheel's PARENT, not from the viewport.
   *
   * Full-Send decides this with matchMedia, which is right for a page that owns
   * the window. This app renders inside a panel in the Sanity Dashboard, where
   * the viewport can be 1600px while the space available is 900px — so a viewport
   * query would promise room that is not there. The parent is measured rather
   * than the wheel itself because `.wheel`'s own max-width changes with the
   * radial class, which would make the measurement depend on its own outcome.
   */
  const [available, setAvailable] = useState(0)

  useEffect(() => {
    const parent = wheelRef.current?.parentElement
    if (!parent) return

    const read = () => setAvailable(parent.clientWidth)
    read()

    const observer = new ResizeObserver(read)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])

  const wide = available >= RADIAL_MIN_WIDTH

  /**
   * Decided at render time, not from a measurement, and this matters: in radial
   * mode CSS pins each spoke to a fixed width, which changes its height. Measure
   * before the class is on and every height is the stacked-layout one, so the
   * ellipse comes out wrong. So the class goes on first, then we measure.
   */
  const radial = wide && count > 0 && count <= MAX_SPOKES

  const [geometry, setGeometry] = useState<Geometry | null>(null)

  const measure = useCallback(() => {
    const wheel = wheelRef.current
    const hub = hubRef.current
    const cards = spokeRefs.current.slice(0, count).filter(Boolean) as HTMLElement[]

    if (!radial || !wheel || !hub || cards.length !== count || count === 0) {
      setGeometry(null)
      return
    }

    const W = wheel.clientWidth
    const hubW = hub.offsetWidth
    const hubH = hub.offsetHeight
    const cardW = cards[0].offsetWidth
    const hs = cards.map((c) => c.offsetHeight)
    const maxH = Math.max(...hs)
    const n = cards.length

    // Twelve o'clock, then evenly round.
    const angles = cards.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / n)

    /**
     * The smallest vertical radius at which nothing overlaps, for a given
     * horizontal one. Every card must clear the hub, and every pair of cards must
     * clear each other.
     */
    const solveRy = (rx: number) => {
      let ry = hubH / 2 + maxH / 2 + GAP

      angles.forEach((a, i) => {
        const s = Math.abs(Math.sin(a))
        // A card whose horizontal offset does not clear the hub has to clear it
        // vertically instead.
        if (Math.abs(Math.cos(a)) * rx < hubW / 2 + cardW / 2 + GAP && s > 0.01) {
          ry = Math.max(ry, (hubH / 2 + hs[i] / 2 + GAP) / s)
        }
        for (let j = i + 1; j < n; j++) {
          const dx = Math.abs(Math.cos(a) - Math.cos(angles[j])) * rx
          const ds = Math.abs(Math.sin(a) - Math.sin(angles[j]))
          if (dx < cardW + GAP && ds > 0.01) {
            ry = Math.max(ry, ((hs[i] + hs[j]) / 2 + GAP) / ds)
          }
        }
      })

      return Math.min(ry, MAX_RY)
    }

    let rx = Math.min(W / 2 - cardW / 2 - 12, MAX_RX)
    let ry = solveRy(rx)

    /**
     * Keep it reading as a wheel rather than a flat oval.
     *
     * On a wide panel rx runs to its ceiling while ry stays near the hub's own
     * height, which stretches the ellipse until the cards look like a row with
     * something in the middle. Pulling rx in and SOLVING AGAIN is what keeps it
     * safe: narrowing rx can introduce horizontal collisions, so the final ry has
     * to be solved against the final rx, never carried over from the wider one.
     */
    if (rx > ry * MAX_ASPECT) {
      rx = Math.max(ry * MAX_ASPECT, hubW / 2 + cardW / 2 + GAP)
      ry = solveRy(rx)
    }

    const height = Math.round(2 * ry + maxH + 32)
    const cx = W / 2
    const cy = height / 2

    setGeometry({
      height,
      cx,
      cy,
      width: W,
      points: angles.map((a) => ({
        x: cx + rx * Math.cos(a),
        y: cy + ry * Math.sin(a),
      })),
    })
  }, [count, radial])

  // Before paint, so cards are never seen at the wrong coordinates.
  useLayoutEffect(measure, [measure])

  useEffect(() => {
    if (!radial) return

    // Card heights change with their own content — a longer caption, an extra
    // issue — so watching the container alone is not enough.
    const observer = new ResizeObserver(() => measure())
    if (wheelRef.current) observer.observe(wheelRef.current)
    if (hubRef.current) observer.observe(hubRef.current)
    for (const el of spokeRefs.current) if (el) observer.observe(el)

    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure, radial, count])

  const setSpokeRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      spokeRefs.current[index] = el
    },
    [],
  )

  return {wheelRef, hubRef, setSpokeRef, radial, geometry}
}
