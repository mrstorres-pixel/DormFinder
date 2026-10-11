import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import DashboardActions from './DashboardActions'
function show(user, counts) { render(<MemoryRouter><DashboardActions user={user} counts={counts} /></MemoryRouter>) }
describe('dashboard next actions', () => {
  it('uses the saved campus with an explicit radius and recommendation sort', () => {
    show({ role: 'student', preferred_campus_id: 23 })
    expect(screen.getByRole('link', { name: 'Find housing near your campus' })).toHaveAttribute('href', '/listings?campus_id=23&radius_km=2&sort=recommended')
    expect(screen.getByRole('link', { name: 'Change your saved campus' })).toHaveAttribute('href', '/profile')
  })
  it('helps a student choose a campus without inventing a preference', () => {
    show({ role: 'student' })
    expect(screen.getByRole('link', { name: 'Choose your college or university' })).toHaveAttribute('href', '/profile')
    expect(screen.getByRole('link', { name: 'Compare your shortlist' })).toHaveAttribute('href', '/compare')
    expect(screen.queryByRole('link', { name: 'Find housing near your campus' })).toBeNull()
  })
  it('separates landlord preparation and private conversations', () => {
    show({ role: 'landlord' }, { listings: { draft: 2, rejected: 1, approved: 5 } })
    expect(screen.getByText(/3 drafts or returned listings/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Respond to students' })).toHaveAttribute('href', '/inquiries')
    expect(screen.queryByRole('link', { name: 'Follow up on reports' })).toBeNull()
  })
  it('directs administrator follow-up to reports and audit history', () => {
    show({ role: 'admin' }, { pending_reviews: 2, open_reports: 1 })
    expect(screen.getByText(/2 listings await/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Follow up on reports' })).toHaveAttribute('href', '/admin/reports')
    expect(screen.getByRole('link', { name: 'Check moderation history' })).toHaveAttribute('href', '/admin/audit')
  })
})
