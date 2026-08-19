import { Tabs, TabsList, TabsTrigger, TabsContent } from 'safe-unfollow';

export function ExportFormat() {
  return (
    <Tabs defaultValue="csv" className="w-full max-w-sm">
      <TabsList>
        <TabsTrigger value="csv">CSV</TabsTrigger>
        <TabsTrigger value="json">JSON</TabsTrigger>
      </TabsList>
      <TabsContent value="csv" className="text-sm text-muted-foreground">
        Opens directly in Excel or Google Sheets. Best for a quick look at your results.
      </TabsContent>
      <TabsContent value="json" className="text-sm text-muted-foreground">
        Structured data with every badge included. Best for importing into another tool.
      </TabsContent>
    </Tabs>
  );
}

export function AccountFilters() {
  return (
    <Tabs defaultValue="unfollowed" className="w-full max-w-md">
      <TabsList>
        <TabsTrigger value="all">All accounts</TabsTrigger>
        <TabsTrigger value="unfollowed">Unfollowed</TabsTrigger>
        <TabsTrigger value="mutuals">Mutuals</TabsTrigger>
      </TabsList>
      <TabsContent value="all" className="text-sm text-muted-foreground">
        Showing all 3,857 accounts from your export.
      </TabsContent>
      <TabsContent value="unfollowed" className="text-sm text-muted-foreground">
        96 accounts stopped following you since your last export.
      </TabsContent>
      <TabsContent value="mutuals" className="text-sm text-muted-foreground">
        1,204 accounts follow you back.
      </TabsContent>
    </Tabs>
  );
}
