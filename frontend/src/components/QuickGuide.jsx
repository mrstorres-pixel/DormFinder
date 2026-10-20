import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '../lib/auth'
import { walkthroughHome } from '../lib/walkthrough'

export default function QuickGuide() {
  const { data: user } = useCurrentUser()
  return user ? <Navigate replace to={walkthroughHome(user.role)} state={{ startWalkthrough: true }} /> : null
}
