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
    await user.click(screen.getByRole('button', { name: /^Filters/ }))
    await user.type(screen.getByLabelText('Maximum monthly rent (PHP)'), '3500.29')
    await user.click(screen.getByRole('button', { name: 'Apply filters', exact: true }))
    expect(onSearch).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a price basis')
    await user.selectOptions(screen.getByLabelText('Price basis'), 'per_person')
    await user.click(screen.getByLabelText('Available units confirmed within 14 days'))
    await user.click(screen.getByRole('button', { name: 'Apply filters', exact: true }))
    expect(onSearch).toHaveBeenLastCalledWith({ max_rent_centavos: '350029', price_basis: 'per_person', available_only: '1', sort: 'newest' })
  })

  it('keeps entered mobile filters when collapsed and reopened', async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 })
    const user = userEvent.setup()
    render(<SearchFilters params={new URLSearchParams()} onSearch={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /^Filters/ }))
    await user.type(screen.getByLabelText('Maximum monthly rent (PHP)'), '6500')
    await user.selectOptions(screen.getByLabelText('Price basis'), 'per_person')
    await user.click(screen.getByRole('button', { name: 'Close filters' }))
    await user.click(screen.getByRole('button', { name: /^Filters/ }))
    expect(screen.getByLabelText('Maximum monthly rent (PHP)')).toHaveValue('6500')
    expect(screen.getByLabelText('Price basis')).toHaveValue('per_person')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
  })

  it('rejects malformed amounts without sending a request', async () => {
    const onSearch = vi.fn()
    const user = userEvent.setup()
    render(<SearchFilters params={new URLSearchParams()} onSearch={onSearch} />)
    await user.click(screen.getByRole('button', { name: /^Filters/ }))
    await user.type(screen.getByLabelText('Minimum monthly rent (PHP)'), '1e3')
    await user.click(screen.getByRole('button', { name: 'Apply filters', exact: true }))
    expect(screen.getByRole('alert')).toHaveTextContent('at most two decimal places')
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('keeps the applied map bounds when refining the same campus', async () => {
    const onSearch = vi.fn()
    const user = userEvent.setup()
    render(<SearchFilters params={new URLSearchParams('campus_id=1&radius_km=2&south=14&north=15&west=120&east=121&page=3')} onSearch={onSearch} />)
    await user.click(screen.getByRole('button', { name: /^Filters/ }))
    await user.click(screen.getByLabelText('Wi-Fi'))
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    const result = onSearch.mock.calls[0][0]
    expect(result.get('south')).toBe('14')
    expect(result.get('east')).toBe('121')
    expect(result.get('campus_id')).toBe('1')
    expect(result.getAll('amenities[]')).toEqual(['wifi'])
    expect(result.has('page')).toBe(false)
  })

  it('clears the advanced draft until applied while retaining the separately selected campus', async () => {
    const onSearch = vi.fn()
    const user = userEvent.setup()
    render(<SearchFilters params={new URLSearchParams('campus_id=1&radius_km=2&q=DEMO&price_basis=per_person&max_rent_centavos=500000&amenities[]=wifi&sort=rent_asc')} onSearch={onSearch} />)
    await user.click(screen.getByRole('button', { name: /^Filters/ }))
    await user.click(screen.getAllByRole('button', { name: 'Clear filters', exact: true })[0])
    expect(onSearch).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Maximum monthly rent (PHP)')).toHaveValue('')
    expect(screen.getByLabelText('Wi-Fi')).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(onSearch).toHaveBeenCalledWith({ campus_id: '1', sort: 'newest' })
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
