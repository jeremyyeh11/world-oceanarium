import { useEffect, useRef } from 'react'
import { SOURCES } from '../data/sources'

function displayHost(url) {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function SourcesModal({ onClose }) {
  const closeRef = useRef(null)

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      onClose()
    }

    // Focus starts on close so the dialog is escapable by keyboard alone; the
    // entries below it are ordinary links and tab through in reading order.
    closeRef.current?.focus()
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div
      className="sources-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sources-modal-title"
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return
        onClose()
      }}
    >
      <div className="sources-card">
        <div className="sources-head">
          <div className="sources-head-title">
            <p className="sources-kicker">Reference material</p>
            <h2 id="sources-modal-title">Sources</h2>
          </div>
          <button
            className="sources-close"
            type="button"
            ref={closeRef}
            onClick={onClose}
            aria-label="Close sources"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          </button>
        </div>

        <p className="sources-intro">
          Species facts in this oceanarium are read from the references below rather than invented.
          Each opens in a new tab.
        </p>

        <ul className="sources-list">
          {SOURCES.map((source, index) => (
            <li key={source.id}>
              <a className="sources-entry" href={source.url} target="_blank" rel="noreferrer noopener">
                <span className="sources-entry-no">№ {String(index + 1).padStart(2, '0')}</span>
                <span className="sources-entry-body">
                  <span className="sources-entry-heading">
                    <strong>{source.name}</strong>
                    <span className="sources-entry-kicker">{source.kicker}</span>
                  </span>
                  {source.fullName && <em className="sources-entry-full-name">{source.fullName}</em>}
                  <span className="sources-entry-summary">{source.summary}</span>
                  <span className="sources-entry-tags">
                    {source.provides.map(item => (
                      <span key={item}>{item}</span>
                    ))}
                  </span>
                  <span className="sources-entry-host">
                    {displayHost(source.url)}
                    <svg className="sources-entry-arrow" aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                      <path d="M8.5 15.5 15.5 8.5" />
                      <path d="M9.5 8.5h6v6" />
                    </svg>
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
