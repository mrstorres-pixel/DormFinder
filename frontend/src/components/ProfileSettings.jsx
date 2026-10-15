import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fieldErrors, writeApi } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { useCampuses } from '../lib/discovery'
import useUnsavedChanges, { useClearUnsavedChanges } from '../lib/useUnsavedChanges'
import { ErrorNotice, Field, Loading } from './Feedback'
import CampusSearch from './CampusSearch'
import './student-space.css'

export default function ProfileSettings() {
  const [profileDirty, setProfileDirty] = useState(false)
  const [passwordDirty, setPasswordDirty] = useState(false)
  const clearProfile = useUnsavedChanges(profileDirty)
  useUnsavedChanges(passwordDirty)
  const clearAllUnsaved = useClearUnsavedChanges()
  const campuses = useCampuses()
  const [selectedCampus, setSelectedCampus] = useState(null)
  const [campusError, setCampusError] = useState('')
  const { data: user } = useCurrentUser()
  const client = useQueryClient()
  const navigate = useNavigate()
  const nameChange = useMutation({ mutationFn: data => writeApi('patch', '/me', data), onSuccess: data => { clearProfile(); setProfileDirty(false); client.setQueryData(['me'], data) } })
  const passwordChange = useMutation({ mutationFn: data => writeApi('patch', '/me/password', data), onSuccess: () => { clearAllUnsaved(); setProfileDirty(false); setPasswordDirty(false); client.clear(); client.setQueryData(['me'], null); navigate('/login') } })
  function saveProfile(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const campusInput = event.currentTarget.querySelector('[role=combobox]')
    if (user.role === 'student' && campusInput?.value.trim() && !values.preferred_campus_id) { setCampusError('Choose a campus from the suggestions, or clear the field.'); campusInput.focus(); return }
    setCampusError('')
    nameChange.mutate(values)
  }
  if (!user) return null
  return <section className="container page-space profile-settings">
    <Link className="settings-back" to={user.role === 'student' ? '/account' : user.role === 'landlord' ? '/landlord' : '/admin'}>← {user.role === 'student' ? 'Your space' : 'Your workspace'}</Link>
    <h1>Your profile</h1>
    <form className="profile-main-form" onChange={() => setProfileDirty(true)} onSubmit={saveProfile}><fieldset disabled={nameChange.isPending || passwordChange.isPending}>
      <section className="settings-section" aria-labelledby="personal-details"><div><h2 id="personal-details">Personal details</h2></div><div><Field label="Your name" name="name" defaultValue={user.name} required maxLength={100} error={fieldErrors(nameChange.error)} /><span className="form-label d-block">Email address</span><p className="settings-email">{user.email}</p></div></section>
      {user.role === 'student' && <section className="settings-section" aria-labelledby="campus-preference"><div><h2 id="campus-preference">Your campus</h2><p>Start your next search here.</p></div><div>{campuses.isPending || campuses.error ? <><input type="hidden" name="preferred_campus_id" value={selectedCampus ?? String(user.preferred_campus_id || '')} />{campuses.isPending && <Loading>Loading campuses…</Loading>}</> : <CampusSearch campuses={campuses.data || []} value={selectedCampus ?? String(user.preferred_campus_id || '')} onChange={value => { setSelectedCampus(value); setProfileDirty(true); setCampusError('') }} name="preferred_campus_id" />}{campusError && <p role="alert">{campusError}</p>}</div></section>}
      <ErrorNotice error={nameChange.error} /><div className="settings-save"><button className="btn btn-primary" disabled={!profileDirty || nameChange.isPending}>{nameChange.isPending ? 'Saving…' : 'Save profile'}</button>{nameChange.isSuccess && !profileDirty && <span className="text-success" role="status">Saved.</span>}</div>
    </fieldset></form>
    {user.role === 'student' && <ErrorNotice error={campuses.error} retry={() => campuses.refetch()} />}
    <details className="settings-security"><summary>Change password</summary><p className="small text-secondary">Changing your password signs you out of all sessions.</p><ErrorNotice error={passwordChange.error} />
      <form onChange={event => setPasswordDirty([...new FormData(event.currentTarget).values()].some(value => String(value).length > 0))} onSubmit={event => { event.preventDefault(); if (profileDirty && !window.confirm('Changing your password signs you out. Discard your unsaved profile changes?')) return; passwordChange.mutate(Object.fromEntries(new FormData(event.currentTarget))) }}><fieldset disabled={passwordChange.isPending || nameChange.isPending}>
        <Field label="Current password" name="current_password" type="password" autoComplete="current-password" required error={fieldErrors(passwordChange.error)} />
        <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={12} hint="At least 12 characters, including letters and numbers." error={fieldErrors(passwordChange.error)} />
        <Field label="Confirm new password" name="password_confirmation" type="password" autoComplete="new-password" required error={fieldErrors(passwordChange.error)} />
        <button className="btn btn-outline-primary" disabled={passwordChange.isPending}>Change password</button>
      </fieldset></form>
    </details>
  </section>
}
