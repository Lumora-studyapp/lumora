import React from 'react'
import ImageAsset from './ImageAsset.jsx'

const UI_SYMBOLS = new Set(['〰', '↔', '↩', '⏸', '▶', '☀', '✉'])
const EMOJI_SEQUENCE = /(?:[#*0-9]\uFE0F?\u20E3|\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?)*)/gu

function emojiSlug(glyph) {
  return Array.from(glyph)
    .map(character => character.codePointAt(0).toString(16).toUpperCase())
    .filter(codepoint => codepoint !== 'FE0E' && codepoint !== 'FE0F')
    .join('-')
}

export function emojiAssetUrl(glyph) {
  const extension = UI_SYMBOLS.has(glyph) ? 'svg' : 'png'
  return `/Emojis/${emojiSlug(glyph)}.${extension}`
}

function renderTextWithEmoji(value) {
  const matches = Array.from(value.matchAll(EMOJI_SEQUENCE))
  if (!matches.length) return value

  const parts = []
  let cursor = 0
  for (const match of matches) {
    const glyph = match[0]
    const start = match.index
    if (start > cursor) parts.push(value.slice(cursor, start))
    parts.push(
      <ImageAsset
        key={`${start}-${emojiSlug(glyph)}`}
        className="lumora-emoji-image"
        src={emojiAssetUrl(glyph)}
        alt={glyph}
        draggable="false"
      />,
    )
    cursor = start + glyph.length
  }
  if (cursor < value.length) parts.push(value.slice(cursor))
  return <>{parts}</>
}

export function renderEmojiText(value) {
  if (typeof value === 'string') return renderTextWithEmoji(value)
  if (Array.isArray(value)) return value.map(renderEmojiText)
  return value
}
