import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FeaturedHomes from './FeaturedHomes'

const mocks = vi.hoisted(() => ({ data: [], user: null, options: null, get: vi.fn() }))
vi.mock('@tanstack/react-query', () => ({ useQuery: options => { mocks.options = options; return { data: mocks.data } } }))
vi.mock('../lib/auth', () => ({ useCurrentUser: () => ({ data: mocks.user }) }))
vi.mock('../lib/api', () => ({ api: { get: mocks.get } }))

const room = (id, rent, available, stale = false) => ({ id, name: 'Room ' + id, capacity: 4, monthly_rent_centavos: rent, monthly_fixed_total_centavos: rent + 10000, price_basis: 'per_person', available_units: available, availability_stale: stale })
const property = (id, title, options) => ({ id, title, city: 'Manila', room_options: options, photos: [{ url: '/room-' + id + '.jpg', caption: 'Fictional room illustration' }] })

describe('homepage room discovery', () => {
  beforeEach(() => { mocks.data = []; mocks.user = null; mocks.get.mockReset() })

  it('features only fresh vacancies and links to their exact room rather than a cheaper sold-out option', () => {
    mocks.data = [property(1, 'Fresh residence', [room(10, 100000, 0), room(11, 400000, 2)]), property(2, 'Stale residence', [room(20, 200000, 2, true)]), property(3, 'Sold-out residence', [room(30, 300000, 0)])]
    render(<MemoryRouter><FeaturedHomes /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Fresh residence' }).closest('a')).toHaveAttribute('href', '/listings/1?option=11')
    expect(screen.queryByRole('heading', { name: 'Stale residence' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sold-out residence' })).not.toBeInTheDocument()
    expect(screen.getByText('₱4,000')).toBeInTheDocument()
    expect(screen.getByText('4-person room')).toBeInTheDocument()
  })

  it('keeps the saved campus radius for an empty result rather than silently broadening', async () => {
    mocks.user = { preferred_campus_id: 42 }
    mocks.get.mockResolvedValue({ data: { data: [] } })
    render(<MemoryRouter><FeaturedHomes /></MemoryRouter>)
    await mocks.options.queryFn()
    expect(mocks.get).toHaveBeenCalledWith('/listings', { params: { campus_id: 42, radius_km: 2, sort: 'recommended', available_only: 1 } })
    expect(screen.getByText('No recently confirmed rooms within 2 km of your saved campus yet.')).toBeInTheDocument()
  })

  it('shows an honest fallback when a signed photo fails while keeping the room accessible', () => {
    mocks.data = [property(1, 'Fresh residence', [room(11, 400000, 2)])]
    render(<MemoryRouter><FeaturedHomes /></MemoryRouter>)
    fireEvent.error(screen.getByAltText('Fictional room illustration'))
    expect(screen.getByText('Photo unavailable')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Fresh residence' }).closest('a')).toHaveAttribute('href', '/listings/1?option=11')
  })

  it('uses clearly labeled concept imagery only for the approved fictional demos', () => {
    mocks.data = [{ ...property(1, '[DEMO] Near Campus Twin Dorm', [room(11, 400000, 2)]), is_demo: true }]
    const { rerender } = render(<MemoryRouter><FeaturedHomes /></MemoryRouter>)
    expect(screen.getByAltText('AI-generated illustration of a fictional twin student dorm')).toHaveAttribute('src', '/images/demo/twin-room.webp')
    expect(screen.getByText('AI demo illustration')).toBeInTheDocument()
    mocks.data[0].is_demo = false
    rerender(<MemoryRouter><FeaturedHomes /></MemoryRouter>)
    expect(screen.getByAltText('Fictional room illustration')).toHaveAttribute('src', '/room-1.jpg')
    expect(screen.queryByText('AI demo illustration')).not.toBeInTheDocument()
  })
})
