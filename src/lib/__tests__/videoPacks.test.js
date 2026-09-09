import { describe, it, expect, beforeEach } from 'vitest'
import {
  ALL_VIDEOS,
  WIDGET_VIDEO_MAP,
  initializeSessionVideoAssignments,
  getWidgetVideo,
} from '../videoPacks'

describe('videoPacks', () => {
  beforeEach(() => {
    initializeSessionVideoAssignments()
  })

  it('contains 12 video assets in ALL_VIDEOS', () => {
    expect(ALL_VIDEOS).toHaveLength(12)
    const uniqueVideos = new Set(ALL_VIDEOS)
    expect(uniqueVideos.size).toBe(12)
  })

  it('assigns strictly unique videos across all standard dock widgets', () => {
    const widgetIds = Object.keys(WIDGET_VIDEO_MAP)
    expect(widgetIds.length).toBeGreaterThanOrEqual(8)

    const assigned = widgetIds.map((id) => getWidgetVideo(id))
    const uniqueAssigned = new Set(assigned)

    // No two widgets can ever share the same background video
    expect(uniqueAssigned.size).toBe(widgetIds.length)
    expect(assigned.every(Boolean)).toBe(true)
  })

  it('returns stable/fixed video assignments across multiple calls in the same session', () => {
    const widgetIds = Object.keys(WIDGET_VIDEO_MAP)
    const firstRun = widgetIds.map((id) => getWidgetVideo(id))
    const secondRun = widgetIds.map((id) => getWidgetVideo(id))

    expect(firstRun).toEqual(secondRun)
  })

  it('rerolls assignments with reroll=true while still preserving strict uniqueness', () => {
    const widgetIds = Object.keys(WIDGET_VIDEO_MAP)
    // Reroll first widget
    getWidgetVideo(widgetIds[0], true)

    const rerolled = widgetIds.map((id) => getWidgetVideo(id))
    const uniqueRerolled = new Set(rerolled)

    expect(uniqueRerolled.size).toBe(widgetIds.length)
  })

  it('handles unknown widget ids by allocating from remaining unclaimed videos', () => {
    const customWidget1 = 'custom_widget_1'
    const customWidget2 = 'custom_widget_2'

    const v1 = getWidgetVideo(customWidget1)
    const v2 = getWidgetVideo(customWidget2)

    expect(v1).toBeTruthy()
    expect(v2).toBeTruthy()
    expect(v1).not.toBe(v2)
  })
})
