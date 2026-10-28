import { amenities } from '../lib/housing'

export default function ListingInformation({ property, headingLevel = 2 }) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2'
  const Subheading = headingLevel === 3 ? 'h4' : 'h3'
  return <section className="panel mb-4"><Heading>Amenities and house rules</Heading>
    <p className="small text-secondary">Facilities are declared by the owner. Confirm access and terms before deciding.</p>
    {property.amenities == null ? <p>Amenities: Not provided.</p> : property.amenities.length ? <ul className="amenity-list">{property.amenities.map(key => <li key={key}>{amenities[key] || key}</li>)}</ul> : <p>No listed shared amenities.</p>}
    <Subheading>House rules</Subheading><p className="preserve-lines">{property.house_rules || 'Not provided. Ask the owner about visitors, quiet hours, and other restrictions.'}</p>
  </section>
}
