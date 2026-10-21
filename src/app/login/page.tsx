import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { Pot, Sparkle, Whisk } from "@/components/doodles";

export const metadata = { title: "Sign in | Recipe Remix Admin" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/";
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="relative w-full max-w-md animate-rise rounded-[36px] border-2 border-zinc-200 bg-white p-8 text-center shadow-soft">
        <Whisk className="sticker absolute -right-5 -top-6 h-16 w-16 animate-float [--r:14deg]" />
        <Sparkle className="absolute -bottom-3 left-10 h-7 w-7 animate-twinkle" />
        <Pot className="mx-auto h-20 w-20" />
        <p className="mt-4 inline-block rounded-full bg-cocoa px-3 py-1 text-xs font-bold uppercase tracking-widest text-cream">
          Staff only
        </p>
        <h1 className="mt-3 text-3xl font-bold text-cocoa">Back of house</h1>
        <p className="mt-2 text-base leading-7 text-zinc-600">
          The Recipe Remix admin panel. Sign in with a Google account that has superadmin access.
        </p>
        {error && (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">Sign-in failed: {error}</div>
        )}
        <div className="mt-8">
          <GoogleSignInButton next={next} />
        </div>
      </div>
    </main>
  );
}
