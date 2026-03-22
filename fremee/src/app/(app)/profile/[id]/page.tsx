import ProfileClient from "./ProfileClient";

export async function generateStaticParams() {
  // For Capacitor static export: pre-render a shell page.
  // Client-side useParams() handles the actual profile ID at runtime.
  return [{ id: "static" }];
}

export default async function ProfilePage() {
  return <ProfileClient />;
}
