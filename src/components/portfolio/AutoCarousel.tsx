import { useCallback, useEffect, useState, type FocusEvent, type ReactNode } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

const AUTO_ADVANCE_INTERVAL_MS = 5000;

type AutoCarouselProps<T> = {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  itemClassName?: string;
  label: string;
};

// Shared portfolio carousel with accessible controls and pause-on-interaction autoplay.
export function AutoCarousel<T>({
  items,
  getKey,
  renderItem,
  itemClassName,
  label,
}: AutoCarouselProps<T>) {
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const updateSelectedIndex = useCallback((carouselApi: CarouselApi) => {
    setSelectedIndex(carouselApi.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!api) return;

    updateSelectedIndex(api);
    api.on("select", updateSelectedIndex);
    api.on("reInit", updateSelectedIndex);

    return () => {
      api.off("select", updateSelectedIndex);
      api.off("reInit", updateSelectedIndex);
    };
  }, [api, updateSelectedIndex]);

  useEffect(() => {
    if (!api || isPaused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // Advance one slide at a time and rely on Embla's loop option to wrap continuously.
    const intervalId = window.setInterval(() => api.scrollNext(), AUTO_ADVANCE_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [api, isPaused]);

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    // Keep autoplay paused while focus moves between controls or links inside the carousel.
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsPaused(false);
    }
  };

  return (
    <Carousel
      setApi={setApi}
      opts={{ align: "start", loop: true }}
      className="mx-auto w-full"
      aria-label={label}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={handleBlur}
    >
      <CarouselContent className="-ml-5">
        {items.map((item, index) => (
          <CarouselItem
            key={getKey(item)}
            className={cn("pl-5", itemClassName)}
            aria-label={`${index + 1} of ${items.length}`}
          >
            {renderItem(item)}
          </CarouselItem>
        ))}
      </CarouselContent>

      <div className="mt-6 flex items-center justify-center gap-4">
        <CarouselPrevious className="static translate-y-0" />
        <p className="min-w-14 text-center text-xs text-muted-foreground" aria-live="off">
          {selectedIndex + 1} / {items.length}
        </p>
        <CarouselNext className="static translate-y-0" />
      </div>
    </Carousel>
  );
}
