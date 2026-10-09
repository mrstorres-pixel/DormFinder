import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PhotoGallery, SearchFilters } from './Discovery'
import { cleanSelections, parseSelections } from '../lib/comparison'

describe('discovery controls', () => {
  it('requires a consistent price basis and converts decimal rent exactly', async () => {
    const onSearch = vi.fn()
    const user = userEvent.setup()
    render(<SearchFilters params={new URLSearchParams('page=3')} onSearch={onSearch} />)
    await user.type(screen.getByLabelText('Maximum monthly rent (PHP)'), '3500.29')
    await user.click(screen.getByRole('button', { name: 'Search', exact: true }))
    expect(onSearch).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a price basis')
    await user.selectOptions(screen.getByLabelText('Price basis'), 'per_person')
    await user.click(screen.getByLabelText('Available units confirmed within 14 days'))
    await user.click(screen.getByRole('button', { name: 'Search', exact: true }))
    expect(onSearch).toHaveBeenLastCalledWith({ max_rent_centavos: '350029', price_basis: 'per_person', available_only: '1', sort: 'newest' })
  })

  it('rejects malformed amounts without sending a request', async () => {
    const onSearch = vi.fn()
    const user = userEvent.setup()
    render(<SearchFilters params={new URLSearchParams()} onSearch={onSearch} />)
    await user.type(screen.getByLabelText('Minimum monthly rent (PHP)'), '1e3')
    await user.click(screen.getByRole('button', { name: 'Search', exact: true }))
    expect(screen.getByRole('alert')).toHaveTextContent('at most two decimal places')
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('offers keyboard and button gallery navigation and refresh for failed photos', async () => {
    const user = userEvent.setup()
    const refresh = vi.fn()
    render(<PhotoGallery refresh={refresh} photos={[{ id: 1, url: '/one.jpg', caption: 'First room' }, { id: 2, url: '/two.jpg', caption: 'Second room' }]} />)
    await user.click(screen.getByRole('button', { name: 'Next photo' }))
    expect(screen.getByText('Photo 2 of 2')).toBeInTheDocument()
    screen.getByRole('region', { name: 'Property photo gallery' }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByText('Photo 1 of 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show photo 2: Second room' }))
    expect(screen.getByAltText('Second room')).toBeInTheDocument()
    fireEvent.error(screen.getByAltText('Second room'))
    await user.click(screen.getByRole('button', { name: 'Refresh photo links' }))
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('rejects corrupt, duplicate and excess comparison selections', () => {
    expect(cleanSelections([{ property_id: -1, room_option_id: 1 }, null])).toEqual([])
    const selections = parseSelections('1:2,1:4,2:3,3:4,4:5')
    expect(cleanSelections(selections)).toEqual([{ property_id: 1, room_option_id: 2 }, { property_id: 2, room_option_id: 3 }, { property_id: 3, room_option_id: 4 }])
    expect(cleanSelections(parseSelections('1:2:3'))).toEqual([])
  })
})
