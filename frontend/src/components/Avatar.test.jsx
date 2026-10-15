import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Avatar from './Avatar'

describe('profile photos', () => {
  it('shows the provided photo and falls back to initials when it cannot load', () => {
    render(<Avatar src="/api/v1/avatars/3?v=1" name="Alex Student" />)
    const photo = screen.getByRole('img', { name: 'Profile photo of Alex Student' })
    expect(photo).toHaveAttribute('src', '/api/v1/avatars/3?v=1')
    fireEvent.error(photo)
    expect(screen.getByRole('img', { name: /placeholder for Alex/ })).toHaveTextContent('AS')
  })
  it('recovers from a failed photo after the user replaces it', () => {
    const { rerender } = render(<Avatar src="/api/v1/avatars/3?v=1" name="Alex Student" />)
    fireEvent.error(screen.getByRole('img'))
    rerender(<Avatar src="/api/v1/avatars/3?v=2" name="Alex Student" />)
    expect(screen.getByRole('img')).toHaveAttribute('src', '/api/v1/avatars/3?v=2')
  })
  it('uses initials without making an external avatar request when there is no photo URL', () => {
    render(<Avatar name="Jamie Owner" />)
    expect(screen.getByRole('img')).toHaveTextContent('JO')
    expect(document.querySelector('img')).toBeNull()
  })
})
