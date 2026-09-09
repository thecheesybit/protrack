import { describe, it, expect } from 'vitest'
import React from 'react'
import { MarkdownText } from '../markdown'

describe('MarkdownText parser and renderer', () => {
  it('returns null for empty or null content', () => {
    expect(MarkdownText({ content: '' })).toBeNull()
    expect(MarkdownText({ content: null })).toBeNull()
  })

  it('renders a react element structure for basic markdown', () => {
    const el = MarkdownText({
      content: '# Title\n- Item 1\n**Bold** and *italic* and `code` and [Docs](https://example.com) #exam',
    })
    expect(React.isValidElement(el)).toBe(true)
    expect(el.props.className).toContain('text-xs')
  })

  it('splits multiline content into children', () => {
    const el = MarkdownText({
      content: 'Line 1\nLine 2\nLine 3',
    })
    expect(Array.isArray(el.props.children)).toBe(true)
    expect(el.props.children.length).toBe(3)
  })

  it('handles heading tokens', () => {
    const el = MarkdownText({ content: '# Heading 1\n## Heading 2\n### Heading 3' })
    const children = el.props.children
    expect(children[0].type).toBe('h3')
    expect(children[1].type).toBe('h4')
    expect(children[2].type).toBe('h5')
  })

  it('handles bullet lists', () => {
    const el = MarkdownText({ content: '- Bullet item' })
    const children = el.props.children
    expect(children[0].type).toBe('div')
    expect(children[0].props.className).toContain('flex items-start')
  })
})
