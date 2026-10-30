import { ResourceListPage } from "@/components/admin/crud";

export const metadata = { title: "Whitelisted emails | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <ResourceListPage resourceKey="whitelist" searchParams={searchParams} />;
}
