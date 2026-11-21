"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Search, X } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { getPublicUserProfile, searchUsers, type PublicUserProfileDto } from "@/services/api/repositories/users.repository";
import { addRecent, clearRecents, readRecents, removeRecent, type RecentUser } from "@/lib/recentSearches";

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
  const [recents, setRecents] = useState<RecentUser[]>([]);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const resolvedInputRef = inputRef ?? fallbackInputRef;

  useEffect(() => {
    if (!autoFocus) return;
    const frame = window.requestAnimationFrame(() => resolvedInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus, resolvedInputRef]);

  // Recientes: solo en este dispositivo. Al mostrarlos se descartan los perfiles que ya no existen.
  useEffect(() => {
    if (!excludeUserId) {
      setRecents([]);
      return;
    }
    const stored = readRecents(excludeUserId);
    setRecents(stored);
    if (stored.length === 0) return;

    let cancelled = false;
    void Promise.all(
      stored.map(async (item) => {
        try {
          return (await getPublicUserProfile(item.id)) ? null : item.id;
        } catch {
          return null; // error de red: se conserva
        }
      }),
    ).then((gone) => {
      if (cancelled) return;
      const missing = gone.filter((id): id is string => id !== null);
      if (missing.length === 0) return;
      let next = stored;
      for (const id of missing) next = removeRecent(excludeUserId, id);
      setRecents(next);
    });
    return () => {
      cancelled = true;
    };
  }, [excludeUserId]);

  function handleResultClick(result: PublicUserProfileDto) {
    if (excludeUserId) setRecents(addRecent(excludeUserId, result));
    setQuery("");
    onResultClick?.();
  }

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
        {query.trim().length < 2 && recents.length > 0 ? (
          <div className="flex flex-col">
            <div className="flex items-center justify-between px-5 pb-1 pt-2">
              <span className="text-caption font-[var(--fw-semibold)] text-muted">Recientes</span>
              <button
                type="button"
                onClick={() => {
                  if (excludeUserId) clearRecents(excludeUserId);
                  setRecents([]);
                }}
                className="text-caption text-muted transition-colors hover:text-app"
              >
                Borrar todo
              </button>
            </div>
            {recents.map((item) => (
              <div key={item.id} className="flex items-center transition-colors hover:bg-surface-inset/50">
                <Link
                  href={`/profile/${item.id}`}
                  onClick={() => handleResultClick(item as PublicUserProfileDto)}
                  className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-5"
                >
                  <SearchUserAvatar name={item.nombre} image={item.profile_image} />
                  <span className="min-w-0 truncate text-body-sm font-[var(--fw-semibold)] text-app">{item.nombre}</span>
                </Link>
                <button
                  type="button"
                  aria-label={`Quitar a ${item.nombre} de recientes`}
                  onClick={() => excludeUserId && setRecents(removeRecent(excludeUserId, item.id))}
                  className="mr-3 flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-app"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        ) : query.trim().length < 2 ? (
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
                onClick={() => handleResultClick(result)}
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
