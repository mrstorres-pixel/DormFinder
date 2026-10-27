import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../lib/api'
import { useWalkingRoute, walkingLabel } from '../lib/walking'
import WalkingRouteControl from './WalkingRouteControl'

vi.mock('../lib/api', () => ({ api: { get: vi.fn() }, errorMessage: error => error.response?.data?.message || 'Unavailable' }))
const campus = { id: 8, name: 'Test campus', latitude: 14.6, longitude: 121 }
const property = { id: 1, latitude: 14.601, longitude: 121, is_demo: true }
const route = { distance_meters: 522, duration_seconds: 419, geometry: { type: 'LineString', coordinates: [[121, 14.601], [121, 14.6]] } }
function Control({ listing = property }) {
  const walking = useWalkingRoute(listing, campus)
  return <WalkingRouteControl walking={walking} property={listing} campus={campus} />
}
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
beforeEach(() => vi.resetAllMocks())

describe('walking estimates', () => {
  it('loads only on request, labels estimates, clears and reuses cached routes', async () => {
    api.get.mockResolvedValue({ data: { data: route } })
    const user = userEvent.setup()
    render(<Control />, { wrapper: setup() })
    expect(api.get).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Walk to campus' }))
    expect(await screen.findByText('About 7 min walk · 522 m')).toBeVisible()
    expect(screen.queryByText(/fictional listing pin/)).not.toBeInTheDocument()
    expect(screen.getByText(/approximate reference/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Clear route' }))
    expect(screen.queryByText('About 7 min walk · 522 m')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Walk to campus' }))
    expect(await screen.findByText('About 7 min walk · 522 m')).toBeVisible()
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(walkingLabel({ distance_meters: 1435, duration_seconds: 1201 })).toBe('About 21 min walk · 1.4 km')
  })

  it('cancels the previous selection and never displays a late response for another listing', async () => {
    let complete
    api.get.mockImplementation(() => new Promise(resolve => { complete = resolve }))
    const user = userEvent.setup()
    const view = render(<Control />, { wrapper: setup() })
    await user.click(screen.getByRole('button', { name: 'Walk to campus' }))
    const signal = api.get.mock.calls[0][1].signal
    view.rerender(<Control listing={{ ...property, id: 2, latitude: 14.602 }} />)
    expect(signal.aborted).toBe(true)
    complete({ data: { data: route } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Walk to campus' })).toBeEnabled())
    expect(screen.queryByText('About 7 min walk · 522 m')).toBeNull()
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('shows a useful no-route error and allows explicit retry without estimating from straight lines', async () => {
    api.get.mockRejectedValueOnce({ response: { data: { message: 'No mapped walking route was found.' } } }).mockResolvedValueOnce({ data: { data: route } })
    const user = userEvent.setup()
    render(<Control />, { wrapper: setup() })
    await user.click(screen.getByRole('button', { name: 'Walk to campus' }))
    expect(await screen.findByText('No mapped walking route was found.')).toBeVisible()
    expect(screen.queryByText(/min walk/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Try walking route again' }))
    expect(await screen.findByText('About 7 min walk · 522 m')).toBeVisible()
  })
})
