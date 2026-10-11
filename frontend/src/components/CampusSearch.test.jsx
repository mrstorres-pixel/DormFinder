import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import CampusSearch from './CampusSearch'

describe('campus search', () => {
  it('selects a specific campus through keyboard autocomplete', async () => {
    const onChange=vi.fn()
    const user=userEvent.setup()
    render(<CampusSearch campuses={[{ id:1,name:'PUP — Mabini',institution_name:'Polytechnic University',aliases:['PUP'],city:'Manila' },{ id:2,name:'PUP — Taguig',aliases:['PUP'],city:'Taguig' }]} onChange={onChange} />)
    await user.type(screen.getByRole('combobox'),'pup manila')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenLastCalledWith('1')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
