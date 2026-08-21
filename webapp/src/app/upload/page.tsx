import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Nav } from "@/components/nav";
import { uploadAndImport } from "./actions";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <Nav current="/upload" title="Import a month" />
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Import a month</CardTitle>
            <CardDescription>
              Any subset of the four files is fine — Bank, Cal, and Max&apos;s two tabs (local + abroad).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={uploadAndImport} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bank">Bank export</Label>
                <input id="bank" name="bank" type="file" accept=".csv" className="text-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cal">Cal export</Label>
                <input id="cal" name="cal" type="file" accept=".csv" className="text-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="maxLocal">Max — local deals</Label>
                <input id="maxLocal" name="maxLocal" type="file" accept=".csv" className="text-sm" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="maxAbroad">Max — abroad deals</Label>
                <input id="maxAbroad" name="maxAbroad" type="file" accept=".csv" className="text-sm" />
              </div>
              {error && <p className="text-sm text-red-600">{decodeURIComponent(error)}</p>}
              <Button type="submit">Import</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
