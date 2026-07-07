import type { TicketType } from "@/services/api/endpoints/wallet.endpoint";

export function TicketTypeIcon({
  type,
  className = "size-[14px]",
}: {
  type: TicketType;
  className?: string;
}) {
  if (type === "flight") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <path d="M3 13.5L21 6.5L14.5 21L11.5 14.5L5 11.5L3 13.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "ferry") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <path d="M4 16.5L12 20L20 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 14.5V6.5H17V14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 14.5H19L17 17H7L5 14.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "train") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <rect x="5" y="4" width="14" height="16" rx="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5 14H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8.5" cy="18" r="1" fill="currentColor" />
        <circle cx="15.5" cy="18" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (type === "concert") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <path d="M7 6.5V17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M17 6.5V17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7 8.5C9 8.5 9.5 6.5 12 6.5C14.5 6.5 15 8.5 17 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 15.5C9 15.5 9.5 13.5 12 13.5C14.5 13.5 15 15.5 17 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "match") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 4V20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M4 12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "hotel") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <path d="M3 20V8L12 4L21 8V20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="9" y="14" width="6" height="6" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 10H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M5 6.5H19V17.5H5V6.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 9.5H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 13.5H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
