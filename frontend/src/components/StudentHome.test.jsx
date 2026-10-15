import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StudentHome from './StudentHome'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../lib/api', async importOriginal => ({ ...await importOriginal(), api: { get: mocks.get } }))
vi.mock('../lib/auth', () => ({ useCurrentUser: () => ({ data: { id: 3, role: 'student', preferred_campus_id: 8 } }) }))
const user = { id: 3, role: 'student', name: 'A VERY LONG FULL NAME', preferred_campus_id: 8 }
const room = { id: 21, capacity: 2, price_basis: 'per_person', monthly_rent_centavos: 400000, available_units: 1, availability_stale: false }
const property = { id: 2, title: 'Saved residence', room_options: [room], photos: [] }
const snapshot = { title: 'Viewing residence', room_name: 'Twin room' }
const future = new Date(Date.now() + 86400000).toISOString()
const viewing = { id: 10, starts_at: future, status: 'proposed', time_passed: false, can_schedule: true, listing_snapshot: snapshot }
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><StudentHome user={user} /></MemoryRouter></QueryClientProvider>)
}
const respond = collections => mocks.get.mockImplementation(async (path, options) => {
  if (path === '/campuses') return { data: { data: [{ id: 8, name: 'Saved university', institution_name: 'University', city: 'Manila' }] } }
  const key = path === '/viewings' ? options.params.status : path
  const response = collections[key]
  if (response instanceof Error) throw response
  return { data: { data: response || [], meta: { last_page: 1, unavailable_ids: collections.unavailable || [] } } }
})

describe('student space', () => {
  beforeEach(() => { mocks.get.mockReset() })
  it('gives an empty account a campus search and useful save action without statistics or empty activity panels', async () => {
    respond({})
    show()
    expect(await screen.findByRole('heading', { name: 'Found a place you like?' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'College or university' })).toHaveValue('Saved university')
    expect(screen.getByRole('link', { name: 'Explore places →' })).toHaveAttribute('href', '/listings?campus_id=8&radius_km=2&sort=recommended')
    expect(screen.queryByRole('heading', { name: 'Your viewings' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Recent conversations' })).not.toBeInTheDocument()
    expect(screen.queryByText(user.name)).not.toBeInTheDocument()
    expect(mocks.get.mock.calls.some(([path]) => path === '/dashboard')).toBe(false)
  })
  it('opens the displayed room at its exact price, with a caution for stale saved inventory', async () => {
    respond({ '/favorites': [{ ...property, room_options: [{ ...room, availability_stale: true }] }] })
    show()
    expect((await screen.findByRole('heading', { name: property.title })).closest('a')).toHaveAttribute('href', '/listings/2?option=21')
    expect(screen.getByText('₱4,000')).toBeVisible()
    expect(screen.getByText('2-person room')).toBeVisible()
    expect(screen.getByText('Availability needs confirmation')).toBeVisible()
  })
  it('shows actionable future requests, preserves paused status and links directly to the right viewing', async () => {
    respond({ proposed: [viewing, { ...viewing, id: 11, starts_at: '2020-01-01T00:00:00Z' }], accepted: [{ ...viewing, id: 12, status: 'accepted', can_schedule: false }] })
    show()
    expect(await screen.findByRole('link', { name: /Review suggested time/ })).toHaveAttribute('href', '/viewings?status=proposed#viewing-10')
    expect(screen.getByRole('link', { name: /View visit details/ })).toHaveAttribute('href', '/viewings?status=accepted#viewing-12')
    expect(screen.getAllByText('Twin room')).toHaveLength(2)
    expect(screen.getByText('Scheduling paused')).toBeVisible()
    expect(screen.queryByText('Time agreed')).not.toBeInTheDocument()
  })
  it('prioritizes a reply over waiting conversations without implying paused threads can be answered', async () => {
    respond({ '/inquiries': [{ id: 1, participant_name: 'Owner A', can_reply: true, awaiting_reply: false, listing_snapshot: { title: 'Waiting residence' } }, { id: 2, participant_name: 'Owner B', can_reply: true, awaiting_reply: true, listing_snapshot: { title: 'Reply residence' } }, { id: 3, participant_name: 'Owner C', can_reply: false, awaiting_reply: true, listing_snapshot: { title: 'Paused residence' } }] })
    show()
    const heading = await screen.findByRole('heading', { name: 'Reply residence' })
    const section = heading.closest('section')
    expect(within(section).getAllByRole('link')[1]).toHaveAttribute('href', '/inquiries/2')
    expect(screen.getByText('Replies paused · View conversation')).toBeVisible()
  })
  it('keeps search usable when private activity fails and distinguishes unavailable saves from an unused account', async () => {
    respond({ '/inquiries': new Error('Synthetic private activity failure'), unavailable: [22] })
    show()
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not reach DormFinder')
    expect(screen.getByRole('combobox', { name: 'College or university' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Find housing near my campus' })).toBeEnabled()
    expect(screen.getByRole('heading', { name: 'Your saved listings are currently unavailable.' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
  })
})
