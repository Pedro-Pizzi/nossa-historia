import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export default async function HomePage() {
  if (!(await currentAccount())) redirect("/login");

  const { StoryPage } = await import("@/features/story/server/story-page");
  return <StoryPage />;
}
