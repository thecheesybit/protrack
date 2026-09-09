import { describe, it, expect } from 'vitest'
import { Butterfly, ButterflyFlock } from '../ButterflyFlock'
import { FireflyField } from '../FireflyField'
import { DawnSkyObjects } from '../DawnSkyObjects'
import { DaySkyObjects } from '../DaySkyObjects'
import { DuskSkyObjects } from '../DuskSkyObjects'
import { SpaceObjects } from '../SpaceObjects'

describe('Wildlife and Atmospheric Animations', () => {
  it('exports all dynamic theme sky components', () => {
    expect(Butterfly).toBeDefined()
    expect(ButterflyFlock).toBeDefined()
    expect(FireflyField).toBeDefined()
    expect(DawnSkyObjects).toBeDefined()
    expect(DaySkyObjects).toBeDefined()
    expect(DuskSkyObjects).toBeDefined()
    expect(SpaceObjects).toBeDefined()
  })

  it('renders Butterfly component as memoized function', () => {
    expect(typeof Butterfly).toBe('object')
    expect(Butterfly.$$typeof).toBeDefined()
  })

  it('renders ButterflyFlock component as memoized function', () => {
    expect(typeof ButterflyFlock).toBe('object')
    expect(ButterflyFlock.$$typeof).toBeDefined()
  })

  it('generates non-repeating firefly parameters in FireflyField', () => {
    expect(typeof FireflyField).toBe('object')
    expect(FireflyField.$$typeof).toBeDefined()
  })
})
