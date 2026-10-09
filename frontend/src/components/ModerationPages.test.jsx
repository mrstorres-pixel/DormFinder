import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { ReportForm, LifecycleControls, Notifications, ReportQueue } from './ModerationPages'
import { api, writeApi } from '../lib/api'
import { Field } from './Feedback'

vi.mock('../lib/api', async original => ({ ...await original(), api: { get: vi.fn() }, writeApi: vi.fn() }))
vi.mock('../lib/auth', () => ({ useCurrentUser: () => ({ data: { id: 7, role: 'student' } }) }))
function show(component) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MemoryRouter>{component}</MemoryRouter></QueryClientProvider>)
}
beforeEach(() => vi.clearAllMocks())

describe('moderation controls', () => {
  it('reuses a report identifier after a failed request and shows success accessibly', async () => {
    const user = userEvent.setup()
    writeApi.mockRejectedValueOnce(new Error('Synthetic unavailable request')).mockResolvedValueOnce({ id: 9 })
    show(<ReportForm property={{ id: 5 }} />)
    await user.click(screen.getByText('Report this listing'))
    await user.type(screen.getByLabelText('Report details'), 'Synthetic concern to review.')
    await user.click(screen.getByRole('button', { name: 'Send listing report' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Send listing report' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Your report has been received')
    expect(writeApi.mock.calls[0][2].client_id).toBe(writeApi.mock.calls[1][2].client_id)
  })

  it('requires an explicit acknowledgement and preserves the current revision', async () => {
    const user = userEvent.setup()
    writeApi.mockResolvedValue({ id: 5, status: 'archived', revision: 8 })
    show(<><Field label="Feedback for the owner" name="reason" /><LifecycleControls property={{ id: 5, status: 'pending_review', revision: 7 }} /></>)
    expect(screen.getByRole('button', { name: 'Apply listing action' })).toBeDisabled()
    await user.type(screen.getByLabelText('Reason for listing action'), 'Synthetic owner withdrawal.')
    expect(screen.getByLabelText('Feedback for the owner')).toHaveValue('')
    await user.click(screen.getByLabelText('I understand how this listing action affects publication and replies.'))
    await user.click(screen.getByRole('button', { name: 'Apply listing action' }))
    await waitFor(() => expect(writeApi).toHaveBeenCalledWith('post', '/landlord/properties/5/lifecycle', { action: 'archive', reason: 'Synthetic owner withdrawal.', revision: 7 }))
  })

  it('does not offer an owner a way to restore a suspended listing', () => {
    show(<LifecycleControls property={{ id: 5, status: 'suspended', revision: 7 }} />)
    expect(screen.queryByRole('button', { name: 'Apply listing action' })).not.toBeInTheDocument()
    expect(screen.getByText('Only an administrator can restore a suspended listing.')).toBeVisible()
  })

  it('renders notification errors with retry and never invents message previews', async () => {
    const user = userEvent.setup()
    api.get.mockRejectedValueOnce(new Error('Synthetic request failure')).mockResolvedValue({ data: { data: [{ id: 9, title: 'You have a new private inquiry message.', path: '/inquiries/5', read_at: null, created_at: '2026-10-09T10:00:00Z' }] } })
    show(<Notifications />)
    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'You have a new private inquiry message.' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'View update' })).toHaveAttribute('href', '/inquiries/5')
  })

  it('sends private resolution notes with the report revision', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValue({ data: { data: [{ id: 8, property_id: 5, student_id: 7, listing_title: 'Synthetic residence', category: 'other', body: 'Synthetic report detail', status: 'open', revision: 3 }] } })
    writeApi.mockResolvedValue({ id: 8 })
    show(<ReportQueue />)
    await user.type(await screen.findByLabelText('Private resolution notes'), 'Synthetic reviewed and dismissed concern.')
    await user.selectOptions(screen.getByLabelText('Report outcome'), 'dismissed')
    await user.click(screen.getByRole('button', { name: 'Close report #8' }))
    await waitFor(() => expect(writeApi).toHaveBeenCalledWith('post', '/admin/reports/8/resolve', { status: 'dismissed', reason: 'Synthetic reviewed and dismissed concern.', revision: 3 }))
  })
})
