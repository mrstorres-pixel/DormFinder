import { amenities } from '../lib/housing'

export default function ListingInformation({ property }) {
  return <section className="panel mb-4"><h2>Amenities and house rules</h2>
    <p className="small text-secondary">Facilities are declared by the owner. Confirm access and terms before deciding.</p>
    {property.amenities == null ? <p>Amenities: Not provided.</p> : property.amenities.length ? <ul className="amenity-list">{property.amenities.map(key => <li key={key}>{amenities[key] || key}</li>)}</ul> : <p>No listed shared amenities.</p>}
    <h3>House rules</h3><p className="preserve-lines">{property.house_rules || 'Not provided. Ask the owner about visitors, quiet hours, and other restrictions.'}</p>
  </section>
}
