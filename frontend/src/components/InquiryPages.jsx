import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, writeApi } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { ErrorNotice, Field, Loading } from './Feedback'

export function InquiryList() {
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ['inquiries', page], queryFn: async () => (await api.get('/inquiries', { params: { page } })).data, refetchInterval: 30_000 })
  return <section className="container page-space"><span className="eyebrow">PRIVATE CONVERSATIONS</span><h1>Your inquiries</h1><p>Only the student and property owner in each conversation can read or reply.</p>
    {query.isPending ? <Loading /> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : query.data.data.length ? <div className="row g-4">{query.data.data.map(thread => <div className="col-md-6" key={thread.id}><article className="panel"><h2><Link to={'/inquiries/' + thread.id}>{thread.listing_snapshot.title}</Link></h2><p>With {thread.participant_name}</p><p className="small text-secondary">Last message {new Date(thread.last_message_at).toLocaleString('en-PH')} · Listing {thread.property_status.replaceAll('_', ' ')}</p>{!thread.can_reply && <p className="small text-danger">Replies are paused.</p>}</article></div>)}</div> : <div className="panel empty-state"><h2>No conversations yet.</h2><p>Students can ask an owner a question from a reviewed listing.</p><Link to="/listings">Browse listings</Link></div>}
    {query.data?.meta.last_page > 1 && <nav className="d-flex align-items-center gap-3 mt-4" aria-label="Inquiry pages"><button className="btn btn-outline-primary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {query.data.meta.last_page}</span><button className="btn btn-outline-primary" disabled={page >= query.data.meta.last_page} onClick={() => setPage(page + 1)}>Next</button></nav>}
  </section>
}

export function InquiryThread() {
  const { id } = useParams()
  const client = useQueryClient()
  const { data: user } = useCurrentUser()
  const [page, setPage] = useState(1)
  const [body, setBody] = useState('')
  const [identity, setIdentity] = useState({ body: '', id: '' })
  const thread = useQuery({ queryKey: ['inquiry', id], queryFn: async () => (await api.get('/inquiries/' + id)).data.data, refetchInterval: 10_000 })
  const messages = useQuery({ queryKey: ['inquiry-messages', id, page], queryFn: async () => (await api.get(`/inquiries/${id}/messages`, { params: { page } })).data, enabled: !!thread.data, refetchInterval: 10_000 })
  const mutation = useMutation({ mutationFn: data => writeApi('post', `/inquiries/${id}/messages`, data), onSuccess: async () => {
    setBody(''); setIdentity({ body: '', id: '' })
    await client.invalidateQueries({ queryKey: ['inquiry-messages', id] })
    const current = await api.get(`/inquiries/${id}/messages`, { params: { page: 1 } })
    setPage(current.data.meta.last_page)
    await client.invalidateQueries({ queryKey: ['inquiries'] })
  } })
  function send(event) {
    event.preventDefault()
    const clientId = identity.body === body && identity.id ? identity.id : crypto.randomUUID()
    setIdentity({ body, id: clientId }); mutation.mutate({ body, client_id: clientId })
  }
  if (thread.isPending) return <div className="container page-space"><Loading /></div>
  if (thread.error) return <div className="container page-space"><ErrorNotice error={thread.error} retry={() => thread.refetch()} /><Link to="/inquiries">Your inquiries</Link></div>
  return <section className="container page-space narrow-page"><Link to="/inquiries">← Your inquiries</Link><h1 className="mt-4">{thread.data.listing_snapshot.title}</h1><p>Conversation with {thread.data.participant_name}</p><p className="small text-secondary">Original inquiry: {thread.data.listing_snapshot.room_option?.name || 'Property information'}. Listing is now {thread.data.property_status.replaceAll('_', ' ')}. Your original inquiry details remain saved when the listing changes.</p>
    <div className="panel"><h2 className="section-title">Messages</h2>{messages.isPending ? <Loading /> : messages.error ? <ErrorNotice error={messages.error} retry={() => messages.refetch()} /> : <div className="conversation" role="log" aria-label="Conversation messages">{messages.data.data.map(message => <article key={message.id} className={'message ' + (message.sender_id === user?.id ? 'message-own' : '')}><p className="small mb-1"><strong>{message.sender_name}</strong> · {new Date(message.created_at).toLocaleString('en-PH')}</p><p className="preserve-lines mb-0">{message.body}</p></article>)}</div>}
      {messages.data?.meta.last_page > 1 && <nav className="d-flex align-items-center gap-3 my-3" aria-label="Message pages"><button className="btn btn-sm btn-outline-primary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Earlier messages</button><span>Page {page} of {messages.data.meta.last_page}</span><button className="btn btn-sm btn-outline-primary" disabled={page >= messages.data.meta.last_page} onClick={() => setPage(page + 1)}>Later messages</button></nav>}
      <ErrorNotice error={mutation.error} />{thread.data.can_reply ? <form onSubmit={send} className="mt-4"><Field name="reply-body" label="Your reply" as="textarea" rows={3} required maxLength={3000} value={body} onChange={event => setBody(event.target.value)} /><button className="btn btn-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Sending…' : 'Send reply'}</button><p className="small text-secondary mt-3">Keep identity documents, passwords and payment details out of this conversation.</p></form> : <p className="alert alert-warning mt-3">Replies are paused because the listing or a participant is suspended. Earlier messages remain available to participants.</p>}
    </div>
  </section>
}
