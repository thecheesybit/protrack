import { describe, it, expect } from 'vitest'
import {
  VIDEO_PRESETS,
  DEFAULT_FOCUS_SCENE,
  youtubeId,
  toCanonicalYouTubeUrl,
  buildSceneEmbedUrl,
} from '../focusScenes'

describe('focusScenes', () => {
  describe('presets', () => {
    it('has valid presets all using canonical youtu.be format', () => {
      expect(VIDEO_PRESETS.length).toBeGreaterThanOrEqual(4)
      for (const preset of VIDEO_PRESETS) {
        expect(preset.label).toBeTruthy()
        expect(preset.url).toMatch(/^https:\/\/youtu\.be\/[a-zA-Z0-9_-]{11}$/)
        expect(youtubeId(preset.url)).toBeTruthy()
      }
    })

    it('defines DEFAULT_FOCUS_SCENE', () => {
      expect(DEFAULT_FOCUS_SCENE).toEqual(VIDEO_PRESETS[0])
    })
  })

  describe('youtubeId extraction', () => {
    const validCases = [
      ['standard watch URL', 'https://www.youtube.com/watch?v=1GzKYoyrlkA', '1GzKYoyrlkA'],
      ['youtu.be shortened', 'https://youtu.be/1GzKYoyrlkA', '1GzKYoyrlkA'],
      ['watch URL with trailing params', 'https://www.youtube.com/watch?v=1GzKYoyrlkA&t=10s', '1GzKYoyrlkA'],
      ['watch URL with params BEFORE v=', 'https://www.youtube.com/watch?si=xyz123&v=1GzKYoyrlkA', '1GzKYoyrlkA'],
      ['watch URL with feature=shared before v=', 'https://www.youtube.com/watch?feature=shared&v=1GzKYoyrlkA', '1GzKYoyrlkA'],
      ['desktop app param', 'https://www.youtube.com/watch?app=desktop&v=1GzKYoyrlkA&feature=youtu.be', '1GzKYoyrlkA'],
      ['youtu.be with tracking si=', 'https://youtu.be/1GzKYoyrlkA?si=xyz123', '1GzKYoyrlkA'],
      ['youtube shorts', 'https://www.youtube.com/shorts/1GzKYoyrlkA', '1GzKYoyrlkA'],
      ['youtube shorts with query', 'https://www.youtube.com/shorts/1GzKYoyrlkA?feature=share', '1GzKYoyrlkA'],
      ['youtube live', 'https://www.youtube.com/live/1GzKYoyrlkA', '1GzKYoyrlkA'],
      ['youtube live with query', 'https://www.youtube.com/live/1GzKYoyrlkA?feature=share', '1GzKYoyrlkA'],
      ['mobile URL', 'https://m.youtube.com/watch?v=1GzKYoyrlkA', '1GzKYoyrlkA'],
      ['mobile URL with feature param', 'https://m.youtube.com/watch?feature=shared&v=1GzKYoyrlkA', '1GzKYoyrlkA'],
      ['music youtube URL', 'https://music.youtube.com/watch?v=1GzKYoyrlkA', '1GzKYoyrlkA'],
      ['music youtube with list param', 'https://music.youtube.com/watch?v=1GzKYoyrlkA&list=RDAMVM1GzKYoyrlkA', '1GzKYoyrlkA'],
      ['youtube-nocookie embed', 'https://www.youtube-nocookie.com/embed/1GzKYoyrlkA', '1GzKYoyrlkA'],
      ['bare 11-char ID', '1GzKYoyrlkA', '1GzKYoyrlkA'],
      ['ID with spaces around it', '  1GzKYoyrlkA  ', '1GzKYoyrlkA'],
      ['URL with leading/trailing whitespace', '  https://www.youtube.com/watch?v=1GzKYoyrlkA   ', '1GzKYoyrlkA'],
    ]

    validCases.forEach(([desc, input, expected]) => {
      it(`extracts ID from ${desc}`, () => {
        expect(youtubeId(input)).toBe(expected)
      })
    })

    const invalidCases = [
      ['empty string', ''],
      ['null', null],
      ['undefined', undefined],
      ['non-youtube URL', 'https://vimeo.com/12345678'],
      ['random text', 'hello world'],
      ['too short ID', '12345'],
      ['too long non-youtube string', 'abcdefghijklmnopqrstuvwxyz123456'],
    ]

    invalidCases.forEach(([desc, input]) => {
      it(`returns null for ${desc}`, () => {
        expect(youtubeId(input)).toBeNull()
      })
    })
  })

  describe('toCanonicalYouTubeUrl', () => {
    it('converts any valid URL or ID to standard preset format', () => {
      expect(toCanonicalYouTubeUrl('https://www.youtube.com/watch?si=xyz&v=1GzKYoyrlkA')).toBe(
        'https://youtu.be/1GzKYoyrlkA',
      )
      expect(toCanonicalYouTubeUrl('1GzKYoyrlkA')).toBe('https://youtu.be/1GzKYoyrlkA')
      expect(toCanonicalYouTubeUrl('https://www.youtube.com/shorts/1GzKYoyrlkA')).toBe(
        'https://youtu.be/1GzKYoyrlkA',
      )
    })

    it('returns null for invalid inputs', () => {
      expect(toCanonicalYouTubeUrl('')).toBeNull()
      expect(toCanonicalYouTubeUrl('invalid')).toBeNull()
    })
  })

  describe('buildSceneEmbedUrl', () => {
    it('builds embed URL with clean background playback parameters', () => {
      const url = buildSceneEmbedUrl('1GzKYoyrlkA')
      expect(url).toContain('https://www.youtube.com/embed/1GzKYoyrlkA')
      expect(url).toContain('autoplay=1')
      expect(url).toContain('enablejsapi=1')
      expect(url).toContain('controls=0')
      expect(url).toContain('loop=1')
      expect(url).toContain('playlist=1GzKYoyrlkA')
    })

    it('returns empty string if videoId is missing', () => {
      expect(buildSceneEmbedUrl('')).toBe('')
      expect(buildSceneEmbedUrl(null)).toBe('')
    })
  })
})
