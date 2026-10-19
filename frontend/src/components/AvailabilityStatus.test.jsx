import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import AvailabilityStatus, { OwnerAvailability } from './AvailabilityStatus'

it('shows owner-reported age and a room-specific inquiry shortcut when overdue', () => {
  render(<MemoryRouter><AvailabilityStatus option={{ availability_confirmed_at: '2026-10-01T08:00:00Z', availability_age_days: 18, availability_stale: true, availability_expired: false }} askHref="/listings/7?option=12#confirm-availability" /></MemoryRouter>)
  expect(screen.getByText('Last confirmed 18 days ago')).toHaveAttribute('datetime', '2026-10-01T08:00:00.000Z')
  expect(screen.getByText('Needs confirmation')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Ask owner' })).toHaveAttribute('href', '/listings/7?option=12#confirm-availability')
})

it('explains hidden availability to owners without treating it as a lost approval', () => {
  const { rerender } = render(<OwnerAvailability property={{ status: 'approved', availability: { status: 'hidden', rooms_needing_confirmation: 2 } }} />)
  expect(screen.getByText('Hidden from students')).toBeVisible()
  expect(screen.getByText(/Confirm current vacancies to show this listing again/)).toBeVisible()
  rerender(<OwnerAvailability property={{ status: 'draft', availability: { status: 'hidden' } }} />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
