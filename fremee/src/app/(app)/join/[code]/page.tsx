import JoinPageClient from "./JoinPageClient";

export async function generateStaticParams() {
  return [{ code: "static" }];
}

export default function JoinPage() {
  return <JoinPageClient />;
}
