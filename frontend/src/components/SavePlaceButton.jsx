import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, writeApi } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { useFavorites } from '../lib/discovery'
import { signInLink } from '../lib/navigation'
import { ErrorNotice } from './Feedback'
import './saved-places.css'

export default function SavePlaceButton({ propertyId, optionId, title = 'listing', compact = false, iconOnly = false }) {
  const { data: user } = useCurrentUser()
  const [params] = useSearchParams()
  const ids = useFavorites()
  const client = useQueryClient()
  const saved = ids.data?.includes(propertyId) || false
  const mutation = useMutation({ mutationFn: async () => {
    if (!saved) { await writeApi('put', '/saved-places/' + propertyId, { room_option_id: optionId || null }); return true }
    const row = (await api.get('/saved-places/' + propertyId)).data.data
    if ((row.note?.trim() || row.contexts?.length) && !window.confirm('Remove this saved place, its private notes and collection entries? Your messages and viewing requests will stay.')) return null
    await writeApi('delete', '/saved-places/' + propertyId, { version: row.version })
    return false
  }, onSuccess: async kept => {
    if (kept === null) return
    client.setQueryData(['favorite-ids', user?.id], current => kept ? [...new Set([...(current || []), propertyId])] : (current || []).filter(id => id !== propertyId))
    await Promise.all([client.invalidateQueries({ queryKey: ['favorite-ids'] }), client.invalidateQueries({ queryKey: ['saved-places'] }), client.invalidateQueries({ queryKey: ['saved-place'] }), client.invalidateQueries({ queryKey: ['favorites'] })])
  } })
  const returnTo = '/listings/' + propertyId + '?' + (optionId ? 'option=' + optionId + '&' : '') + (params.get('campus_id') ? 'campus_id=' + encodeURIComponent(params.get('campus_id')) + '&' : '') + 'save=1'
  if (!user) return <Link className={compact ? 'save-place-guest' : 'btn btn-link btn-sm mt-3'} to={signInLink(returnTo)}>Sign in to save</Link>
  if (user.role !== 'student') return null
  return <div className={(compact ? 'save-place-control is-compact' : 'save-place-control mt-3') + (iconOnly ? ' is-heart-only' : '')}>
    {params.get('save') === '1' && !saved && <p className="small">Save this place to keep it for later.</p>}<ErrorNotice error={ids.error || mutation.error} retry={ids.error ? () => ids.refetch() : undefined} />
    <button type="button" className={'save-heart ' + (compact ? 'save-place-compact' : 'btn btn-outline-primary btn-sm')} aria-label={(saved ? 'Unsave place ' : 'Save place ') + title} aria-pressed={saved} disabled={ids.isPending || !!ids.error || mutation.isPending} onClick={() => mutation.mutate()}><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>{!iconOnly && <span>{mutation.isPending ? 'Saving…' : saved ? 'Saved' : 'Save'}</span>}</button>
    {mutation.isSuccess && mutation.data !== null && <span className="save-place-feedback" role="status">{mutation.data ? <>Saved <Link to={'/saved?place=' + propertyId}>Organize</Link></> : 'Removed from saved places'}</span>}
  </div>
}
