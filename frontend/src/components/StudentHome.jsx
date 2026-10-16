import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { browseLink } from '../lib/housing'
import { viewingLabel } from '../lib/practical'
import Avatar from './Avatar'
import SavedPlaceCard from './SavedPlaceCard'
import { ErrorNotice, Loading } from './Feedback'
import './student-space.css'

function useHomeCollection(userId, collection, params = {}) {
  return useQuery({ queryKey: [collection, 'student-home', userId, params], queryFn: async () => (await api.get('/' + collection, { params })).data, enabled: !!userId, retry: false, refetchInterval: 60_000 })
}

function UpcomingViewings({ userId }) {
  const proposals = useHomeCollection(userId, 'viewings', { status: 'proposed' })
  const accepted = useHomeCollection(userId, 'viewings', { status: 'accepted' })
  const future = rows => (rows || []).filter(row => !row.time_passed && new Date(row.starts_at).getTime() > Date.now()).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
  const decisions = future(proposals.data?.data).slice(0, 2)
  const visits = future(accepted.data?.data).slice(0, 2)
  const hasMore = proposals.data?.meta?.last_page > 1 || accepted.data?.meta?.last_page > 1
  if (!proposals.isPending && !accepted.isPending && !proposals.error && !accepted.error && !decisions.length && !visits.length && !hasMore) return null
  return <section className="space-activity" aria-labelledby="home-viewings"><div className="space-section-heading"><h2 id="home-viewings">Recent viewings</h2></div>
    {(proposals.isPending || accepted.isPending) && <Loading>Checking your viewings…</Loading>}
    {proposals.error && <><p>Suggested viewing times could not load.</p><ErrorNotice error={proposals.error} retry={() => proposals.refetch()} /></>}
    {accepted.error && <><p>Agreed viewing times could not load.</p><ErrorNotice error={accepted.error} retry={() => accepted.refetch()} /></>}
    {[...decisions, ...visits].map(viewing => <article className="space-viewing" key={viewing.id}>
      <span className={'space-status' + (viewing.status === 'proposed' ? ' needs-response' : '')}>{!viewing.can_schedule ? 'Scheduling paused' : viewing.status === 'proposed' ? 'New time to review' : 'Time agreed'}</span>
      <h3>{viewing.listing_snapshot.title}</h3><p>{viewing.listing_snapshot.room_name}</p><time dateTime={viewing.starts_at}>{viewingLabel(viewing.starts_at)}</time>
      <Link className="btn btn-outline-primary btn-sm" to={'/viewings?status=' + viewing.status + '#viewing-' + viewing.id}>{viewing.status === 'proposed' ? 'Review suggested time' : 'View visit details'}<span className="visually-hidden"> for {viewing.listing_snapshot.title}</span></Link>
    </article>)}
    {hasMore && <p className="space-quiet-note">Recent requests shown.</p>}
  </section>
}

function RecentConversations({ userId }) {
  const query = useHomeCollection(userId, 'inquiries')
  const rows = [...(query.data?.data || [])].sort((a, b) => Number(!!b.awaiting_reply && b.can_reply) - Number(!!a.awaiting_reply && a.can_reply)).slice(0, 3)
  if (!query.isPending && !query.error && !rows.length) return null
  return <section className="space-activity" aria-labelledby="home-conversations"><div className="space-section-heading"><h2 id="home-conversations">Recent messages</h2></div>
    {query.isPending ? <Loading>Checking your conversations…</Loading> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : <div className="space-conversations">{rows.map(thread => <Link className="space-conversation" to={'/inquiries/' + thread.id} key={thread.id}><Avatar src={thread.participant_avatar_url} name={thread.participant_name} /><div><h3>{thread.participant_name}</h3><p>{thread.listing_snapshot.title}</p><span className={'space-conversation-state' + (thread.awaiting_reply && thread.can_reply ? ' needs-response' : '')}>{!thread.can_reply ? 'Conversation paused' : thread.last_message_body || 'Open conversation'}</span>{thread.awaiting_reply && thread.can_reply && <small className="inbox-reply-needed">Reply waiting</small>}</div></Link>)}</div>}
  </section>
}

function SavedPlaces({ user }) {
  const query = useHomeCollection(user.id, 'saved-places')
  const rows = query.data?.data || []
  return <section className="space-saved" aria-labelledby="home-saved"><div className="space-section-heading"><h2 id="home-saved">Saved places</h2><Link to="/saved">See all<span className="visually-hidden"> saved places</span> →</Link></div>
    {query.isPending ? <Loading>Loading your saved places…</Loading> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : rows.length ? <div className="space-saved-grid">{rows.slice(0, 4).map(row => <SavedPlaceCard key={row.property_id} row={row} compact />)}</div> : <div className="space-saved-empty"><span aria-hidden="true">♡</span><h3>Found a place you like?</h3><p>Save it while you browse. Come back here when you’re ready to decide.</p><Link className="btn btn-outline-primary" to={user.preferred_campus_id ? browseLink(user.preferred_campus_id) : '/listings'}>Explore places →</Link></div>}
  </section>
}

export default function StudentHome({ user }) {
  return <div className="student-space container page-space">
    <header className="space-introduction"><div className="space-person"><Avatar src={user.avatar_url} name={user.name} size="large" /><div><h1>Your space</h1><p>{user.name}</p></div></div><Link className="btn btn-outline-primary btn-sm" to="/profile">Edit profile</Link></header>
    <div className="space-content"><aside className="space-updates" aria-label="Your conversations and viewings"><UpcomingViewings userId={user.id} /><RecentConversations userId={user.id} /></aside><SavedPlaces user={user} /></div>
  </div>
}
