import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UnsavedChangesProvider from './UnsavedChangesProvider'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import VacancyForm from './VacancyForm'
import { writeApi } from '../lib/api'
vi.mock('../lib/api', async original => ({ ...await original(), writeApi: vi.fn() }))
const property = { id: 9, revision: 4 }
const option = { id: 3, name: 'Shared beds', total_units: 2, available_units: 1 }
function show(confirmSave) { render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={createMemoryRouter([{ path: '*', element: <UnsavedChangesProvider><VacancyForm property={property} option={option} onSaved={vi.fn()} confirmSave={confirmSave} /></UnsavedChangesProvider> }])} /></QueryClientProvider>) }
beforeEach(() => vi.clearAllMocks())
describe('availability changes preserve pending room edits', () => {
  it('does not send an availability mutation when discarding room edits is declined', async () => {
    const confirm = vi.fn(() => false)
    show(confirm)
    await userEvent.click(screen.getByRole('button', { name: 'Confirm vacancies today' }))
    expect(confirm).toHaveBeenCalledOnce()
    expect(writeApi).not.toHaveBeenCalled()
  })
  it('sends the exact vacancy count and revision after confirmation', async () => {
    show(() => true)
    writeApi.mockResolvedValue(property)
    await userEvent.click(screen.getByRole('button', { name: 'Confirm vacancies today' }))
    await waitFor(() => expect(writeApi).toHaveBeenCalledWith('patch', '/landlord/properties/9/availability', { revision: 4, options: [{ id: 3, available_units: 1 }] }))
  })
})
