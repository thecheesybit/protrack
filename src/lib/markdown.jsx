import React from 'react'
import { normalizeTag } from '@/lib/tags'
import { cn } from '@/utils/cn'

/**
 * Parses inline markdown tokens:
 * - Code: `code`
 * - Bold: **text** or __text__
 * - Italic: *text* or _text_
 * - Link: [label](url)
 * - Hashtag: #tag
 */
function parseInlineMarkdown(text, onTagClick, keyPrefix = 'inl') {
  if (!text) return null

  // Token pattern matching inline constructs
  // 1. code: `([^`]+)`
  // 2. bold: \*\*([^*]+)\*\* | __([^_]+)__
  // 3. italic: \*([^*]+)\* | _([^_]+)_
  // 4. link: \[([^\]]+)\]\(([^)]+)\)
  // 5. hashtag: (?:^|\s)#([\p{L}\p{N}][\p{L}\p{N}_-]*)
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\)|(?:^|\s)#[\p{L}\p{N}][\p{L}\p{N}_-]*)/gu

  const tokens = []
  let lastIndex = 0
  let match

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.substring(lastIndex, match.index))
    }

    const matchedStr = match[0]

    if (matchedStr.startsWith('`') && matchedStr.endsWith('`')) {
      // Inline code
      tokens.push(
        <code
          key={`${keyPrefix}-c-${match.index}`}
          className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px] text-accent border border-line/40"
        >
          {matchedStr.slice(1, -1)}
        </code>
      )
    } else if (
      (matchedStr.startsWith('**') && matchedStr.endsWith('**')) ||
      (matchedStr.startsWith('__') && matchedStr.endsWith('__'))
    ) {
      // Bold
      tokens.push(
        <strong key={`${keyPrefix}-b-${match.index}`} className="font-bold text-ink">
          {matchedStr.slice(2, -2)}
        </strong>
      )
    } else if (
      (matchedStr.startsWith('*') && matchedStr.endsWith('*')) ||
      (matchedStr.startsWith('_') && matchedStr.endsWith('_'))
    ) {
      // Italic
      tokens.push(
        <em key={`${keyPrefix}-i-${match.index}`} className="italic text-ink/90">
          {matchedStr.slice(1, -1)}
        </em>
      )
    } else if (matchedStr.startsWith('[')) {
      // Link [label](url)
      const linkMatch = matchedStr.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (linkMatch) {
        const [, label, url] = linkMatch
        const href = url.startsWith('http') ? url : `https://${url}`
        tokens.push(
          <a
            key={`${keyPrefix}-a-${match.index}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-accent underline underline-offset-2 hover:opacity-80 inline-flex items-center gap-0.5"
          >
            {label}
          </a>
        )
      } else {
        tokens.push(matchedStr)
      }
    } else if (matchedStr.includes('#')) {
      // Hashtag
      const leadingSpace = matchedStr.startsWith(' ') ? ' ' : ''
      const rawTag = matchedStr.trim()
      const cleanTag = normalizeTag(rawTag)
      tokens.push(
        <React.Fragment key={`${keyPrefix}-tag-${match.index}`}>
          {leadingSpace}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onTagClick?.(cleanTag)
            }}
            title={`Filter by #${cleanTag}`}
            className="inline-flex items-center rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent hover:bg-accent/25 transition-colors cursor-pointer"
          >
            #{cleanTag}
          </button>
        </React.Fragment>
      )
    } else {
      tokens.push(matchedStr)
    }

    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) {
    tokens.push(text.substring(lastIndex))
  }

  return tokens
}

/**
 * Lightweight, zero-dependency Markdown parser & renderer.
 * Safely renders headings, bullet lists, bold, italics, inline code, links, and hashtags.
 */
export function MarkdownText({ content, onTagClick, className }) {
  if (!content) return null

  const lines = content.split(/\r?\n/)

  return (
    <div className={cn('text-xs text-ink/90 leading-relaxed space-y-1', className)}>
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) {
          return <div key={idx} className="h-1" />
        }

        // Heading 1
        if (line.startsWith('# ')) {
          return (
            <h3 key={idx} className="text-sm font-bold text-ink pt-1 pb-0.5 border-b border-line/40">
              {parseInlineMarkdown(line.slice(2), onTagClick, `h1-${idx}`)}
            </h3>
          )
        }

        // Heading 2
        if (line.startsWith('## ')) {
          return (
            <h4 key={idx} className="text-xs font-bold text-ink pt-0.5">
              {parseInlineMarkdown(line.slice(3), onTagClick, `h2-${idx}`)}
            </h4>
          )
        }

        // Heading 3
        if (line.startsWith('### ')) {
          return (
            <h5 key={idx} className="text-xs font-semibold text-ink/80 pt-0.5">
              {parseInlineMarkdown(line.slice(4), onTagClick, `h3-${idx}`)}
            </h5>
          )
        }

        // Bullet list item
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1.5">
              <span className="text-accent text-[10px] leading-relaxed select-none">•</span>
              <span className="flex-1">
                {parseInlineMarkdown(line.slice(2), onTagClick, `li-${idx}`)}
              </span>
            </div>
          )
        }

        // Regular line
        return (
          <p key={idx} className="whitespace-pre-wrap">
            {parseInlineMarkdown(line, onTagClick, `p-${idx}`)}
          </p>
        )
      })}
    </div>
  )
}
