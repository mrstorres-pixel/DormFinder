import { describe, expect, it } from 'vitest'
import { comparisonHighlights, detailedMatches, viewingIso, viewingLabel } from './practical'

function row(id, monthly, moveIn, basis = 'per_person', extra = {}) {
  return { id, distance_from_campus: { campus_id: 1, meters: id * 100 }, room_options: [{ available_units: 2, availability_stale: false, price_basis: basis, monthly_fixed_total_centavos: monthly, move_in_fixed_total_centavos: moveIn, ...extra }] }
}
describe('practical campus housing decisions', () => {
  it('compares costs only within matching price bases and confirmed available inventory', () => {
    const rows = [row(1,300000,900000),row(2,400000,500000),row(3,100000,100000,'per_room'),row(4,50000,50000,'per_person',{available_units:0}),row(5,60000,60000,'per_person',{availability_stale:true})]
    const result = comparisonHighlights(rows)
    expect(result[1]).toContain('Lowest known monthly charges')
    expect(result[2]).toContain('Lowest stated move-in charges')
    expect(result[3]).not.toContain('Lowest known monthly charges')
    expect(result[4]).toEqual([])
    expect(result[5]).toEqual([])
  })
  it('labels a partial tie and avoids declaring every identical price a winner', () => {
    const result = comparisonHighlights([row(1,300000,500000),row(2,300000,500000),row(3,400000,500000)])
    expect(result[1]).toContain('Lowest known monthly charges (tie)')
    expect(result[2]).toContain('Lowest known monthly charges (tie)')
    expect(result[1]).not.toContain('Lowest stated move-in charges')
  })
  it('never ranks unknown charges or unrelated campus references as better', () => {
    const first = row(1,undefined,undefined)
    const second = row(2,400000,500000)
    second.distance_from_campus.campus_id = 2
    expect(comparisonHighlights([first,second])).toEqual({1:[],2:[]})
  })
  it('explains the actual selected room instead of another available option', () => {
    const params = new URLSearchParams('campus_id=1&radius_km=2&max_rent_centavos=400000&price_basis=per_person&inventory_type=bedspace&amenities[]=wifi')
    const property = { amenities:['wifi'], distance_from_campus:{ campus_id:1,meters:800 } }
    const selected = { monthly_rent_centavos:500000,price_basis:'per_person',inventory_type:'bedspace',available_units:0,availability_stale:false }
    const reasons = detailedMatches(property,params,selected)
    expect(reasons.join(' ')).not.toMatch(/confirmed|fits your budget/)
    expect(reasons).toContain('Your chosen bedspace type')
    expect(reasons).toContain('Required amenities: Wi-Fi')
    expect(reasons).toContain('Within your 2 km campus radius')
  })
  it('uses Philippine viewing times independently of the browser timezone', () => {
    expect(viewingIso('2026-10-14T14:30')).toBe('2026-10-14T06:30:00.000Z')
    expect(viewingLabel('2026-10-14T06:30:00Z')).toMatch(/2:30.*PHT/)
    expect(() => viewingIso('tomorrow')).toThrow()
    expect(() => viewingIso('2026-02-30T14:30')).toThrow()
  })
})
