import { useState } from 'react';
import { COOKIE_CONSENT_VERSION, hasValidConsent, readConsent, saveConsent } from '../../utils/cookieConsent';

function OptionalToggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Optional cookies"
      onClick={() => onChange(!checked)}
      className={`relative flex h-6 w-11 shrink-0 items-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-white/60 ${
        checked ? 'justify-end border-white/40 bg-white/15' : 'justify-start border-white/10 bg-[#181818]'
      }`}
    >
      <span className={`h-4 w-4 rounded-full transition ${checked ? 'bg-white' : 'bg-[#777]'}`} aria-hidden="true" />
    </button>
  );
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(() => !hasValidConsent());
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [optional, setOptional] = useState(() => readConsent()?.optional ?? false);

  if (!visible) return null;

  const accept = (allowOptional) => {
    saveConsent({ optional: allowOptional });
    setVisible(false);
    setPreferencesOpen(false);
  };

  return (
    <>
      {!preferencesOpen && (
        <div
          role="region"
          aria-label="Cookie consent"
          className="fixed inset-x-3 bottom-3 z-[70] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[380px]"
        >
          <div className="rounded-2xl border border-white/10 bg-[#111111]/95 p-4 shadow-2xl backdrop-blur-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white">Cookie &amp; Privacy</p>
            <p className="mt-2 text-xs leading-relaxed text-[#a8a8a8]">
              We use essential cookies required for AJ SPORTS to function. Optional cookies may be used for analytics or
              other non-essential functionality.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => accept(true)} className="kicks-btn kicks-btn-primary kicks-btn-sm flex-1 whitespace-nowrap">
                Accept Cookies
              </button>
              <button type="button" onClick={() => accept(false)} className="kicks-btn kicks-btn-secondary kicks-btn-sm flex-1 whitespace-nowrap">
                Reject Optional
              </button>
              <button
                type="button"
                onClick={() => setPreferencesOpen(true)}
                className="kicks-btn kicks-btn-dark kicks-btn-sm w-full whitespace-nowrap"
              >
                Manage Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {preferencesOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Cookie preferences">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0d0d] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white">Cookie Preferences</p>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-[12px] border border-white/10 bg-[#141414] p-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">Essential Cookies</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[#8d8d8d]">Login, cart and security. Always on.</p>
                </div>
                <span className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                  Always On
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-[12px] border border-white/10 bg-[#141414] p-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">Optional Cookies</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[#8d8d8d]">Analytics and non-essential features.</p>
                </div>
                <OptionalToggle checked={optional} onChange={setOptional} />
              </div>
            </div>

            <div className="mt-4 flex gap-1.5">
              <button
                type="button"
                onClick={() => accept(optional)}
                className="kicks-btn kicks-btn-secondary kicks-btn-sm flex-1 whitespace-nowrap"
              >
                Save Preferences
              </button>
              <button
                type="button"
                onClick={() => accept(true)}
                className="kicks-btn kicks-btn-primary kicks-btn-sm flex-1 whitespace-nowrap"
              >
                Accept All
              </button>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-[#767676]">
              Consent version {COOKIE_CONSENT_VERSION}. Essential cookies stay enabled either way.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
