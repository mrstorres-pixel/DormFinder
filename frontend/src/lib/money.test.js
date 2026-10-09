import { describe, expect, it } from 'vitest'
import { toCentavos, pesos } from './money'

describe('PHP room amounts', () => {
  it('converts entered peso decimals without losing centavos', () => {
    expect(toCentavos('3500.29')).toBe(350029)
    expect(toCentavos('0.1')).toBe(10)
    expect(toCentavos('123456.78')).toBe(12345678)
  })
  it('rejects negative, fractional-centavo and exponent inputs', () => {
    for (const value of ['-1', '2.999', '1e3', '', 'NaN']) expect(() => toCentavos(value)).toThrow()
  })
  it('displays a fixed two-decimal PHP amount', () => {
    expect(pesos(350029)).toContain('3,500.29')
  })
})
