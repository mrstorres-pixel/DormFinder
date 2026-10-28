import { errorMessage } from '../lib/api'
import { walkingLabel } from '../lib/walking'
import { hasLocationPin } from '../lib/listingReadiness'

export default function WalkingRouteControl({ walking, property, campus }) {
  if (!property || !campus) return null
  if (!hasLocationPin(property)) return <p className="location-check-note">The property location needs correction. Use the address or ask the owner for directions.</p>
  return <section className="walking-route-control" aria-label="Walk to campus">
    <div className="walking-route-actions">
      {!walking.route && <button className="btn btn-outline-primary btn-sm" disabled={walking.loading} onClick={walking.show}>{walking.loading ? 'Finding walking route…' : walking.error ? 'Try walking route again' : 'Walk to campus'}</button>}
      {walking.active && <button className="btn btn-link btn-sm" onClick={walking.clear}>Clear route</button>}
    </div>
    <div role="status" aria-live="polite">
      {walking.route && <><strong>{walkingLabel(walking.route)}</strong><p>To {campus.name}’s approximate reference. Dashed connections to pins are outside the walking estimate; confirm the entrance and access with the owner.</p></>}
      {walking.error && <p>{errorMessage(walking.error)}</p>}
    </div>
    {walking.active && <p className="walking-attribution">Walking routes: <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noreferrer">FOSSGIS / OSRM</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>. Only these public pins are sent for routing.</p>}
  </section>
}
