import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from 'safe-unfollow';

export function DataQuestions() {
  return (
    <Accordion type="single" collapsible defaultValue="scale" className="w-full max-w-2xl">
      <AccordionItem value="included">
        <AccordionTrigger>What data does Instagram include in my data download?</AccordionTrigger>
        <AccordionContent>
          The ZIP file contains your profile info, followers list, following list, and more. For
          unfollower tracking, the key files are followers_1.json and following.json.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="scale">
        <AccordionTrigger>What size Instagram export can you analyze?</AccordionTrigger>
        <AccordionContent>
          This tracker handles exports up to 1,000,000+ accounts using columnar storage and bitset
          indexing — filtering stays under 5ms even at that scale.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="free">
        <AccordionTrigger>Is this tracker really free?</AccordionTrigger>
        <AccordionContent>
          Yes. It&apos;s 100% free, open-source (MIT license), with no subscriptions, paywalls, or
          hidden limits.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
