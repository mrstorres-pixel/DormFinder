import { Link } from 'react-router-dom'
import { availabilityInfo } from '../lib/availability'
import './availability.css'

export default function AvailabilityStatus({ option, askHref, browse }) {
  const { label, stale, expired, date } = availabilityInfo(option)
  const fullDate = date ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(date)) + ' PHT' : null
  return <p className={'availability-freshness' + (stale || expired ? ' needs-confirmation' : '')}>
    <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10" cy="10" r="7.4" />{stale || expired ? <path d="M10 5.5v4.8l3 1.8" /> : <path d="m6.5 10 2.2 2.2 4.8-4.8" />}</svg>
    {date ? <time dateTime={date} title={'Owner confirmation: ' + fullDate}>{label}</time> : <span>{label}</span>}
    {stale && !expired && date && <span className="freshness-caution">Needs confirmation</span>}
    {expired && <span className="freshness-caution">Confirmation expired</span>}
    {askHref && stale && !expired && <Link to={askHref} state={browse ? { browse } : undefined}>Ask owner</Link>}
  </p>
}

export function OwnerAvailability({ property, compact = false }) {
  const state = property.availability
  if (property.status !== 'approved' || !state) return null
  const hidden = state.status === 'hidden', due = state.status === 'needs_confirmation'
  const taken = property.room_options?.length > 0 && property.room_options.every(option => option.available_units === 0)
  const expires = state.hides_at ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(state.hides_at)) : null
  return <div className={'owner-availability' + (hidden || due ? ' needs-confirmation' : '')} role="status">
    <strong>{hidden ? 'Hidden from students' : taken ? 'All room options are taken' : state.hidden_rooms ? 'Some room options are hidden' : due ? 'Availability needs an update' : 'Availability is up to date'}</strong>
    <p>{hidden ? 'Confirm current vacancies to show this listing again.' : due ? `${state.rooms_needing_confirmation} room ${state.rooms_needing_confirmation === 1 ? 'option needs' : 'options need'} confirmation.${state.hidden_rooms ? ` ${state.hidden_rooms} already hidden.` : ''}` : expires ? `Availability expires ${expires}.` : 'Reconfirm vacancies every 14 days.'}</p>
    {due && expires && <p>Listing hides {expires} without another availability confirmation.</p>}
    {!compact && <p className="owner-availability-policy">Confirm each room’s actual vacancies below. After 14 days we’ll remind you; room options are hidden after 30 days without confirmation. Your messages and viewing requests stay available.</p>}
  </div>
}
