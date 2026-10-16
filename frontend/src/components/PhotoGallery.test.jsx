import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PhotoGallery from './PhotoGallery'

const photos = [{ id: 1, url: '/one.jpg', caption: 'First room' }, { id: 2, url: '/two.jpg', caption: 'Second room' }]

describe('expanded listing photos', () => {
  it('keeps gallery and viewer in sync, moves once per arrow key and restores focus on close', async () => {
    const user = userEvent.setup()
    render(<PhotoGallery photos={photos} refresh={vi.fn()} />)
    const opener = screen.getByRole('button', { name: 'Enlarge photo 1: First room' })
    await user.click(opener)
    const viewer = screen.getByRole('dialog', { name: 'Listing photos' })
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(within(viewer).getByAltText('First room')).toBeVisible()
    await user.keyboard('{ArrowRight}')
    expect(within(viewer).getByRole('status')).toHaveTextContent('Photo 2 of 2')
    await user.click(within(viewer).getByRole('button', { name: 'Previous photo' }))
    expect(within(viewer).getByRole('status')).toHaveTextContent('Photo 1 of 2')
    await user.click(within(viewer).getByRole('button', { name: 'Close listing photos' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()
    expect(document.documentElement.style.overflow).toBe('')
  })

  it('refreshes failed enlarged photos without closing the viewer and allows backdrop dismissal', async () => {
    const user = userEvent.setup(), refresh = vi.fn()
    const view = render(<PhotoGallery photos={photos} refresh={refresh} />)
    await user.click(screen.getByRole('button', { name: 'Enlarge photo 1: First room' }))
    const viewer = screen.getByRole('dialog')
    fireEvent.error(within(viewer).getByAltText('First room'))
    await user.click(within(viewer).getByRole('button', { name: 'Refresh photo links' }))
    expect(refresh).toHaveBeenCalledOnce()
    view.rerender(<PhotoGallery photos={[{ ...photos[0], url: '/fresh.jpg' }, photos[1]]} refresh={refresh} />)
    expect(within(viewer).queryByRole('alert')).toBeNull()
    expect(within(viewer).getByAltText('First room')).toHaveAttribute('src', '/fresh.jpg')
    fireEvent.pointerDown(viewer)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('handles a shrinking or empty photo set and omits unused arrows and thumbnails', async () => {
    const user = userEvent.setup()
    const view = render(<PhotoGallery photos={[...photos, { id: 3, url: '/three.jpg', caption: 'Third room' }]} />)
    await user.click(screen.getByRole('button', { name: 'Show photo 3: Third room' }))
    view.rerender(<PhotoGallery photos={photos} />)
    await user.click(screen.getByRole('button', { name: 'Next photo' }))
    expect(screen.getByText('Photo 1 of 2')).toBeVisible()
    view.rerender(<PhotoGallery photos={[photos[0]]} />)
    expect(screen.queryByRole('button', { name: 'Next photo' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Show photo/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Enlarge photo 1: First room' }))
    view.rerender(<PhotoGallery photos={[]} />)
    expect(screen.getByText('No listing photos available.')).toBeVisible()
    expect(document.documentElement.style.overflow).toBe('')
  })
})
