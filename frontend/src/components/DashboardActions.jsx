import { Link } from 'react-router-dom'
import { browseLink } from '../lib/housing'

export default function DashboardActions({ user, counts = {} }) {
  if (!user) return null
  const actions = user.role === 'student' ? [
    user.preferred_campus_id ? { title: 'Find housing near your campus', text: 'Start with matching options within 2 km of your saved campus.', to: browseLink(user.preferred_campus_id) } : { title: 'Choose your college or university', text: 'Save a campus to start your search with nearby recommendations.', to: '/profile' },
    { title: 'Organize private shortlists', text: 'Group saved room options and keep your personal notes.', to: '/shortlists' },
    { title: 'Track property viewings', text: counts.pending_viewings > 0 ? counts.pending_viewings + ' proposed times await your decision.' : counts.upcoming_viewings > 0 ? counts.upcoming_viewings + ' agreed visits to prepare for.' : 'Arrange a visit from a room you like.', to: counts.pending_viewings > 0 ? '/viewings?status=proposed' : '/viewings' },
    { title: 'Compare your shortlist', text: 'Check the monthly rent, move-in costs and price basis side by side.', to: '/compare' },
    { title: 'Continue your conversations', text: counts.awaiting_reply > 0 ? counts.awaiting_reply + (counts.awaiting_reply === 1 ? ' conversation awaits your response.' : ' conversations await your response.') : 'Read owner replies and ask about the room option you need.', to: '/inquiries' },
  ] : user.role === 'landlord' ? [
    { title: 'Prepare your listings', text: `${Number(counts.listings?.draft || 0) + Number(counts.listings?.rejected || 0)} drafts or returned listings need preparation before review.`, to: '/landlord' },
    { title: 'Manage property viewings', text: (counts.pending_viewings || 0) + ' requests await your decision.', to: '/viewings' },
    { title: 'Refresh availability', text: (counts.stale_listings || 0) + ' public listings have availability needing confirmation.', to: '/landlord' },
    { title: 'Respond to students', text: 'Use private inquiries to answer questions about costs and availability.', to: '/inquiries' },
    { title: 'Check your updates', text: 'Read review decisions and reminders, then open the affected listing.', to: '/notifications' },
  ] : [
    { title: 'Review submissions', text: `${counts.pending_reviews || 0} listings await content and completeness checks.`, to: '/admin' },
    { title: 'Follow up on reports', text: `${counts.open_reports || 0} open reports need assessment and a private outcome.`, to: '/admin/reports' },
    { title: 'Check moderation history', text: 'Review recorded decisions before taking further action.', to: '/admin/audit' },
  ]
  if (user.role === 'student') {
    const priority = action => action.title === 'Track property viewings' && counts.pending_viewings > 0 ? 0 : action.title === 'Continue your conversations' && counts.awaiting_reply > 0 ? 1 : 2
    actions.sort((a, b) => priority(a) - priority(b))
  }
  return <section className="mt-4 mb-4 dashboard-actions" aria-labelledby="dashboard-next-steps"><h2 id="dashboard-next-steps" className="section-title">Your next steps</h2>
    <div className="row g-3">{actions.map(action => <div className="col-md-4" key={action.title}><article className="panel h-100"><h3 className="h5"><Link to={action.to}>{action.title}</Link></h3><p className="small text-secondary mb-0">{action.text}</p></article></div>)}</div>
    {user.role === 'student' && user.preferred_campus_id && <Link className="small d-inline-block mt-3" to="/profile">Change your saved campus</Link>}
  </section>
}
