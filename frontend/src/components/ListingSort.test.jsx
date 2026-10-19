import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ListingSort } from './SearchFilters'

it('offers campus-based sorting only after a campus is explicitly selected', () => {
  const { rerender } = render(<ListingSort params={new URLSearchParams()} onSearch={vi.fn()} />)
  for (const name of ['Recommended near campus', 'Nearest campus first']) expect(screen.getByRole('option', { name })).toHaveProperty('disabled', true)
  rerender(<ListingSort params={new URLSearchParams('campus_id=8')} onSearch={vi.fn()} />)
  for (const name of ['Recommended near campus', 'Nearest campus first']) expect(screen.getByRole('option', { name })).toHaveProperty('disabled', false)
})
