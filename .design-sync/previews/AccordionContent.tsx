import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from 'safe-unfollow';

export function ShortAnswer() {
  return (
    <Accordion type="single" collapsible defaultValue="reminder" className="w-full max-w-2xl">
      <AccordionItem value="reminder">
        <AccordionTrigger>Can I set a reminder to check back?</AccordionTrigger>
        <AccordionContent>
          Yes — the export guide can add a calendar reminder for when your data is usually ready.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function LongAnswer() {
  return (
    <Accordion type="single" collapsible defaultValue="analyze" className="w-full max-w-2xl">
      <AccordionItem value="analyze">
        <AccordionTrigger>How do I find unfollowers from my data download?</AccordionTrigger>
        <AccordionContent>
          Upload your Instagram ZIP file to this tracker. The tool unpacks your follower and
          following lists locally in your browser, compares them, and highlights who unfollowed you.
          Results show unfollowers, non-mutuals, and mutual followers — all processed offline with
          zero server involvement, and it takes under 30 seconds for typical exports.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
