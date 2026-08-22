import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";
import { signIn, signInWithGoogle, signUp } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/");
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>expenses-tracker</CardTitle>
          <CardDescription>Sign in, or create an account if you&apos;re new.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-red-600">{decodeURIComponent(error)}</p>}
            <div className="flex gap-2 pt-2">
              <Button type="submit" formAction={signIn} className="flex-1">
                Sign in
              </Button>
              <Button type="submit" formAction={signUp} variant="outline" className="flex-1">
                Create account
              </Button>
            </div>
            <div className="relative py-2 text-center text-xs text-muted-foreground">
              <span className="bg-card relative z-10 px-2">or</span>
              <div className="absolute inset-x-0 top-1/2 border-t" />
            </div>
            <Button type="submit" formAction={signInWithGoogle} formNoValidate variant="outline">
              Sign in with Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
