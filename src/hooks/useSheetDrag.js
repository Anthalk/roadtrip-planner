import { useRef, useState, useCallback } from 'react'

/**
 * Hook pour un bottom sheet qui suit le doigt.
 *
 * @param {object} options
 * @param {string} options.expandedHeight  - hauteur expanded ex: '50vh'
 * @param {string} options.collapsedHeight - hauteur collapsed ex: '14vh'
 * @param {boolean} options.initialExpanded
 *
 * @returns {object} { sheetExpanded, sheetStyle, handleProps, setSheetExpanded }
 */
export function useSheetDrag({ expandedHeight, collapsedHeight, initialExpanded = true }) {
  const [sheetExpanded, setSheetExpanded] = useState(initialExpanded)
  const [dragging, setDragging] = useState(false)
  const [dragDelta, setDragDelta] = useState(0)

  const touchStartY = useRef(null)
  const touchStartTime = useRef(null)
  const lastY = useRef(null)
  const velocityY = useRef(0)

  const onTouchStart = useCallback((e) => {
    const y = e.touches[0].clientY
    touchStartY.current = y
    touchStartTime.current = Date.now()
    lastY.current = y
    velocityY.current = 0
    setDragging(true)
    setDragDelta(0)
  }, [])

  const onTouchMove = useCallback((e) => {
    if (touchStartY.current === null) return
    const y = e.touches[0].clientY
    const delta = y - touchStartY.current
    const dt = Date.now() - touchStartTime.current
    velocityY.current = (y - lastY.current) / Math.max(dt, 1) * 16
    lastY.current = y
    touchStartTime.current = Date.now()
    setDragDelta(delta)
  }, [])

  const onTouchEnd = useCallback((e) => {
    if (touchStartY.current === null) return
    const endY = e.changedTouches[0].clientY
    const delta = endY - touchStartY.current
    const elapsed = Date.now() - touchStartTime.current
    const isTap = Math.abs(delta) < 8 && elapsed < 200

    if (isTap) {
      // Toggle sur tap court
      setSheetExpanded(prev => !prev)
    } else if (Math.abs(velocityY.current) > 0.3) {
      // Snap selon vélocité
      setSheetExpanded(velocityY.current < 0)
    } else {
      // Snap selon position
      setSheetExpanded(delta < 0 || (sheetExpanded && delta < 60))
    }

    touchStartY.current = null
    setDragging(false)
    setDragDelta(0)
  }, [sheetExpanded])

  // Calcul du translateY pendant le drag
  const getTranslateY = () => {
    if (!dragging || dragDelta === 0) return 0
    // Résistance : on amortit le drag au-delà de la direction naturelle
    if (sheetExpanded && dragDelta < 0) return dragDelta * 0.3  // résistance vers haut si déjà expanded
    if (!sheetExpanded && dragDelta > 0) return dragDelta * 0.3 // résistance vers bas si déjà collapsed
    return dragDelta * 0.7 // drag naturel
  }

  const translateY = getTranslateY()
  const isTransitioning = !dragging

  const sheetStyle = {
    height: sheetExpanded ? expandedHeight : collapsedHeight,
    transform: `translateY(${translateY}px)`,
    transition: isTransitioning
      ? 'height 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1)'
      : 'none',
    overflow: 'hidden',
    flexShrink: 0,
  }

  const handleProps = {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    style: { touchAction: 'none' },
  }

  return { sheetExpanded, setSheetExpanded, sheetStyle, handleProps, dragging }
}
