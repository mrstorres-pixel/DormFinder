import { Link } from 'react-router-dom'

export default function PropertyContext({ title, room, address, participant, to, headingAs: Heading = 'h2', children }) {
  return <div className="property-context"><span className="property-context-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M3 10l9-7 9 7v10H3V10zM9 20v-7h6v7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg></span><div className="property-context-copy"><Heading>{to ? <Link to={to}>{title}</Link> : title}</Heading>{room && <p className="context-room">{room}</p>}{address && <p className="context-address">{address}</p>}{participant && <p className="context-person">With {participant}</p>}{children}</div></div>
}
