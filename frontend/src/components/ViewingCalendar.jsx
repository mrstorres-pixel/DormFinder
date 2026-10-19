import { useState } from 'react'
import { monthDays, philippineDate, shiftMonth } from '../lib/viewingCalendar'

export default function ViewingCalendar({ month, day, rows, loading, onMonth, onDay }) {
  const { offset, days } = monthDays(month)
  const [today] = useState(() => philippineDate(Date.now()))
  const label = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(month + '-01T12:00:00Z'))
  const byDay = new Map()
  for (const row of rows) {
    const key = philippineDate(row.starts_at)
    byDay.set(key, [...(byDay.get(key) || []), row])
  }
  return <section className="viewing-calendar" aria-label="Viewing calendar" aria-busy={loading}>
    <header><h2 aria-live="polite">{label}</h2><span>Philippine time</span><div><button aria-label="Previous month" disabled={month === '1900-01'} onClick={() => onMonth(shiftMonth(month, -1))}>←</button><button onClick={() => onMonth(today.slice(0, 7), today)}>Today</button><button aria-label="Next month" disabled={month === '2199-12'} onClick={() => onMonth(shiftMonth(month, 1))}>→</button></div></header>
    <div className="calendar-weekdays" aria-hidden="true">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(name => <span key={name}>{name}</span>)}</div>
    <div className="calendar-days">{Array.from({ length: offset }, (_, i) => <span key={'blank-' + i} />)}{days.map(date => {
      const appointments = byDay.get(date) || []
      const confirmed = appointments.filter(row => row.status === 'accepted').length
      const pending = appointments.length - confirmed
      return <button key={date} aria-pressed={day === date} aria-current={date === today ? 'date' : undefined} aria-label={date + (appointments.length ? `, ${confirmed} confirmed, ${pending} awaiting confirmation` : ', no viewings')} onClick={() => onDay(date)}><time dateTime={date}>{Number(date.slice(-2))}</time><span className="calendar-day-dots" aria-hidden="true">{confirmed > 0 && <i className="confirmed" />}{pending > 0 && <i className="pending" />}</span>{appointments.length > 0 && <small aria-hidden="true">{appointments.length} {appointments.length === 1 ? 'visit' : 'visits'}</small>}</button>
    })}</div>
    <footer><span><i className="confirmed" /> Confirmed</span><span><i className="pending" /> Awaiting confirmation</span></footer>
  </section>
}
