import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// Editorial section heading with two rhythms:
// - split: giant title left, supporting copy + CTA right (desktop)
// - stack: title, copy, compact CTA link (mobile-first compact)
export default function SectionHeading({ eyebrow, title, description, ctaTo, ctaLabel, ctaAria }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="kicks-eyebrow">{eyebrow}</p>}
        <h2 className="kicks-section-title mt-3 max-w-2xl">{title}</h2>
        {description && (
          <p className="kicks-body mt-3 max-w-xl">{description}</p>
        )}
      </div>
      {ctaTo && (
        <div className="flex shrink-0 items-center gap-3">
          <Link
            to={ctaTo}
            aria-label={ctaAria || ctaLabel}
            className="kicks-btn kicks-btn-secondary kicks-btn-sm"
          >
            {ctaLabel} <ArrowRight size={13} />
          </Link>
        </div>
      )}
    </div>
  );
}
