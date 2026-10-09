import { errorMessage, fieldErrors } from '../lib/api'

export function ErrorNotice({ error, retry }) {
  if (!error) return null
  return <div className="alert alert-danger" role="alert">
    <strong>Something needs your attention.</strong>
    <p className="mb-0">{errorMessage(error)}</p>
    {Object.entries(fieldErrors(error)).map(([field, messages]) =>
      <p key={field} className="mb-0 small">{messages.join(' ')}</p>)}
    {retry && <button className="btn btn-outline-danger btn-sm mt-2" onClick={retry}>Try again</button>}
  </div>
}

export function Loading({ children = 'Getting things ready…' }) {
  return <div className="loading-state" role="status">
    <span className="spinner-border spinner-border-sm text-teal" aria-hidden="true" />
    <span>{children}</span>
  </div>
}

export function Field({ label, name, error, hint, as: Tag = 'input', ...props }) {
  const message = error?.[name]?.join(' ')
  return <div className="mb-3">
    <label className="form-label" htmlFor={name}>{label}</label>
    <Tag id={name} name={name} className={'form-control' + (message ? ' is-invalid' : '')}
      aria-invalid={message ? true : undefined}
      aria-describedby={message ? name + '-error' : hint ? name + '-hint' : undefined} {...props} />
    {message && <div id={name + '-error'} className="invalid-feedback">{message}</div>}
    {hint && <div id={name + '-hint'} className="form-text">{hint}</div>}
  </div>
}

