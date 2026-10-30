import { ResourceNewPage } from "@/components/admin/crud";

export const metadata = { title: "New | Whitelisted emails | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <ResourceNewPage resourceKey="whitelist" />;
}
