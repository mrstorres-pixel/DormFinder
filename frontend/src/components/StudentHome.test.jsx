import { render, screen } from '@testing-library/react'
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
  it('keeps the personal area separate from search, with a useful save action and no empty activity panels', async () => {
    respond({})
    show()
    expect(await screen.findByRole('heading', { name: 'Found a place you like?' })).toBeVisible()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit profile' })).toHaveAttribute('href', '/profile')
    expect(screen.getByRole('link', { name: 'Explore places →' })).toHaveAttribute('href', '/listings?campus_id=8&radius_km=2&sort=recommended')
    expect(screen.queryByRole('heading', { name: 'Recent viewings' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Recent messages' })).not.toBeInTheDocument()
    expect(mocks.get.mock.calls.some(([path]) => path === '/dashboard')).toBe(false)
  })
  it('opens the displayed room at its exact price, with a caution for stale saved inventory', async () => {
    respond({ '/saved-places': [{ property_id: property.id, room_option_id: room.id, listing: { ...property, room_options: [{ ...room, availability_stale: true }] }, contexts: [] }] })
    show()
    expect((await screen.findByRole('heading', { name: property.title })).querySelector('a')).toHaveAttribute('href', '/listings/2?option=21')
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
    const heading = await screen.findByRole('heading', { name: 'Owner B' })
    expect(heading.closest('a')).toHaveAttribute('href', '/inquiries/2')
    expect(screen.getByText('Conversation paused')).toBeVisible()
  })
  it('keeps account settings usable when activity fails and distinguishes unavailable saves from an unused account', async () => {
    respond({ '/inquiries': new Error('Synthetic private activity failure'), '/saved-places': [{ property_id: 22, listing: null, listing_snapshot: { title: 'Previously saved residence' }, contexts: [] }] })
    show()
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not reach DormFinder')
    expect(screen.getByRole('link', { name: 'Edit profile' })).toHaveAttribute('href', '/profile')
    expect(screen.getByRole('heading', { name: 'Previously saved residence' })).toBeVisible()
    expect(screen.getByText('Listing unavailable')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
  })
})
