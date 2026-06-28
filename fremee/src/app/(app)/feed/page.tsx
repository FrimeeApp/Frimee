import { redirect } from "next/navigation";
import { APP_HOME_PATH } from "@/config/app";

export default function FeedPage() {
  redirect(APP_HOME_PATH);
}
