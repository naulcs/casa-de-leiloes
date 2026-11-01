import { Children, cloneElement, useEffect, useRef, useState } from "react";

const AUTOPLAY_MS = 2500;
function howManyFit(width) {
  if (width >= 760) return 5;
  if (width >= 640) return 4;
  return 3;
}

export default function Carousel({ children }) {
  const items = Children.toArray(children);
  const total = items.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef(null);
  const area = useRef(null);
  const [visibleCount, setVisibleCount] = useState(5);
  const empty = total === 0;

  const highlighted = total > 0 ? Math.min(activeIndex, total - 1) : 0;
  const start = Math.max(0, Math.min(highlighted - 1, total - visibleCount));

  useEffect(() => {
    const element = area.current;
    if (!element) return;

    function measure() {
      const computedStyle = getComputedStyle(element);
      const width =
        element.clientWidth -
        parseFloat(computedStyle.paddingLeft) -
        parseFloat(computedStyle.paddingRight);
      setVisibleCount(howManyFit(width));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [empty]);

  useEffect(() => {
    if (paused || total < 2) return;
    const timer = setInterval(() => {
      setActiveIndex((index) => (index + 1) % total);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, total]);

  function goTo(destination) {
    setActiveIndex(((destination % total) + total) % total);
  }

  function handlePointerDown(event) {
    touchStartX.current = event.clientX;
  }

  function handlePointerUp(event) {
    if (touchStartX.current === null) return;
    const distance = event.clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) > 40) goTo(highlighted + (distance < 0 ? 1 : -1));
  }

  if (total === 0) return null;

  return (
    <div
      className="gallery"
      ref={area}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <ul className="gallery-row">
        {items.slice(start, start + visibleCount).map((item, position) => {
          const index = start + position;
          const isOpen = index === highlighted;
          return cloneElement(item, {
            className: `${item.props.className ?? ""} gallery-card${isOpen ? " open" : ""}`,
            style: {
              "--card-number": `"${String(index + 1).padStart(2, "0")}"`,
            },
            onClickCapture: (event) => {
              if (isOpen) return;
              event.preventDefault();
              event.stopPropagation();
              goTo(index);
            },
          });
        })}
      </ul>
      {total > 1 && (
        <div className="gallery-controls">
          <button
            type="button"
            onClick={() => goTo(highlighted - 1)}
            aria-label="Anterior"
          >
            ‹
          </button>
          <span>
            {String(highlighted + 1).padStart(2, "0")} /{" "}
            {String(total).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={() => goTo(highlighted + 1)}
            aria-label="Próximo"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
