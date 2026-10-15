import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, writeApi } from '../lib/api'
import useUnsavedChanges from '../lib/useUnsavedChanges'
import Avatar from './Avatar'
import { ErrorNotice } from './Feedback'

export default function ProfilePhoto({ user }) {
  const [file, setFile] = useState(null)
  const clear = useUnsavedChanges(!!file)
  const input = useRef(null)
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['profile-avatar', user.id], queryFn: async () => (await api.get('/me/avatar')).data.data, retry: false })
  const mutation = useMutation({ mutationFn: action => { if (action === 'delete') return writeApi('delete', '/me/avatar'); const form = new FormData(); form.set('photo', file); return writeApi('post', '/me/avatar', form) }, onSuccess: data => {
    clear(); setFile(null); if (input.current) input.current.value = ''
    client.setQueryData(['profile-avatar', user.id], data)
    client.setQueryData(['me'], current => current ? { ...current, avatar_url: data.avatar_url } : current)
    client.invalidateQueries({ queryKey: ['inquiries'] }); client.invalidateQueries({ queryKey: ['inquiry'] }); client.invalidateQueries({ queryKey: ['inquiry-messages'] })
  } })
  return <section className="settings-section" aria-labelledby="profile-photo-heading"><div><h2 id="profile-photo-heading">Profile photo</h2><p>Shown to people you message.</p></div><div><div className="profile-photo-controls"><Avatar src={query.data?.avatar_url || user.avatar_url} name={user.name} size="large" /><form onSubmit={event => { event.preventDefault(); mutation.mutate('upload') }}><label className="form-label" htmlFor="profile-photo">Choose a photo</label><input ref={input} id="profile-photo" type="file" className="form-control" accept="image/jpeg,image/png,image/webp" disabled={mutation.isPending} onChange={event => { setFile(event.target.files[0] || null); mutation.reset() }} /><div className="profile-photo-actions"><button className="btn btn-outline-primary btn-sm" disabled={!file || mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save photo'}</button>{query.data?.has_avatar && <button className="btn btn-link btn-sm" type="button" disabled={mutation.isPending || !!file} onClick={() => mutation.mutate('delete')}>Remove photo</button>}{file && <button type="button" className="btn btn-link btn-sm" disabled={mutation.isPending} onClick={() => { clear(); setFile(null); input.current.value = ''; mutation.reset() }}>Cancel</button>}</div></form></div><p className="form-text">JPEG, PNG or WebP · up to 3 MB</p><ErrorNotice error={query.error} retry={() => query.refetch()} /><ErrorNotice error={mutation.error} />{mutation.isSuccess && <p role="status" className="small text-success">{mutation.data.has_avatar ? 'Profile photo saved.' : 'Profile photo removed.'}</p>}</div></section>
}
