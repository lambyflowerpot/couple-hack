import { useEffect, useRef, useState } from "react";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const PARTS = /^(\D*)([\d][\d,]*(?:\.\d+)?)(.*)$/;

function formatNumber(n: number, decimals: number, commas: boolean) {
  const fixed = n.toFixed(decimals);
  if (!commas) return fixed;
  return Number(fixed).toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

type CountUpProps = {
  /** The final figure exactly as it should read, e.g. "£2.2bn", "529,994", "61%". */
  value: string;
  duration?: number;
  className?: string;
};

/**
 * Counts a figure up from zero the first time it scrolls into view, keeping any
 * prefix, separators, decimals and suffix from `value`.
 */
export function CountUp({ value, duration = 1500, className = "" }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  const parts = PARTS.exec(value);
  const prefix = parts?.[1] ?? "";
  const numberText = parts?.[2] ?? "";
  const suffix = parts?.[3] ?? "";
  const target = numberText === "" ? Number.NaN : Number.parseFloat(numberText.replace(/,/g, ""));
  const decimals = numberText.includes(".") ? (numberText.split(".")[1]?.length ?? 0) : 0;
  const commas = numberText.includes(",");

  useEffect(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(target)) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let started = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();

        const tick = (now: number) => {
          if (!started) started = now;
          const progress = Math.min(1, (now - started) / duration);
          setDisplay(prefix + formatNumber(target * easeOutCubic(progress), decimals, commas) + suffix);
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [target, duration, prefix, suffix, decimals, commas]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
