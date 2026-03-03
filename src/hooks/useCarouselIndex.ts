import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Tracks the active card index in a CSS scroll-snap carousel
 * using IntersectionObserver (no onScroll debounce needed).
 */
export function useCarouselIndex(count: number): {
  scrollRef: React.RefObject<HTMLDivElement>;
  cardRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  activeIndex: number;
  scrollToCard: (index: number) => void;
} {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!cards.length) return;

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const index = cardRefs.current.indexOf(entry.target as HTMLDivElement);
            if (index !== -1) setActiveIndex(index);
          }
        }
      },
      { root: scrollRef.current, threshold: 0.5 }
    );

    for (const card of cards) observer.observe(card);
    return () => observer.disconnect();
  }, [count]);

  const scrollToCard = useCallback((index: number) => {
    cardRefs.current[index]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, []);

  return { scrollRef, cardRefs, activeIndex, scrollToCard };
}
