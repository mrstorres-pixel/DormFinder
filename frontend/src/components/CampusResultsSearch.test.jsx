import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CampusResultsSearch from './CampusResultsSearch'

const campuses = [{ id: 1, name: 'TIP Manila', institution_name: 'Technological Institute of the Philippines', slug: 'tip-manila', city: 'Manila' }, { id: 2, name: 'DLSU Manila', institution_name: 'De La Salle University', slug: 'dlsu-manila', city: 'Manila' }]

describe('visible campus search', () => {
  it('changes campus without dropping budget or amenities, and removes the old map area and page', async () => {
    const search = vi.fn(), user = userEvent.setup()
    render(<CampusResultsSearch campuses={campuses} params={new URLSearchParams('campus_id=1&price_basis=per_person&max_rent_centavos=500000&amenities[]=wifi&page=2&south=14&north=15&east=121&west=120')} onSearch={search} />)
    await user.type(screen.getByRole('combobox'), 'DLSU')
    await user.click(screen.getByRole('button', { name: /DLSU Manila/ }))
    await user.click(screen.getByRole('button', { name: /Search campus/ }))
    const result = search.mock.calls[0][0]
    expect(result.get('campus_id')).toBe('2')
    expect(result.get('radius_km')).toBe('2')
    expect(result.get('max_rent_centavos')).toBe('500000')
    expect(result.getAll('amenities[]')).toEqual(['wifi'])
    expect(result.has('page')).toBe(false)
    expect(result.has('south')).toBe(false)
  })

  it('does not apply an unselected campus query', async () => {
    const search = vi.fn(), user = userEvent.setup()
    render(<CampusResultsSearch campuses={campuses} params={new URLSearchParams()} onSearch={search} />)
    await user.type(screen.getByRole('combobox'), 'Unknown University')
    await user.click(screen.getByRole('button', { name: /Search campus/ }))
    expect(search).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a campus')
    expect(screen.getByRole('combobox')).toHaveValue('Unknown University')
  })

  it('clears campus distance and campus-only sorting while keeping other requirements', async () => {
    const search = vi.fn(), user = userEvent.setup()
    render(<CampusResultsSearch campuses={campuses} params={new URLSearchParams('campus_id=1&radius_km=2&sort=distance&price_basis=per_room')} onSearch={search} />)
    await user.click(screen.getByRole('button', { name: 'Clear selected campus' }))
    await user.click(screen.getByRole('button', { name: /Search campus/ }))
    const result = search.mock.calls[0][0]
    expect(result.has('campus_id')).toBe(false)
    expect(result.has('radius_km')).toBe(false)
    expect(result.get('sort')).toBe('newest')
    expect(result.get('price_basis')).toBe('per_room')
  })
})
