import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ErrorNotice, Field } from './Feedback'

describe('accessible form feedback', () => {
  it('connects field errors to the input', () => {
    render(<Field name="email" label="Email" error={{ email: ['Use a valid email address.'] }} />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Use a valid email address.')
  })

  it('gives a recoverable message when the backend is unavailable', () => {
    render(<ErrorNotice error={new Error('Network error')} />)
    expect(screen.getByRole('alert')).toHaveTextContent('The service may be starting up')
  })

  it('renders untrusted error text without interpreting HTML', () => {
    const { container } = render(<ErrorNotice error={{ response: { data: { message: '<script>alert(1)</script>' } } }} />)
    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent('<script>alert(1)</script>')
  })
})

