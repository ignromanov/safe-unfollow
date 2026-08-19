import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from 'safe-unfollow';

export function Interactive() {
  return (
    <Accordion type="single" collapsible defaultValue="download" className="w-full max-w-2xl">
      <AccordionItem value="download">
        <AccordionTrigger>How long does the data download take?</AccordionTrigger>
        <AccordionContent>
          Meta typically sends your data within 5-30 minutes via email. Larger accounts may take up
          to a few hours.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="safety">
        <AccordionTrigger>Will my Instagram account be safe using this tracker?</AccordionTrigger>
        <AccordionContent>
          Yes, 100% safe. This tool uses your official data export — no login, no password, no
          access to your account.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function MultipleOpen() {
  return (
    <Accordion type="multiple" defaultValue={['csv', 'json']} className="w-full max-w-2xl">
      <AccordionItem value="csv">
        <AccordionTrigger>Export as CSV</AccordionTrigger>
        <AccordionContent>Opens directly in Excel or Google Sheets.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="json">
        <AccordionTrigger>Export as JSON</AccordionTrigger>
        <AccordionContent>Structured data with every badge included.</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
