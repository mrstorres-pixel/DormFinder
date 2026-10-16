import { useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { writeApi } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { comparisonItems, useComparison } from '../lib/comparison'
import { pesos } from '../lib/money'
import { signInLink } from '../lib/navigation'
import { ErrorNotice, Field } from './Feedback'
import ActionDialog from './ActionDialog'
import { AddToShortlist } from './Shortlists'
import { RequestViewing } from './Viewings'

function MessageOwner({ property, option }) {
  const trigger = useRef(null)
  const { data: user } = useCurrentUser()
  const navigate = useNavigate()
  const { hash } = useLocation()
  const draftKey = 'dormfinder-inquiry-' + user.id + '-' + property.id + '-' + option.id
  const [body, setBody] = useState(() => { try { return sessionStorage.getItem(draftKey) || '' } catch { return '' } })
  const [open, setOpen] = useState(() => (!!body && hash !== '#request-viewing') || hash === '#message-owner')
  const [identity, setIdentity] = useState({ body: '', id: '' })
  const mutation = useMutation({ mutationFn: data => writeApi('post', '/listings/' + property.id + '/inquiries', data), onSuccess: data => { try { sessionStorage.removeItem(draftKey) } catch { /* Storage is optional. */ } navigate('/inquiries/' + data.id) } })
  function send(event) {
    event.preventDefault()
    const id = identity.body === body && identity.id ? identity.id : crypto.randomUUID()
    setIdentity({ body, id }); mutation.mutate({ room_option_id: option.id, body, client_id: id })
  }
  return <><button ref={trigger} type="button" className="btn btn-outline-primary listing-message-button" onClick={() => setOpen(true)}>Message owner</button>
    <ActionDialog returnFocus={trigger} open={open} title="Message owner" onClose={() => setOpen(false)}><p className="action-room-context"><strong>{property.title}</strong><span>{option.name}</span></p>
      <form onSubmit={send}><ErrorNotice error={mutation.error} />{[401, 419].includes(mutation.error?.response?.status) && <Link to={signInLink('/listings/' + property.id + '?option=' + option.id + '#message-owner')}>Sign in again to continue</Link>}
        <Field name="inquiry-body" label="Your question" as="textarea" rows={4} maxLength={3000} required disabled={mutation.isPending} value={body} onChange={event => { setBody(event.target.value); try { sessionStorage.setItem(draftKey, event.target.value) } catch { /* Storage is optional. */ } }} />
        <p className="action-fine-print">Your message is private to you and the owner. An unsent draft stays in this tab.</p><button className="btn btn-primary w-100" disabled={mutation.isPending || !body.trim()}>{mutation.isPending ? 'Sending…' : 'Send private inquiry'}</button>
      </form></ActionDialog></>
}

export default function ListingActions({ property, option, campus, onDirtyChange }) {
  const { data: user } = useCurrentUser()
  const { selections, choose } = useComparison()
  const selected = selections.some(row => row.property_id === property.id)
  const returnTo = '/listings/' + property.id + '?option=' + option.id + (campus ? '&campus_id=' + campus.id : '')
  return <div className="listing-primary-actions">
    {user?.role === 'student' ? <><RequestViewing property={property} option={option} onDirtyChange={onDirtyChange} /><MessageOwner property={property} option={option} /></> : <><Link className="btn btn-primary" to={signInLink(returnTo + '#request-viewing')}>Request a viewing</Link><Link className="btn btn-outline-primary" to={signInLink(returnTo + '#message-owner')}>Message owner</Link><div className="listing-mobile-action"><span><strong>{pesos(option.monthly_rent_centavos).replace(/\.00$/, '')}</strong><small>/ month · {option.price_basis === 'per_person' ? 'per person' : 'per room'}</small></span><Link className="btn btn-primary" to={signInLink(returnTo + '#request-viewing')}>Request a viewing</Link></div></>}
    <div className="listing-small-actions">{user?.role === 'student' && <AddToShortlist property={property} option={option} />}<button type="button" aria-pressed={selected} disabled={!selected && selections.length >= 3} onClick={() => choose(property.id, option.id, !selected)}>{selected ? '✓ Added to compare' : '+ Compare'}</button>{selected && <Link to={'/compare?items=' + comparisonItems(selections) + (campus ? '&campus_id=' + campus.id : '')}>Open comparison</Link>}</div>
  </div>
}
