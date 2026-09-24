import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard from './ProductCard';

// Horizontal snap rail reusing the standard ProductCard. Desktop shows
// arrow controls; mobile swipes natively with the next card peeking.
export default function ProductRail({ items = [], label = 'products' }) {
  const trackRef = useRef(null);

  if (items.length === 0) {
    return (
      <div className="kicks-body mt-8 rounded-2xl border border-dashed border-white/15 bg-[#111111] p-8 text-center sm:mt-10 sm:p-10">
        Fresh drops landing soon. Browse the full collection meanwhile.
      </div>
    );
  }

  const scrollByCards = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    const firstCard = track.querySelector('[data-rail-card]');
    const step = firstCard ? firstCard.clientWidth + 12 : track.clientWidth * 0.8;
    track.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  return (
    <div className="group/rail relative mt-8 sm:mt-10">
      <div
        ref={trackRef}
        role="list"
        aria-label={`${label} carousel`}
        className="kicks-scroll-row snap-x snap-mandatory gap-3 sm:gap-4"
      >
        {items.map((product) => (
          <div
            key={product?._id || product?.slug}
            role="listitem"
            data-rail-card
            className="w-[68vw] max-w-[300px] shrink-0 snap-start sm:w-[240px] lg:w-[260px]"
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => scrollByCards(-1)}
            aria-label={`Previous ${label}`}
            className="kicks-icon-btn absolute -left-1 top-[32%] hidden h-9 w-9 opacity-0 transition group-hover/rail:opacity-100 focus-visible:opacity-100 md:inline-flex"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => scrollByCards(1)}
            aria-label={`Next ${label}`}
            className="kicks-icon-btn absolute -right-1 top-[32%] hidden h-9 w-9 opacity-0 transition group-hover/rail:opacity-100 focus-visible:opacity-100 md:inline-flex"
          >
            <ChevronRight size={15} />
          </button>
        </>
      )}
    </div>
  );
}
