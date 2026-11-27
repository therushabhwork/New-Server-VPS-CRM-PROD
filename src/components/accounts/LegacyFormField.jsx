import React, { useEffect, useMemo, useRef, useState } from 'react'

const inputClasses =
  'legacy-form-control w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white outline-none transition duration-150 ease-in-out focus:border-[#c60016] focus:ring-1 focus:ring-[#c60016]/20'

const normalizeOptionValue = (value) => (
  value === null || value === undefined ? '' : String(value)
)

const normalizeOptions = (options = []) => {
  const seenValues = new Set()

  return options.reduce((normalizedOptions, option) => {
    const normalizedOption = typeof option === 'object' && option !== null
      ? {
        value: normalizeOptionValue(option.value ?? option.label ?? ''),
        label: String(option.label ?? option.value ?? ''),
      }
      : {
        value: normalizeOptionValue(option),
        label: String(option ?? ''),
      }

    if (seenValues.has(normalizedOption.value)) {
      return normalizedOptions
    }

    seenValues.add(normalizedOption.value)
    normalizedOptions.push(normalizedOption)
    return normalizedOptions
  }, [])
}

const SearchableSelectField = ({
  id,
  name,
  value,
  options,
  onChange,
  controlClassName,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef(null)
  const searchInputRef = useRef(null)

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value]
  )

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return options
    return options.filter((option) => (
      option.label.toLowerCase().includes(query) ||
      option.value.toLowerCase().includes(query)
    ))
  }, [options, searchQuery])

  useEffect(() => {
    if (!isOpen) return undefined

    const focusTimer = setTimeout(() => {
      searchInputRef.current?.focus()
    }, 0)

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(focusTimer)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = (nextValue) => {
    onChange(name, nextValue)
    setIsOpen(false)
    setSearchQuery('')
  }

  return (
    <div ref={containerRef} className="legacy-searchable-select">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((prev) => {
            if (prev) setSearchQuery('')
            return !prev
          })
        }}
        className={`legacy-searchable-select-trigger ${controlClassName}`.trim()}
      >
        <span
          className={`legacy-searchable-select-value ${
            selectedOption ? 'is-selected' : 'is-placeholder'
          }`}
        >
          {selectedOption ? selectedOption.label : 'Select'}
        </span>
        <svg
          width="14"
          height="14"
          className={`legacy-searchable-select-chevron ${isOpen ? 'is-open' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen ? (
        <div className="legacy-searchable-select-panel is-downward">
          <div className="legacy-searchable-select-search-wrap">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search..."
              aria-label={`Search ${name}`}
              className="legacy-searchable-select-search"
            />
          </div>

          <ul role="listbox" className="legacy-searchable-select-list">
            {!searchQuery.trim() ? (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === ''}
                  onClick={() => handleSelect('')}
                  className={`legacy-searchable-select-option is-placeholder ${
                    value === '' ? 'is-active' : ''
                  }`}
                >
                  Select
                </button>
              </li>
            ) : null}

            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = option.value === value
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(option.value)}
                      className={`legacy-searchable-select-option ${
                        isSelected ? 'is-active' : ''
                      }`}
                    >
                      {option.label}
                    </button>
                  </li>
                )
              })
            ) : (
              <li className="legacy-searchable-select-empty">
                No matching options
              </li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

const LegacyFormField = ({
  label,
  name,
  value,
  onChange,
  type = 'text',
  required = false,
  error = '',
  options = [],
  searchable = false,
  textareaRows = 4,
  placeholder = '',
  className = '',
  labelClassName = '',
  fieldClassName = '',
  layout = 'stacked',
  rowClassName = '',
  inputWrapperClassName = '',
  icon = null,
}) => {
  const handleChange = (event) => {
    onChange(name, event.target.value)
  }

  const normalizedValue = normalizeOptionValue(value)
  const normalizedOptions = normalizeOptions(options)
  const hasSelectedOption = normalizedOptions.some((option) => option.value === normalizedValue)
  const resolvedOptions = normalizedValue && !hasSelectedOption
    ? [{ value: normalizedValue, label: normalizedValue }, ...normalizedOptions]
    : normalizedOptions

  const errorClasses = error ? 'border-[#c60016] ring-1 ring-[#c60016]/20 focus:border-[#c60016]' : ''
  
  const control =
    type === 'textarea' ? (
      <textarea
        id={name}
        name={name}
        rows={textareaRows}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`${inputClasses} ${errorClasses} min-h-[74px] resize-none leading-5 ${className} ${fieldClassName}`.trim()}
      />
    ) : type === 'select' && searchable ? (
      <SearchableSelectField
        id={name}
        name={name}
        value={normalizedValue}
        options={resolvedOptions}
        onChange={onChange}
        controlClassName={`${inputClasses} ${errorClasses} min-h-[38px] ${className} ${fieldClassName}`.trim()}
      />
    ) : type === 'select' ? (
      <select
        id={name}
        name={name}
        value={normalizedValue}
        onChange={handleChange}
        className={`${inputClasses} ${errorClasses} min-h-[38px] appearance-none ${className} ${fieldClassName}`.trim()}
      >
        <option value="">Select</option>
        {resolvedOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ) : type === 'range' ? (
      <div className="flex items-center gap-3">
        <input
          id={name}
          name={name}
          type={type}
          min={0}
          max={100}
          value={value || 0}
          onChange={handleChange}
          className={`flex-1 ${className} ${fieldClassName}`.trim()}
        />
        <span className="text-sm font-semibold text-gray-700 min-w-[3rem]">{value || 0}%</span>
      </div>
    ) : (
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`${inputClasses} ${errorClasses} min-h-[38px] ${className} ${fieldClassName}`.trim()}
      />
    )

  if (layout === 'inline') {
    return (
      <div className={`legacy-form-row ${rowClassName}`.trim()}>
        <label
          htmlFor={name}
          className={`legacy-form-label ${required ? 'legacy-form-label--required' : ''} ${labelClassName}`.trim()}
        >
          {icon ? (
            <span className="legacy-form-icon-wrap">
              {icon}
            </span>
          ) : null}
          <span className="legacy-form-label-text">
            {label}
            {required && <span className="legacy-form-required-marker ml-1 text-red-600">*</span>}
          </span>
        </label>

        <div className={`space-y-1 ${inputWrapperClassName}`.trim()}>
          {control}
          {error ? <p className="legacy-form-error-message text-xs text-red-600">{error}</p> : null}
        </div>
      </div>
    )
  }

  return (
    <div className={`legacy-form-field-stack ${rowClassName}`.trim()}>
      <label
        htmlFor={name}
        className={`legacy-form-label ${required ? 'legacy-form-label--required' : ''} ${labelClassName}`.trim()}
      >
        {icon ? (
          <span className="legacy-form-icon-wrap">
            {icon}
          </span>
        ) : null}
        <span className="legacy-form-label-text">
          {label}
          {required && <span className="legacy-form-required-marker ml-1 text-red-600">*</span>}
        </span>
      </label>

      <div className="space-y-0.5">
        {control}
        {error ? <p className="legacy-form-error-message text-xs text-red-600">{error}</p> : null}
      </div>
    </div>
  )
}

export default LegacyFormField
