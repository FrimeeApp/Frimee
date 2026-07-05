type ActiveNavIconProps = {
  className?: string;
};

export const ActivePlansIcon = ({ className }: ActiveNavIconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
    <path
      d="M14.106 5.553C14.3836 5.69172 14.6897 5.76393 15 5.76393C15.3103 5.76393 15.6164 5.69172 15.894 5.553L19.553 3.723C19.7056 3.64676 19.8751 3.61081 20.0455 3.61857C20.2159 3.62633 20.3814 3.67754 20.5265 3.76733C20.6715 3.85712 20.7911 3.98251 20.874 4.13158C20.9569 4.28065 21.0003 4.44844 21 4.619V17.383C20.9999 17.5687 20.9481 17.7506 20.8504 17.9085C20.7528 18.0664 20.6131 18.194 20.447 18.277L15.894 20.554C15.6164 20.6927 15.3103 20.7649 15 20.7649C14.6897 20.7649 14.3836 20.6927 14.106 20.554L9.894 18.448C9.6164 18.3093 9.31033 18.2371 9 18.2371C8.68967 18.2371 8.3836 18.3093 8.106 18.448L4.447 20.278C4.29435 20.3543 4.12472 20.3902 3.95426 20.3824C3.78379 20.3746 3.61816 20.3233 3.47312 20.2334C3.32808 20.1435 3.20846 20.018 3.12565 19.8688C3.04283 19.7196 2.99958 19.5516 3 19.381V6.618C3.0001 6.43234 3.05188 6.25037 3.14955 6.09247C3.24722 5.93458 3.38692 5.80699 3.553 5.724L8.106 3.447C8.3836 3.30828 8.68967 3.23607 9 3.23607C9.31033 3.23607 9.6164 3.30828 9.894 3.447L14.106 5.553Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M8 4.5L4 6.5V19.5L8 17.5V4.5Z" fill="currentColor" />
    <path d="M10 17.5V4.5L14 6.5V19.5L10 17.5Z" fill="currentColor" />
    <path d="M20 4.5L16 6.5V19.5L20 17.5V4.5Z" fill="currentColor" />
  </svg>
);

export const ActiveExpensesIcon = ({ className }: ActiveNavIconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
    <path
      d="M20 5H4C2.89543 5 2 5.89543 2 7V17C2 18.1046 2.89543 19 4 19H20C21.1046 19 22 18.1046 22 17V7C22 5.89543 21.1046 5 20 5Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M22 6H2V9H22V6Z" fill="currentColor" />
    <path d="M22 11H2V18H22V11Z" fill="currentColor" />
  </svg>
);

export const ActiveSearchIcon = ({ className }: ActiveNavIconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
    <path
      d="M21 21L16.66 16.66"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="11" cy="11" r="6" fill="currentColor" />
  </svg>
);

export const ActiveMessagesIcon = ({ className }: ActiveNavIconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
    <path
      d="M14.536 21.686C14.574 21.7807 14.64 21.8615 14.7253 21.9175C14.8105 21.9736 14.9109 22.0023 15.0128 21.9996C15.1148 21.997 15.2136 21.9633 15.2958 21.9029C15.3781 21.8426 15.4399 21.7585 15.473 21.662L21.973 2.662C22.005 2.57339 22.0111 2.4775 21.9906 2.38555C21.9701 2.2936 21.9238 2.20939 21.8572 2.14278C21.7906 2.07616 21.7064 2.02989 21.6144 2.00939C21.5225 1.98889 21.4266 1.99499 21.338 2.027L2.338 8.527C2.2415 8.56009 2.15743 8.62192 2.09707 8.70417C2.03672 8.78642 2.00297 8.88517 2.00036 8.98716C1.99775 9.08914 2.02639 9.18949 2.08246 9.27473C2.13852 9.35996 2.21932 9.42601 2.314 9.464L10.244 12.644C10.4947 12.7444 10.7225 12.8945 10.9136 13.0852C11.1047 13.276 11.2552 13.5035 11.356 13.754L14.536 21.686Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M20.5 4.5L12 13L15 21L20.5 4.5Z" fill="currentColor" />
    <path d="M19.5 3.5L11 12L3 9L19.5 3.5Z" fill="currentColor" />
    <path d="M17.5 4C17.5 4 19.2602 3.26023 20 4C20.7398 4.73977 20 6.5 20 6.5" stroke="currentColor" />
    <path d="M20.5 3.5L21 3L20 4" stroke="currentColor" />
  </svg>
);
