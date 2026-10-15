import { useState } from 'react'
import './avatar.css'

function AvatarImage({ src, name, size }) {
  const [failed, setFailed] = useState(false)
  const initials = name?.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '?'
  return <span className={'person-avatar avatar-' + size}>{src && !failed ? <img src={src} alt={'Profile photo of ' + name} onError={() => setFailed(true)} /> : <span role="img" aria-label={'Profile photo placeholder for ' + name}>{initials}</span>}</span>
}

export default function Avatar({ src, name = '', size = 'medium' }) {
  return <AvatarImage key={src || 'initials'} src={src} name={name} size={size} />
}
