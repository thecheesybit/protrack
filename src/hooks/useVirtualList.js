import { useState, useEffect, useMemo } from 'react'

/**
 * Lightweight, zero-dependency virtual list hook for smooth scrolling over long lists.
 * Bypasses virtualization when total items are below `threshold` (default: 20) for zero overhead.
 *
 * @param {Object} options
 * @param {Array} options.items - Array of items to virtualize
 * @param {number} options.itemHeight - Approximate height per row in pixels (including gap/margin)
 * @param {number} [options.overscan=4] - Number of items to render above/below the viewport
 * @param {React.RefObject} options.containerRef - Ref pointing to the scrollable container DOM element
 * @param {number} [options.threshold=20] - Minimum items required to activate virtualization
 * @returns {{ isVirtualized: boolean, virtualItems: Array<{ index: number, item: any, offsetTop: number }>, totalHeight: number|string }}
 */
export function useVirtualList({
  items = [],
  itemHeight = 48,
  overscan = 4,
  containerRef,
  threshold = 20,
}) {
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(300)

  const isVirtualized = items.length > threshold

  useEffect(() => {
    if (!isVirtualized) return

    const el = containerRef?.current
    if (!el) return

    const handleScroll = () => {
      setScrollTop(el.scrollTop)
    }

    // Capture initial dimensions
    setScrollTop(el.scrollTop)
    if (el.clientHeight > 0) {
      setViewportHeight(el.clientHeight)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })

    let resizeObserver = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(([entry]) => {
        if (entry?.contentRect?.height) {
          setViewportHeight(entry.contentRect.height)
        }
      })
      resizeObserver.observe(el)
    }

    return () => {
      el.removeEventListener('scroll', handleScroll)
      if (resizeObserver) resizeObserver.disconnect()
    }
  }, [containerRef, isVirtualized])

  const totalHeight = isVirtualized ? items.length * itemHeight : 'auto'

  const virtualItems = useMemo(() => {
    if (!isVirtualized) {
      return items.map((item, index) => ({
        index,
        item,
        offsetTop: 0,
      }))
    }

    const totalCount = items.length
    if (totalCount === 0) return []

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(totalCount - 1, Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan)

    const visible = []
    for (let i = startIndex; i <= endIndex; i++) {
      if (items[i] !== undefined) {
        visible.push({
          index: i,
          item: items[i],
          offsetTop: i * itemHeight,
        })
      }
    }
    return visible
  }, [items, isVirtualized, scrollTop, viewportHeight, itemHeight, overscan])

  return {
    isVirtualized,
    virtualItems,
    totalHeight,
  }
}
