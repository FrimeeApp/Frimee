import { redirect } from "next/navigation";
import { APP_HOME_PATH } from "@/config/app";

export const dynamic = "force-static";

export async function generateStaticParams() {
  return [{ id: "_" }, { id: "static" }];
}

export default function PlanPostPage() {
  redirect(APP_HOME_PATH);
}
