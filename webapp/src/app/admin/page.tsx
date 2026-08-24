import { Nav } from "@/components/nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin-check";
import { createAdminClient } from "@/lib/supabase/admin";
import { DeleteUserButton } from "./delete-user-button";
import { GenerateCodeSection } from "./generate-code-section";

export default async function AdminPage() {
  const adminUser = await requireAdmin();

  const admin = createAdminClient();
  const [{ data: usersData, error: usersError }, { data: txRows }, { data: codes }] = await Promise.all([
    admin.auth.admin.listUsers(),
    admin.from("transactions").select("user_id"),
    admin.from("invite_codes").select("code, used, created_at").order("created_at", { ascending: false }),
  ]);

  const users = usersData?.users ?? [];
  const countByUser = new Map<string, number>();
  for (const row of txRows ?? []) {
    countByUser.set(row.user_id, (countByUser.get(row.user_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <Nav current="/admin" title="Admin" />

      {usersError && <p className="text-sm text-red-600">{usersError.message}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {users.length} account{users.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Signed up</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-right">{countByUser.get(u.id) ?? 0}</TableCell>
                    <TableCell>
                      {u.id !== adminUser.id && <DeleteUserButton userId={u.id} email={u.email ?? "this account"} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Invite codes</CardTitle>
          <CardDescription>Generate a code, then hand it directly to whoever you want to test the app.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <GenerateCodeSection />
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(codes ?? []).map((c) => (
                  <TableRow key={c.code}>
                    <TableCell className="font-mono">{c.code}</TableCell>
                    <TableCell>{c.used ? "Used" : "Unused"}</TableCell>
                    <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {(codes ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No codes yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
