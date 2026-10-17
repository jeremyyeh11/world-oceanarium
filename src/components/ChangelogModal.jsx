import { useEffect, useRef } from 'react'
import { VISITOR_CHANGELOG } from '../data/changelog'
import { APP_VERSION } from '../version'

const KIND_LABEL = { new: 'New', fix: 'Fix' }

// Shares the Sources panel's chassis (sources.css): same backdrop, card, header
// and close key, so the two read as one family of reference panels.
export default function ChangelogModal({ onClose }) {
  const closeRef = useRef(null)

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      onClose()
    }

    closeRef.current?.focus()
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div
      className="sources-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="changelog-modal-title"
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return
        onClose()
      }}
    >
      <div className="sources-card">
        <div className="sources-head">
          <div className="sources-head-title">
            <p className="sources-kicker">Now running {APP_VERSION}</p>
            <h2 id="changelog-modal-title">Changelog</h2>
          </div>
          <button
            className="sources-close"
            type="button"
            ref={closeRef}
            onClick={onClose}
            aria-label="Close changelog"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          </button>
        </div>

        <ol className="sources-list changelog-list">
          {VISITOR_CHANGELOG.map(release => (
            <li key={release.version} className="changelog-release">
              <div className="changelog-release-head">
                <span className="changelog-release-version">{release.version}</span>
                <strong>{release.title}</strong>
                {release.date && <time dateTime={release.date}>{release.date}</time>}
              </div>
              <ul className="changelog-changes">
                {release.changes.map(([kind, text]) => (
                  <li key={text} className={`changelog-change changelog-change--${kind}`}>
                    <span className="changelog-change-kind">{KIND_LABEL[kind]}</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
