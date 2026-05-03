// All icon exports — backed by Lucide React.
// Usage: `import { PlusIcon, XIcon } from "@/components/icons"`

export {
  Plus as PlusIcon,
  ArrowLeft as ArrowLeftIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ChevronDown as ChevronDownIcon,
  X as XIcon,
  PhoneOff as PhoneOffIcon,
} from "lucide-react";

import { Eye, EyeOff } from "lucide-react";

/** Renders Eye or EyeOff depending on `open` prop. */
export function EyeIcon({ open, className = "size-5" }: { open: boolean; className?: string }) {
  const Icon = open ? Eye : EyeOff;
  return <Icon className={className} aria-hidden />;
}
