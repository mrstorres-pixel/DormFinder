import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { writeApi } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { useFavorites } from '../lib/discovery'
import { signInLink } from '../lib/navigation'
import { ErrorNotice } from './Feedback'
import './saved-places.css'

export default function SavePlaceButton({ propertyId, optionId, title = 'listing', compact = false }) {
  const { data: user } = useCurrentUser()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const ids = useFavorites()
  const client = useQueryClient()
  const saved = ids.data?.includes(propertyId) || false
  const mutation = useMutation({ mutationFn: () => writeApi('put', '/saved-places/' + propertyId, { room_option_id: optionId || null }), onSuccess: async () => {
    client.setQueryData(['favorite-ids', user?.id], current => [...new Set([...(current || []), propertyId])])
    await Promise.all([client.invalidateQueries({ queryKey: ['favorite-ids'] }), client.invalidateQueries({ queryKey: ['saved-places'] }), client.invalidateQueries({ queryKey: ['saved-place'] }), client.invalidateQueries({ queryKey: ['favorites'] })])
  } })
  const returnTo = '/listings/' + propertyId + '?' + (optionId ? 'option=' + optionId + '&' : '') + (params.get('campus_id') ? 'campus_id=' + encodeURIComponent(params.get('campus_id')) + '&' : '') + 'save=1'
  if (!user) return <Link className={compact ? 'save-place-guest' : 'btn btn-link btn-sm mt-3'} to={signInLink(returnTo)}>Sign in to save</Link>
  if (user.role !== 'student') return null
  return <div className={compact ? 'save-place-control is-compact' : 'save-place-control mt-3'}>
    {params.get('save') === '1' && !saved && <p className="small">Save this place to keep it for later.</p>}<ErrorNotice error={ids.error || mutation.error} retry={ids.error ? () => ids.refetch() : undefined} />
    <button type="button" className={compact ? 'save-place-compact' : 'btn btn-outline-primary btn-sm'} aria-label={(saved ? 'Edit saved place ' : 'Save place ') + title} aria-pressed={saved} disabled={ids.isPending || !!ids.error || mutation.isPending} onClick={() => saved ? navigate('/saved?place=' + propertyId) : mutation.mutate()}>{mutation.isPending ? 'Saving…' : saved ? '♥ Saved' : '♡ Save'}</button>
    {mutation.isSuccess && <span className="save-place-feedback" role="status">Saved <Link to={'/saved?place=' + propertyId}>Organize</Link></span>}
  </div>
}
