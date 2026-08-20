// TabsList only renders inside <Tabs>. Each cell is a full working Tabs whose list
// is the subject — how it behaves at two, four, and long-label widths. Content is
// distinct from Tabs.tsx's cells.
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'safe-unfollow';

export function TwoTabs() {
  return (
    <Tabs defaultValue="json" className="w-full max-w-sm">
      <TabsList>
        <TabsTrigger value="json">JSON</TabsTrigger>
        <TabsTrigger value="html">HTML</TabsTrigger>
      </TabsList>
      <TabsContent value="json" className="text-sm text-muted-foreground">
        The format this tool can read. Pick it in Meta&rsquo;s export dialog.
      </TabsContent>
      <TabsContent value="html" className="text-sm text-muted-foreground">
        Readable in a browser, but cannot be parsed &mdash; the cause of most failed uploads.
      </TabsContent>
    </Tabs>
  );
}

export function FourTabs() {
  return (
    <Tabs defaultValue="notFollowingBack" className="w-full max-w-2xl">
      <TabsList>
        <TabsTrigger value="followers">Followers</TabsTrigger>
        <TabsTrigger value="following">Following</TabsTrigger>
        <TabsTrigger value="notFollowingBack">Not following back</TabsTrigger>
        <TabsTrigger value="pending">Pending</TabsTrigger>
      </TabsList>
      <TabsContent value="followers" className="text-sm text-muted-foreground">
        1,284 accounts follow you.
      </TabsContent>
      <TabsContent value="following" className="text-sm text-muted-foreground">
        1,530 accounts you follow.
      </TabsContent>
      <TabsContent value="notFollowingBack" className="text-sm text-muted-foreground">
        212 accounts you follow that do not follow you back.
      </TabsContent>
      <TabsContent value="pending" className="text-sm text-muted-foreground">
        18 follow requests still awaiting a response.
      </TabsContent>
    </Tabs>
  );
}
