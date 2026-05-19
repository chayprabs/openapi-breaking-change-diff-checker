"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LoginActions() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <p className="text-muted text-sm">Checking session…</p>;
  }

  if (session?.user) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-foreground">
          Signed in as {session.user.email ?? session.user.name ?? "your account"}.
        </p>
        <Link
          className="bg-accent text-accent-foreground inline-flex rounded-full px-5 py-3 text-sm font-medium"
          href="/account"
        >
          Open saved reports
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button onClick={() => void signIn("github", { callbackUrl: "/account" })} type="button">
        Sign in with GitHub
      </Button>
      <p className="text-muted text-sm leading-6">
        Configure AUTH_GITHUB_ID and AUTH_GITHUB_SECRET in your deployment to enable GitHub sign-in.
      </p>
    </div>
  );
}
