import { useLayoutEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, writeApi } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import useUnsavedChanges from '../lib/useUnsavedChanges'
import Avatar from './Avatar'
import { ErrorNotice, Loading } from './Feedback'
import './messaging.css'

const day = date => new Date(date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })
const clock = date => new Date(date).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })

function Inbox({ selectedId }) {
  const { data: user } = useCurrentUser()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('inbox_page')) || 1)
  const query = useQuery({ queryKey: ['inquiries', user?.id, page], queryFn: async () => (await api.get('/inquiries', { params: { page } })).data, enabled: !!user, retry: false, refetchInterval: 30_000 })
  return <aside className="message-inbox" aria-label="Conversations"><div className="inbox-heading"><h1>Messages</h1></div>
    <div className="inbox-scroll">{query.isPending ? <Loading>Loading conversations…</Loading> : query.error ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : query.data.data.length ? <nav aria-label="Message conversations">{query.data.data.map(thread => <Link className={'inbox-person' + (String(thread.id) === selectedId ? ' is-selected' : '')} aria-current={String(thread.id) === selectedId ? 'page' : undefined} to={'/inquiries/' + thread.id + (page > 1 ? '?inbox_page=' + page : '')} key={thread.id}>
      <Avatar src={thread.participant_avatar_url} name={thread.participant_name} /><div className="inbox-copy"><div className="inbox-person-name"><strong>{thread.participant_name}</strong>{thread.last_message_at && <time dateTime={thread.last_message_at}>{new Date(thread.last_message_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })}</time>}</div><span className="inbox-property">{thread.listing_snapshot.title}</span><span className="inbox-preview">{!thread.can_reply ? 'Conversation paused' : thread.last_message_body ? (thread.last_message_is_own ? 'You: ' : '') + thread.last_message_body : 'Open conversation'}</span>{thread.awaiting_reply && thread.can_reply && <span className="inbox-reply-needed">Reply waiting</span>}</div>
    </Link>)}</nav> : <div className="inbox-empty"><span aria-hidden="true">↗</span><h2>No messages yet</h2><p>Conversations with {user?.role === 'landlord' ? 'students' : 'property owners'} will appear here.</p></div>}
    {query.data?.meta?.last_page > 1 && <nav className="inbox-pages" aria-label="Conversation pages"><button type="button" disabled={page <= 1} onClick={() => setParams({ inbox_page: String(page - 1) })}>Previous</button><span>{page} / {query.data.meta.last_page}</span><button type="button" disabled={page >= query.data.meta.last_page} onClick={() => setParams({ inbox_page: String(page + 1) })}>Next</button></nav>}</div>
  </aside>
}

function Chat({ id }) {
  const { data: user } = useCurrentUser()
  const client = useQueryClient()
  const [params] = useSearchParams()
  const [page, setPage] = useState(null)
  const [body, setBody] = useState('')
  const clearUnsaved = useUnsavedChanges(body.length > 0)
  const [identity, setIdentity] = useState({ body: '', id: '' })
  const log = useRef(null)
  const nearBottom = useRef(true)
  const previousPage = useRef(undefined)
  const heading = useRef(null)
  const focused = useRef(false)
  const thread = useQuery({ queryKey: ['inquiry', id], queryFn: async () => (await api.get('/inquiries/' + id)).data.data, retry: false, refetchInterval: 10_000 })
  const messages = useQuery({ queryKey: ['inquiry-messages', id, page ?? 'latest'], queryFn: async () => (await api.get('/inquiries/' + id + '/messages', { params: page === null ? { latest: 1 } : { page } })).data, enabled: !!thread.data, retry: false, refetchInterval: page === null ? 10_000 : false })
  useLayoutEffect(() => {
    if (!thread.data || focused.current) return
    if (window.matchMedia('(max-width: 767px)').matches) heading.current?.focus({ preventScroll: true })
    focused.current = true
  }, [thread.data])
  useLayoutEffect(() => {
    if (!messages.data || !log.current) return
    if (previousPage.current !== page || nearBottom.current) log.current.scrollTop = page === null ? log.current.scrollHeight : 0
    previousPage.current = page
  }, [messages.data, page])
  const mutation = useMutation({ mutationFn: data => writeApi('post', '/inquiries/' + id + '/messages', data), onSuccess: async () => {
    clearUnsaved(); setBody(''); setIdentity({ body: '', id: '' }); nearBottom.current = true; setPage(null)
    await Promise.all([client.invalidateQueries({ queryKey: ['inquiry-messages', id] }), client.invalidateQueries({ queryKey: ['inquiries'] }), client.invalidateQueries({ queryKey: ['inquiry', id] })])
  } })
  function send(event) {
    event.preventDefault()
    const value = body.trim()
    if (!value || mutation.isPending) return
    const clientId = identity.body === value && identity.id ? identity.id : crypto.randomUUID()
    setIdentity({ body: value, id: clientId }); mutation.mutate({ body: value, client_id: clientId })
  }
  const back = '/inquiries' + (params.get('inbox_page') ? '?inbox_page=' + params.get('inbox_page') : '')
  if (thread.isPending) return <div className="chat-loading"><Loading>Opening conversation…</Loading></div>
  if (thread.error) return <div className="chat-loading"><ErrorNotice error={thread.error} retry={() => thread.refetch()} /><Link className="btn btn-outline-primary" to={back}>Back to messages</Link></div>
  const conversation = thread.data
  const rows = messages.data?.data || []
  const meta = messages.data?.meta
  return <section className="message-chat" aria-label={'Conversation with ' + conversation.participant_name}>
    <header className="chat-header"><Link className="chat-back" to={back} aria-label="Back to messages">←</Link><Avatar src={conversation.participant_avatar_url} name={conversation.participant_name} /><div><h2 ref={heading} tabIndex={-1}>{conversation.participant_name}</h2><p>{conversation.participant_role === 'student' ? 'Student' : conversation.participant_role === 'landlord' ? 'Property owner' : user?.role === 'student' ? 'Property owner' : 'Student'}</p></div></header>
    <div className="chat-place"><div><strong>{conversation.listing_snapshot.title}</strong><span>{conversation.listing_snapshot.room_option?.name || 'Property conversation'}</span></div>{user?.role === 'landlord' ? <Link className="btn btn-outline-primary btn-sm" to={'/landlord/properties/' + conversation.property_id}>Manage place</Link> : conversation.property_status === 'approved' && conversation.listing_available !== false && conversation.can_reply ? <Link className="btn btn-outline-primary btn-sm" to={'/listings/' + conversation.property_id + (conversation.listing_snapshot.room_option?.id ? '?option=' + conversation.listing_snapshot.room_option.id : '')}>View place</Link> : null}</div>
    <div ref={log} className="chat-history" role="log" tabIndex={0} aria-label="Conversation messages" aria-live="polite" onScroll={event => { const node = event.currentTarget; nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80 }}>
      {messages.isPending ? <Loading>Loading messages…</Loading> : messages.error ? <ErrorNotice error={messages.error} retry={() => messages.refetch()} /> : <>
        {meta?.current_page > 1 && <button className="chat-history-button" type="button" onClick={() => setPage(meta.current_page - 1)}>Earlier messages</button>}
        {rows.map((message, index) => { const own = message.sender_id === user?.id; const startsDay = !index || day(rows[index - 1].created_at) !== day(message.created_at); const startsGroup = startsDay || rows[index - 1]?.sender_id !== message.sender_id
          return <div className="chat-message-group" key={message.id}>{startsDay && <p className="chat-day">{day(message.created_at)}</p>}<article className={'chat-message' + (own ? ' is-own' : '')} aria-label={'Message from ' + (own ? 'you' : message.sender_name)}>{startsGroup ? <Avatar src={message.sender_avatar_url || (own ? user?.avatar_url : conversation.participant_avatar_url)} name={message.sender_name} size="small" /> : <span className="chat-avatar-space" />}<div className="chat-bubble"><p>{message.body}</p><time dateTime={message.created_at} title={day(message.created_at) + ' ' + clock(message.created_at) + ' PHT'}>{clock(message.created_at)}</time></div></article></div>
        })}
        {!rows.length && <p className="chat-start">Start the conversation about this place.</p>}
        {page !== null && <div className="chat-history-navigation">{meta?.current_page < meta?.last_page && <button className="chat-history-button" type="button" onClick={() => setPage(meta.current_page + 1)}>Later messages</button>}<button className="chat-history-button" type="button" onClick={() => setPage(null)}>Latest messages</button></div>}
      </>}
    </div>
    <div className="chat-compose"><ErrorNotice error={mutation.error} />{conversation.can_reply ? <form onSubmit={send}><label className="visually-hidden" htmlFor="reply-body">Your reply</label><textarea id="reply-body" name="reply-body" rows={2} maxLength={3000} required value={body} disabled={mutation.isPending} placeholder="Write a message…" onChange={event => setBody(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form.requestSubmit() } }} /><button type="submit" aria-label="Send reply" disabled={!body.trim() || mutation.isPending}><span aria-hidden="true">↑</span></button></form> : <p className="chat-paused" role="status">Messaging is paused for this conversation. You can still read your earlier messages.</p>}</div>
  </section>
}

export default function MessagingWorkspace({ id }) {
  return <div className={'messaging-shell' + (id ? ' has-conversation' : '')}><Inbox selectedId={id} />{id ? <Chat key={id} id={id} /> : <div className="chat-welcome"><span aria-hidden="true">↗</span><h2>Your conversations, together.</h2><p>Choose a conversation to pick up where you left off.</p></div>}</div>
}
