import { describe, it, expect, vi } from 'vitest'
import { getWidgetComponent } from '../widgetComponents'

describe('WidgetErrorBoundary & getWidgetComponent', () => {
  it('returns wrapped component for valid widget id', () => {
    const Component = getWidgetComponent('todos')
    expect(Component).toBeDefined()
    expect(typeof Component).toBe('function')
  })

  it('returns undefined for invalid widget id', () => {
    const Component = getWidgetComponent('nonexistent_widget')
    expect(Component).toBeUndefined()
  })
})
