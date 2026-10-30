import { ResourceNewPage } from "@/components/admin/crud";

export const metadata = { title: "New | Signup domains | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <ResourceNewPage resourceKey="signup-domains" />;
}
