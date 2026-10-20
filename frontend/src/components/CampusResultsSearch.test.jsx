import { render as renderComponent, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CampusResultsSearch from './CampusResultsSearch'

const campuses = [{ id: 1, name: 'TIP Manila', institution_name: 'Technological Institute of the Philippines', slug: 'tip-manila', city: 'Manila' }, { id: 2, name: 'DLSU Manila', institution_name: 'De La Salle University', slug: 'dlsu-manila', city: 'Manila' }]
vi.mock('../lib/api', () => ({ api: { get: vi.fn(async () => ({ data: { data: [] } })) } }))
const render = component => renderComponent(<QueryClientProvider client={new QueryClient()}>{component}</QueryClientProvider>)

describe('visible campus search', () => {
  it('changes campus without dropping budget or amenities, and removes the old map area and page', async () => {
    const search = vi.fn(), user = userEvent.setup()
    render(<CampusResultsSearch campuses={campuses} params={new URLSearchParams('campus_id=1&price_basis=per_person&max_rent_centavos=500000&amenities[]=wifi&page=2&south=14&north=15&east=121&west=120')} onSearch={search} />)
    await user.clear(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'DLSU')
    await user.click(screen.getByRole('button', { name: /DLSU Manila/ }))
    await user.click(screen.getByRole('button', { name: /Search places/ }))
    const result = search.mock.calls[0][0]
    expect(result.get('campus_id')).toBe('2')
    expect(result.get('radius_km')).toBe('2')
    expect(result.get('max_rent_centavos')).toBe('500000')
    expect(result.getAll('amenities[]')).toEqual(['wifi'])
    expect(result.has('page')).toBe(false)
    expect(result.has('south')).toBe(false)
  })

  it('searches arbitrary listing or location text without inventing a campus', async () => {
    const search = vi.fn(), user = userEvent.setup()
    render(<CampusResultsSearch campuses={campuses} params={new URLSearchParams()} onSearch={search} />)
    await user.type(screen.getByRole('combobox'), 'Unknown University')
    await user.keyboard('{Enter}')
    expect(search.mock.calls[0][0].get('q')).toBe('Unknown University')
    expect(search.mock.calls[0][0].has('campus_id')).toBe(false)
    expect(search.mock.calls[0][0].has('radius_km')).toBe(false)
    expect(screen.getByRole('combobox')).toHaveValue('Unknown University')
  })

  it('clears campus distance and campus-only sorting while keeping other requirements', async () => {
    const search = vi.fn(), user = userEvent.setup()
    render(<CampusResultsSearch campuses={campuses} params={new URLSearchParams('campus_id=1&radius_km=2&sort=distance&price_basis=per_room')} onSearch={search} />)
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    await user.click(screen.getByRole('button', { name: /Search places/ }))
    const result = search.mock.calls[0][0]
    expect(result.has('campus_id')).toBe(false)
    expect(result.has('radius_km')).toBe(false)
    expect(result.get('sort')).toBe('newest')
    expect(result.get('price_basis')).toBe('per_room')
  })
})
