import NotificationsPageClient from "../../notifications/NotificationsPageClient";

export default function InterceptedNotificationsPage() {
  return <NotificationsPageClient presentation="overlay" />;
}
