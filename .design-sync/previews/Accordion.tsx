import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from 'safe-unfollow';

export function Faq() {
  return (
    <Accordion type="single" collapsible defaultValue="q1" className="w-full max-w-2xl">
      <AccordionItem value="q1">
        <AccordionTrigger>
          How to check who unfollowed you on Instagram without an app?
        </AccordionTrigger>
        <AccordionContent>
          Open Meta Accounts Center → Create export → Select your profile → Choose &ldquo;Export to
          device&rdquo; → Select only &ldquo;Followers and following&rdquo; → Set format to JSON.
          Upload the ZIP here and the analysis runs entirely in your browser.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="q2">
        <AccordionTrigger>Do I need to log in with my Instagram password?</AccordionTrigger>
        <AccordionContent>
          No. This tool never asks for your credentials and never talks to Instagram. It only reads
          the official data export you download from Meta yourself.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="q3">
        <AccordionTrigger>Is my data uploaded to a server?</AccordionTrigger>
        <AccordionContent>
          Never. Parsing and filtering happen locally in your browser and the results are stored in
          IndexedDB on your own device.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function Collapsed() {
  return (
    <Accordion type="single" collapsible className="w-full max-w-2xl">
      <AccordionItem value="a">
        <AccordionTrigger>What file format should I choose?</AccordionTrigger>
        <AccordionContent>Choose JSON — HTML exports cannot be parsed.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionTrigger>How long does the export take?</AccordionTrigger>
        <AccordionContent>Usually 5&ndash;30 minutes for Meta to prepare the ZIP.</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
