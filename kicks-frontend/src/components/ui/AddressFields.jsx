import { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Loader2 } from 'lucide-react';
import { usePincodeLookup } from '../../utils/pincodeLookup';

// Shared address-entry primitives: searchable combobox, pincode lookup field
// with verification states, and the pincode/state conflict helper.
// Presentation only — validation rules live in the backend + form schemas.

const inputClass = 'w-full kicks-field text-sm text-white outline-none focus:border-white/30';

// Searchable combobox (mobile-friendly): text input + filtered dropdown.
// Options are always caller-scoped (states list, or cities of one state).
export function SearchableCombobox({
  id,
  label,
  value,
  onChange,
  options = [],
  placeholder = '',
  error = '',
  hint = '',
  required = false,
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef(null);
  const query = String(value || '').trim().toLowerCase();
  const matches = options.filter((option) => String(option).toLowerCase().includes(query)).slice(0, 8);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open ]);

  const choose = (option) => {
    onChange(option);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      {label && (
        <label htmlFor={id} className="mb-2 block text-xs text-[#c0c0c0]">
          {label} {required && '*'}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          value={value || ''}
          onChange={(event) => { onChange(event.target.value); setOpen(true); setHighlight(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { setOpen(false); return; }
            if (!open || matches.length === 0) return;
            if (event.key === 'ArrowDown') { event.preventDefault(); setHighlight((h) => (h + 1) % matches.length); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setHighlight((h) => (h - 1 + matches.length) % matches.length); }
            if (event.key === 'Enter' && open) { event.preventDefault(); choose(matches[highlight] || matches[0]); }
          }}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          className={`${inputClass} pr-9`}
        />
        <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8d8d8d]" />
      </div>
      {open && matches.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="admin-pop absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-48 overflow-y-auto rounded-[12px] border border-white/10 bg-[#141414] p-1.5 shadow-2xl shadow-black/60"
        >
          {matches.map((option, index) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={String(value) === option}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                onMouseEnter={() => setHighlight(index)}
                className={`flex w-full items-center rounded-[8px] px-3 py-2 text-left text-[13px] transition ${
                  index === highlight ? 'bg-white/10 text-white' : 'text-[#d4d4d4]'
                }`}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-red-300">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-[#8d8d8d]">{hint}</p>
      ) : null}
    </div>
  );
}

// PIN code field with debounced existence lookup.
// Reports { status, result } via onLookup and auto-fills via onVerified.
export function PincodeField({ id = 'pincode', label = 'Postal / PIN Code', value, onChange, onLookup, onVerified, error = '', required = true }) {
  const { status, result, error: lookupError, reset } = usePincodeLookup({ value, onVerified });

  useEffect(() => {
    onLookup?.({ status, result });
  }, [status, result, onLookup]);

  useEffect(() => () => reset(), [reset]);

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs text-[#c0c0c0]">
        {label} {required && '*'}
      </label>
      <div className="relative">
        <input
          id={id}
          value={value || ''}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="PIN Code"
          inputMode="numeric"
          autoComplete="postal-code"
          aria-label={label || 'PIN Code'}
          aria-describedby={`${id}-status`}
          className={inputClass}
        />
        {status === 'checking' && (
          <Loader2 size={14} aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#FFC800]" />
        )}
        {status === 'valid' && (
          <CheckCircle2 size={14} aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-300" />
        )}
        {status === 'invalid' && (
          <AlertCircle size={14} aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-red-300" />
        )}
      </div>
      <div id={`${id}-status`} aria-live="polite" className="mt-1 min-h-[16px] text-xs">
        {status === 'checking' && <span className="text-[#a8a8a8]">Checking pincode…</span>}
        {status === 'valid' && result && (
          <span className="text-emerald-300">
            ✓ Pincode verified{result.city || result.state ? ` — ${[result.city, result.state].filter(Boolean).join(', ')}` : ''}
          </span>
        )}
        {status === 'invalid' && <span role="alert" className="text-red-300">{lookupError}</span>}
        {status === 'unknown' && <span className="text-[#f3d87d]">{lookupError}</span>}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}
