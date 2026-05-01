"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type FlipWordsProps = {
  words: string[];
  intervalMs?: number;
  className?: string;
};

export default function FlipWords({ words, intervalMs = 2200, className = "" }: FlipWordsProps) {
  const [index, setIndex] = useState(0);
  const measureRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [wordWidth, setWordWidth] = useState<number | null>(null);

  useEffect(() => {
    if (words.length <= 1) return;

    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % words.length);
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [intervalMs, words.length]);

  useLayoutEffect(() => {
    const currentWord = measureRefs.current[index];
    if (!currentWord) return;

    setWordWidth(currentWord.offsetWidth + 8);
  }, [index, words]);

  if (words.length === 0) return null;

  return (
    <span
      className={`relative inline-grid overflow-hidden align-baseline transition-[width] duration-500 ease-out ${className}`}
      style={{ width: wordWidth ?? undefined }}
    >
      <span key={words[index]} className="landing-flip-word col-start-1 row-start-1 inline-block whitespace-nowrap">
        {words[index]}
      </span>
      <span className="pointer-events-none invisible absolute left-0 top-0 h-0 overflow-hidden whitespace-nowrap">
        {words.map((word, wordIndex) => (
          <span
            key={word}
            ref={(node) => {
              measureRefs.current[wordIndex] = node;
            }}
            className="inline-block"
          >
            {word}
          </span>
        ))}
      </span>
    </span>
  );
}
