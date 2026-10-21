import Link from "next/link";
import { AIGenerateForm, RecipeForm } from "@/components/admin/recipe-forms";
import { Card, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";

export const metadata = { title: "New recipe | Recipe Remix Admin" };

export default async function NewRecipePage() {
  await requireAdmin();
  const aiEnabled = Boolean(process.env.OPENROUTER_API_KEY);
  return (
    <>
      <Link href="/recipes" className="text-sm font-bold text-emerald-700 hover:underline">
        ← All recipes
      </Link>
      <PageHeader title="New recipe" subtitle="Generate one with the same AI pipeline as the app, or write one by hand." />
      <div className="grid gap-5 xl:grid-cols-5">
        <Card title="✨ Generate with AI" note="Text from Gemini Flash, photo from Gemini Flash Image, saved under your account." className="h-fit xl:col-span-2">
          {aiEnabled ? (
            <AIGenerateForm />
          ) : (
            <p className="rounded-2xl bg-butter/60 p-3 text-sm text-amber-900">
              Set <code>OPENROUTER_API_KEY</code> on this deployment to enable AI generation.
            </p>
          )}
        </Card>
        <Card title="✍️ Write by hand" note="Saved with model “admin/manual”." className="xl:col-span-3">
          <RecipeForm />
        </Card>
      </div>
    </>
  );
}
