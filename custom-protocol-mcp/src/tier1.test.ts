// src/tier1.test.ts
import { describe, it, expect } from 'vitest'
import { parseTier1, validateTier1 } from './tier1.js'

describe('validateTier1', () => {
  it('accepts valid status ping', () => {
    expect(validateTier1('alphaT3 AUTH +jwt-middleware')).toBe(true)
  })
  it('accepts urgent priority', () => {
    expect(validateTier1('!!epsilonP0 AUTH !bypass L140 @A2')).toBe(true)
  })
  it('accepts batch delta', () => {
    expect(validateTier1('..deltaT3,T4,T6 AUTH -lock')).toBe(true)
  })
  it('accepts heartbeat', () => {
    expect(validateTier1('..betaA3 alive T5:60%')).toBe(true)
  })
  it('rejects empty string', () => {
    expect(validateTier1('')).toBe(false)
  })
  it('rejects plain English', () => {
    expect(validateTier1("I've finished fixing the component")).toBe(false)
  })
})

describe('parseTier1', () => {
  it('extracts status code', () => {
    const result = parseTier1('alphaT3 AUTH +jwt-middleware')
    expect(result.status).toBe('alpha')
    expect(result.taskRef).toBe('T3')
    expect(result.priority).toBeNull()
  })
  it('extracts priority', () => {
    const result = parseTier1('!!epsilonP0 AUTH !bypass L140')
    expect(result.priority).toBe('!!')
    expect(result.status).toBe('epsilon')
  })
})
