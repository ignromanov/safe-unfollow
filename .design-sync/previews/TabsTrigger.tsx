// TabsTrigger only renders inside <Tabs><TabsList>. Each cell is a full working Tabs
// where the trigger row is the subject — the selected-vs-unselected axis, and the
// disabled state. Content is distinct from Tabs.tsx and TabsList.tsx.
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'safe-unfollow';

export function SelectedAndUnselected() {
  return (
    <Tabs defaultValue="unfollowed" className="w-full max-w-md">
      <TabsList>
        <TabsTrigger value="unfollowed">Recently unfollowed</TabsTrigger>
        <TabsTrigger value="mutuals">Mutuals</TabsTrigger>
      </TabsList>
      <TabsContent value="unfollowed" className="text-sm text-muted-foreground">
        96 accounts stopped following you since your previous export.
      </TabsContent>
      <TabsContent value="mutuals" className="text-sm text-muted-foreground">
        1,204 accounts follow each other with you.
      </TabsContent>
    </Tabs>
  );
}

export function WithDisabled() {
  return (
    <Tabs defaultValue="results" className="w-full max-w-md">
      <TabsList>
        <TabsTrigger value="results">Results</TabsTrigger>
        <TabsTrigger value="compare" disabled>
          Compare exports
        </TabsTrigger>
      </TabsList>
      <TabsContent value="results" className="text-sm text-muted-foreground">
        Your current export, analyzed locally.
      </TabsContent>
      <TabsContent value="compare" className="text-sm text-muted-foreground">
        Upload a second export to compare over time.
      </TabsContent>
    </Tabs>
  );
}
