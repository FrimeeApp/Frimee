import { Suspense } from "react";
import JoinPageClient from "./JoinPageClient";

export async function generateStaticParams() {
  return [{ code: "static" }];
}

export default function JoinPage() {
  // useSearchParams (native ?code=) needs a Suspense boundary in the static export.
  return (
    <Suspense>
      <JoinPageClient />
    </Suspense>
  );
}
