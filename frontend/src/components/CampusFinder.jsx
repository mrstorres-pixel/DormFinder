import { Link } from 'react-router-dom'
import HousingSearchForm from './HousingSearchForm'

export default function CampusFinder() {
  return <section className="container page-space finder-page"><div className="finder-intro"><Link className="back-link" to="/">← Home</Link><span className="eyebrow">A PLACE NEAR YOUR CAMPUS</span><h1>Campus housing finder</h1><p>Tell us where you're studying and what fits your student life. You can refine your choices as you explore.</p><div className="finder-explanation"><h2>Your search stays yours.</h2><p>Results keep your campus, distance and preferences. Compare rooms, understand the costs, then ask the owner or arrange a visit.</p><p className="small">Choose a specific campus branch. Open a listing to calculate walking directions to its campus reference point.</p></div><Link to="/listings">Explore all listings instead →</Link></div><div><HousingSearchForm /><Link className="campus-missing-link" to="/campuses/suggest">Missing a campus or branch? Suggest it for review</Link></div></section>
}
