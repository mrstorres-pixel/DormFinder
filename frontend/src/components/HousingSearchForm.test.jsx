import { render as renderComponent, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HousingSearchForm from './HousingSearchForm'

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), user: null }))
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('../lib/auth', () => ({ useCurrentUser: () => ({ data: mocks.user }) }))
vi.mock('../lib/api', () => ({ api: { get: vi.fn(async () => ({ data: { data: [] } })) } }))
const render = component => renderComponent(<QueryClientProvider client={new QueryClient()}>{component}</QueryClientProvider>)
vi.mock('../lib/discovery', () => ({ useCampuses: () => ({ data: [
  { id: 1, name: 'TIP — Manila', institution_name: 'Technological Institute', aliases: ['TIP'], city: 'Manila' },
  { id: 2, name: 'TIP — Quezon City', institution_name: 'Technological Institute', aliases: ['TIP'], city: 'Quezon City' },
] }) }))

describe('shared housing search', () => {
  beforeEach(() => { mocks.navigate.mockReset(); mocks.user = null })

  it('requires an explicit price basis for a budget and carries exact costs and preferences into results', async () => {
    const user = userEvent.setup()
    render(<HousingSearchForm home />)
    await user.type(screen.getByRole('combobox', { name: 'Campus, location or listing' }), 'TIP Manila')
    await user.click(screen.getByRole('button', { name: /Campus TIP.*Manila/ }))
    await user.click(screen.getByRole('button', { name: 'Filters', exact: true }))
    await user.type(screen.getByLabelText('Maximum monthly base rent (PHP)'), '6000.29')
    await user.click(screen.getByRole('button', { name: 'Find housing' }))
    expect(screen.getByRole('alert')).toHaveTextContent('clear price basis')
    expect(mocks.navigate).not.toHaveBeenCalled()
    await user.selectOptions(screen.getByLabelText('Room type and price basis'), 'bedspace')
    await user.selectOptions(screen.getByLabelText('Distance from campus'), '0.5')
    await user.click(screen.getByLabelText('Wi-Fi'))
    await user.click(screen.getByLabelText('Only show vacancies confirmed within 14 days'))
    await user.click(screen.getByRole('button', { name: 'Find housing' }))
    const result = new URL(mocks.navigate.mock.calls[0][0], 'https://example.test')
    expect(Object.fromEntries(result.searchParams)).toEqual({ campus_id: '1', radius_km: '0.5', sort: 'recommended', inventory_type: 'bedspace', price_basis: 'per_person', max_rent_centavos: '600029', available_only: '1', 'amenities[]': 'wifi' })
  })

  it('lets an explicit campus override the profile preference without forcing a room or budget', async () => {
    mocks.user = { preferred_campus_id: 1 }
    const user = userEvent.setup()
    render(<HousingSearchForm home />)
    const campus = screen.getByRole('combobox', { name: 'Campus, location or listing' })
    expect(campus).toHaveValue('TIP — Manila')
    await user.clear(campus)
    await user.type(campus, 'Quezon City')
    await user.click(screen.getByRole('button', { name: /Campus TIP.*Quezon City/ }))
    await user.click(screen.getByRole('button', { name: 'Find housing' }))
    expect(mocks.navigate).toHaveBeenCalledWith('/listings?campus_id=2&radius_km=2&sort=recommended')
  })
})
