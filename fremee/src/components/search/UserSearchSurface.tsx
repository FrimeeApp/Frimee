"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Search } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { searchUsers, type PublicUserProfileDto } from "@/services/api/repositories/users.repository";

type UserSearchSurfaceProps = {
  excludeUserId?: string;
  limit?: number;
  autoFocus?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  inputClassName?: string;
  resultsClassName?: string;
  emptyAction?: ReactNode;
  onResultClick?: () => void;
};

export default function UserSearchSurface({
  excludeUserId,
  limit = 20,
  autoFocus = false,
  inputRef,
  inputClassName = "h-[44px]",
  resultsClassName = "mt-[var(--space-4)]",
  emptyAction,
  onResultClick,
}: UserSearchSurfaceProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUserProfileDto[]>([]);
  const [loading, setLoading] = useState(false);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const resolvedInputRef = inputRef ?? fallbackInputRef;

  useEffect(() => {
    if (!autoFocus) return;
    const frame = window.requestAnimationFrame(() => resolvedInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus, resolvedInputRef]);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const foundUsers = await searchUsers({
          query: trimmedQuery,
          limit,
          excludeUserId,
        });

        if (!cancelled) {
          setResults(foundUsers);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [excludeUserId, limit, query]);

  return (
    <>
      <SearchInput
        ref={resolvedInputRef}
        value={query}
        onChange={setQuery}
        placeholder="Buscar usuarios"
        className={inputClassName}
        emptyAction={emptyAction}
      />

      <div className={resultsClassName}>
        {query.trim().length < 2 ? (
          <SearchEmptyState text="Escribe al menos 2 letras para buscar usuarios." />
        ) : loading ? (
          <div className="flex justify-center py-[var(--space-12)]">
            <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40" />
          </div>
        ) : results.length === 0 ? (
          <SearchEmptyState text="No se han encontrado usuarios." />
        ) : (
          <div className="flex flex-col">
            {results.map((result) => (
              <Link
                key={result.id}
                href={`/profile/${result.id}`}
                onClick={onResultClick}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-inset/50"
              >
                <SearchUserAvatar name={result.nombre} image={result.profile_image} />
                <span className="min-w-0 truncate text-body-sm font-[var(--fw-semibold)] text-app">
                  {result.nombre}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function SearchEmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <Search className="size-12 opacity-20" aria-hidden />
      <p className="text-body-sm text-muted">{text}</p>
    </div>
  );
}

function SearchUserAvatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return <Image src={image} alt={name} width={40} height={40} className="size-10 shrink-0 rounded-full object-cover" unoptimized referrerPolicy="no-referrer" />;
  }

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-body-sm font-[var(--fw-semibold)] text-app">
      {(name.trim()[0] || "U").toUpperCase()}
    </div>
  );
}
