// TabsContent only renders inside <Tabs>. Each cell is a full working Tabs whose
// selected panel is the subject — a plain text body and a richer composed one.
// Content is distinct from Tabs.tsx, TabsList.tsx and TabsTrigger.tsx.
import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from 'safe-unfollow';

export function TextPanel() {
  return (
    <Tabs defaultValue="privacy" className="w-full max-w-lg">
      <TabsList>
        <TabsTrigger value="privacy">Privacy</TabsTrigger>
        <TabsTrigger value="limits">Limits</TabsTrigger>
      </TabsList>
      <TabsContent value="privacy" className="text-sm text-muted-foreground">
        Your export is parsed by a Web Worker in this browser and stored in IndexedDB. Nothing is
        uploaded, and there is no account to create.
      </TabsContent>
      <TabsContent value="limits" className="text-sm text-muted-foreground">
        Tested to 1,000,000 accounts. Filtering stays under 5&nbsp;ms at that size.
      </TabsContent>
    </Tabs>
  );
}

export function RichPanel() {
  return (
    <Tabs defaultValue="badges" className="w-full max-w-lg">
      <TabsList>
        <TabsTrigger value="badges">Badges</TabsTrigger>
        <TabsTrigger value="sorting">Sorting</TabsTrigger>
      </TabsList>
      <TabsContent value="badges">
        <p className="text-sm text-muted-foreground">
          Every account carries the badges that apply to it:
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge>Mutuals</Badge>
          <Badge variant="destructive">Recently unfollowed</Badge>
          <Badge variant="outline">Not following back</Badge>
          <Badge variant="secondary">Following</Badge>
        </div>
      </TabsContent>
      <TabsContent value="sorting" className="text-sm text-muted-foreground">
        Sort A&ndash;Z or by the order accounts appear in your export.
      </TabsContent>
    </Tabs>
  );
}
