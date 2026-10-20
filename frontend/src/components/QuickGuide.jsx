import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCurrentUser } from '../lib/auth'

const guides = {
  student: [
    ['Find your place', 'Search a campus, neighborhood or dorm name. Select a campus to see distances and walking routes.', '/listings', 'Browse places'],
    ['Keep your favorites', 'Tap the heart to save a place. Add private notes or group your options in collections.', '/saved', 'Your saved places'],
    ['Meet the owner', 'Open a listing and choose Message owner or Request a viewing. Track replies and confirmed visits in the navigation.', '/inquiries', 'Your messages'],
  ],
  landlord: [
    ['Build your listing', 'Add photos, room prices and a property pin. Save and continue keeps each step before you move on.', '/landlord/properties/new', 'Add a property'],
    ['Send it for review', 'The preview explains anything missing. Submit when the listing is complete; approval makes it visible to students.', '/landlord', 'Your properties'],
    ['Stay in touch', 'Reply to students, manage viewing requests and confirm vacancies regularly. Listings with no availability update for 30 days are hidden.', '/viewings', 'Your viewings'],
  ],
}

export default function QuickGuide({ standalone = false }) {
  const { data: user } = useCurrentUser()
  const location = useLocation()
  const [dismissed, setDismissed] = useState(false)
  const guide = guides[user?.role]
  if (!guide || (!standalone && (!location.state?.showGuide || dismissed))) return null
  return <section className={'quick-guide' + (standalone ? ' container page-space' : '')} aria-label="Getting started with DormFinder">
    <div className="guide-heading"><div><span className="eyebrow">A QUICK START</span><h2>{standalone ? 'Make yourself at home.' : 'Your profile is ready. Here is where to start.'}</h2></div>{!standalone && <button type="button" className="guide-dismiss" onClick={() => setDismissed(true)} aria-label="Dismiss getting started guide">×</button>}</div>
    <ol>{guide.map(([title, description, to, label], index) => <li key={title}><span className="guide-number" aria-hidden="true">0{index + 1}</span><h3>{title}</h3><p>{description}</p><Link to={to}>{label} →</Link></li>)}</ol>
    {!standalone && <p className="guide-replay">You can open this guide again from the footer.</p>}
  </section>
}
