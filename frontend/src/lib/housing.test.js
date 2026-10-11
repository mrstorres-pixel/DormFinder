import { describe, it, expect } from 'vitest'
import { campusResults, preferredOption, searchParameters, recommendationReasons } from './housing'
import { safeReturnTo } from './navigation'

describe('campus discovery and task continuity', () => {
  it('matches acronyms and institution names while distinguishing campuses', () => {
    const campuses = [{ id:1,name:'PUP — Mabini',institution_name:'Polytechnic University of the Philippines',aliases:['PUP','Sta Mesa'],city:'Manila' },{ id:2,name:'PUP — Taguig',aliases:['PUP'],city:'Taguig' }]
    expect(campusResults(campuses,'polytechnic')).toHaveLength(1)
    expect(campusResults(campuses,'pup manila').map(c => c.id)).toEqual([1])
    expect(campusResults(campuses,'pup taguig').map(c => c.id)).toEqual([2])
  })
  it('prefers fresh available inventory rather than a cheaper sold-out option', () => {
    const options = [{ id:1,available_units:0,availability_stale:false },{ id:2,available_units:2,availability_stale:true },{ id:3,available_units:1,availability_stale:false }]
    expect(preferredOption(options).id).toBe(3)
    expect(preferredOption(options.slice(0,2)).id).toBe(2)
  })
  it('keeps repeated amenity filters and explains only established matches', () => {
    const params = new URLSearchParams('campus_id=1&max_rent_centavos=400000&amenities[]=wifi&amenities[]=laundry')
    expect(searchParameters(params).amenities).toEqual(['wifi','laundry'])
    expect(recommendationReasons({ distance_from_campus:{ meters:800 },room_options:[{available_units:1,availability_stale:false}] },params)).toEqual(['Availability recently confirmed','Matches your base-rent budget','Near your selected campus'])
  })
  it('allows local task returns and rejects external, malformed, and authentication-loop destinations', () => {
    expect(safeReturnTo('/listings/25?option=3&campus_id=2')).toBe('/listings/25?option=3&campus_id=2')
    for (const value of ['https://example.com','//example.com','/\\example.com','/login','/register?returnTo=bad','/ bad']) expect(safeReturnTo(value)).toBe('/account')
  })
})
