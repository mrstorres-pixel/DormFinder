import { useRef, useState } from 'react'
import ActionDialog from './ActionDialog'
import './photo-gallery.css'

function GalleryArrows({ count, move }) {
  if (count < 2) return null
  return <><button type="button" className="gallery-arrow gallery-previous" aria-label="Previous photo" onClick={() => move(-1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button><button type="button" className="gallery-arrow gallery-next" aria-label="Next photo" onClick={() => move(1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></button></>
}

export default function PhotoGallery({ photos, refresh }) {
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState('')
  const [expanded, setExpanded] = useState(false)
  const opener = useRef(null)
  const selected = Math.min(index, photos.length - 1)
  const current = photos[selected]
  if (!current) return <p>No listing photos available.</p>
  const position = `Photo ${selected + 1} of ${photos.length}`
  function move(delta) { setIndex(value => (Math.min(value, photos.length - 1) + delta + photos.length) % photos.length) }
  function navigate(event) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); event.stopPropagation(); move(event.key === 'ArrowRight' ? 1 : -1)
    }
  }
  function dismissLetterbox(event) {
    const image = event.currentTarget
    if (!image.naturalWidth || !image.naturalHeight) return
    const box = image.getBoundingClientRect(), scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight)
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale
    const left = box.left + (box.width - width) / 2, top = box.top + (box.height - height) / 2
    if (event.clientX < left || event.clientX > left + width || event.clientY < top || event.clientY > top + height) { event.preventDefault(); setExpanded(false) }
  }
  const failure = failed === current.url && <p role="alert" className="gallery-failure">This photo could not load. <button type="button" className="btn btn-link" onClick={refresh}>Refresh photo links</button></p>
  return <section className="photo-gallery mb-4" aria-label="Property photo gallery" tabIndex={0} onKeyDown={navigate}>
    <figure><div className="gallery-image-stage">
      <button ref={opener} type="button" className="gallery-expand" aria-label={`Enlarge photo ${selected + 1}: ${current.caption || 'Listing photo'}`} onClick={() => setExpanded(true)}>
        <img src={current.url} alt={current.caption || 'Listing photo'} onError={() => setFailed(current.url)} />
        <span className="gallery-expand-hint" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /></svg></span>
      </button>
      <GalleryArrows count={photos.length} move={move} />
      <span className="gallery-position" aria-live="polite">{position}</span>
    </div><figcaption>{current.caption}</figcaption></figure>
    {failure}
    {photos.length > 1 && <div className="gallery-thumbnails">{photos.map((photo, photoIndex) => <button type="button" key={photo.id} aria-label={'Show photo ' + (photoIndex + 1) + ': ' + (photo.caption || 'Listing photo')} aria-pressed={photoIndex === selected} onClick={() => setIndex(photoIndex)}><img src={photo.url} alt="" loading="lazy" /></button>)}</div>}
    {expanded && <ActionDialog open title="Listing photos" className="photo-viewer" dismissOnBackdrop returnFocus={opener} onClose={() => setExpanded(false)}>
      <div className="photo-viewer-stage" onKeyDown={navigate}>
        <figure><div className="photo-viewer-image"><img src={current.url} alt={current.caption || 'Listing photo'} onPointerDown={dismissLetterbox} onError={() => setFailed(current.url)} /></div><figcaption><span>{current.caption}</span><span role="status">{position}</span></figcaption></figure>
        <GalleryArrows count={photos.length} move={move} />
        {failure}
      </div>
    </ActionDialog>}
  </section>
}
