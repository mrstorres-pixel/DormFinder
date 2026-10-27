import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, Link, Outlet, RouterProvider, useNavigate } from 'react-router-dom'
import UnsavedChangesProvider from './UnsavedChangesProvider'
import useUnsavedChanges, { useDiscardChanges, useClearUnsavedChanges } from '../lib/useUnsavedChanges'

function Editor({ onSave }) {
  const [dirty, setDirty] = useState(false)
  const clear = useUnsavedChanges(dirty, onSave ? async () => { const saved = await onSave(); if (saved) setDirty(false); return saved } : undefined)
  const navigate = useNavigate()
  const discard = useDiscardChanges()
  const clearAll = useClearUnsavedChanges()
  return <><input aria-label="Draft" onChange={() => setDirty(true)} /><Link to="/away">Away</Link>
    <button onClick={() => navigate('/away')}>Redirect</button>
    <button onClick={() => { clear(); setDirty(false); navigate('/away') }}>Save</button>
    <button onClick={() => { if (discard()) { clearAll(); navigate('/away') } }}>Sign out</button></>
}
function mount(onSave) {
  const router = createMemoryRouter([{ element: <UnsavedChangesProvider><Outlet /></UnsavedChangesProvider>, children: [
    { path: '/edit', element: <Editor onSave={onSave} /> }, { path: '/away', element: <h1>Away page</h1> },
  ] }], { initialEntries: ['/away', '/edit'], initialIndex: 1 })
  render(<RouterProvider router={router} />)
  fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'unsaved' } })
  return router
}
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => vi.restoreAllMocks())
describe('unsaved edit navigation', () => {
  it('saves before proceeding to the requested destination and retains edits after a failed save', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce(true)
    mount(save)
    fireEvent.click(screen.getByRole('link', { name: 'Away' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save and leave' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your edits are kept')
    expect(screen.getByLabelText('Draft')).toHaveValue('unsaved')
    expect(screen.queryByRole('heading', { name: 'Away page' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save and leave' }))
    expect(await screen.findByRole('heading', { name: 'Away page' })).toBeVisible()
    expect(save).toHaveBeenCalledTimes(2)
  })
  it('retains edits after cancelling a link and discards only after confirmation', async () => {
    mount()
    fireEvent.click(screen.getByRole('link', { name: 'Away' }))
    expect(await screen.findByRole('dialog')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Stay and edit' }))
    expect(screen.getByLabelText('Draft')).toHaveValue('unsaved')
    fireEvent.click(screen.getByRole('link', { name: 'Away' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Discard and leave' }))
    expect(await screen.findByRole('heading', { name: 'Away page' })).toBeVisible()
  })
  it('protects browser history navigation', async () => {
    const router = mount()
    await act(() => router.navigate(-1))
    expect(await screen.findByRole('dialog')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Stay and edit' }))
    expect(router.state.location.pathname).toBe('/edit')
  })
  it('protects programmatic redirects', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Redirect' }))
    expect(await screen.findByRole('dialog')).toBeVisible()
  })
  it('allows a successful save to navigate without an outdated warning', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('heading', { name: 'Away page' })).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('checks sign-out before leaving the editor', async () => {
    mount()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(screen.getByLabelText('Draft')).toHaveValue('unsaved')
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'Away page' })).toBeVisible()
  })
  it('warns on document unload only while edits remain', () => {
    mount()
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
})
