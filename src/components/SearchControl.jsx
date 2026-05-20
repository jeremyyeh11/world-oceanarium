import { useMemo, useRef, useState } from 'react'
import { triggerUiClickSound } from '../hooks/useOceanAudio'

const SEARCH_FOCUS_EVENT = 'world-oceanarium-focus-creature'
const ERROR_TEXT = 'No creature with this name or id found!'

function normalizeSearchText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function findCreature(creatures, query) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery || normalizedQuery === normalizeSearchText(ERROR_TEXT)) return null

  const idMatch = creatures.find(creature => normalizeSearchText(creature.id) === normalizedQuery)
  if (idMatch) return idMatch

  const exactNameMatch = creatures.find(creature => normalizeSearchText(creature.customName) === normalizedQuery)
  if (exactNameMatch) return exactNameMatch

  return creatures.find(creature => {
    const name = normalizeSearchText(creature.customName)
    return name && name.includes(normalizedQuery)
  }) ?? null
}

export default function SearchControl({ creatures = [], active = false }) {
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [failed, setFailed] = useState(false)
  const inputRef = useRef(null)

  const searchableCreatures = useMemo(
    () => creatures.filter(creature => creature?.alive !== false),
    [creatures],
  )

  const openSearch = () => {
    if (!active) return
    setExpanded(true)
    if (failed) {
      setFailed(false)
      setQuery('')
    }
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const resetSearch = () => {
    setExpanded(false)
    setFailed(false)
    setQuery('')
  }

  const submitSearch = (event) => {
    event.preventDefault()
    if (!expanded) {
      openSearch()
      return
    }

    const match = findCreature(searchableCreatures, query)
    if (!match) {
      triggerUiClickSound({ type: 'click', variant: 'error' })
      setFailed(true)
      setQuery(ERROR_TEXT)
      inputRef.current?.blur()
      return
    }

    triggerUiClickSound({ type: 'click', variant: 'confirm' })
    window.dispatchEvent(new CustomEvent(SEARCH_FOCUS_EVENT, {
      detail: { creatureId: String(match.id) },
    }))
    inputRef.current?.blur()
    resetSearch()
  }

  const handleButtonClick = (event) => {
    if (expanded) {
      event.preventDefault()
      resetSearch()
      return
    }

    submitSearch(event)
  }

  const handleInputFocus = () => {
    if (!failed) return
    setFailed(false)
    setQuery('')
  }

  const handleKeyDown = (event) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    resetSearch()
  }

  return (
    <form
      className={`fish-search${expanded ? ' is-expanded' : ''}${failed ? ' has-error' : ''}${active ? '' : ' is-disabled'}`}
      role="search"
      aria-label="Search for fish"
      onSubmit={submitSearch}
    >
      <input
        ref={inputRef}
        className="fish-search-input"
        type="search"
        value={query}
        disabled={!active}
        enterKeyHint="search"
        autoComplete="off"
        spellCheck="false"
        aria-label="Search for your fish by name or id"
        placeholder="Search for your fish by name or id"
        onChange={(event) => {
          setFailed(false)
          setQuery(event.target.value)
        }}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
      />
      <button
        className="fish-search-button"
        type="button"
        disabled={!active}
        aria-label={expanded ? 'Close fish search' : 'Open fish search'}
        aria-expanded={expanded}
        onClick={handleButtonClick}
      >
        <svg className="top-control-icon fish-search-icon" aria-hidden="true" viewBox="0 0 24 24">
          <path d="M10.8 17.1a6.3 6.3 0 1 1 0-12.6 6.3 6.3 0 0 1 0 12.6Zm4.8-1.5 4 4" />
        </svg>
        <svg className="top-control-icon fish-search-close-icon" aria-hidden="true" viewBox="0 0 24 24">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </form>
  )
}
