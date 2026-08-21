import { RecipeCard } from 'safe-unfollow';

// The reference block inside GuideEntry: the five settings to choose in
// Instagram's export dialog. The `format` row is the only one that is not a
// green check — `html_format` is 55.2% of every upload failure on the site,
// and the amber is the same register the error screen paints that failure in
// once it has happened, so a reader who ignores the warning meets the colour
// twice (RecipeCard.tsx:14-32).
//
// Two of these five strings are unverified against Instagram's real dialog —
// `range` ("All time") and `content` ("Followers and following") are on the
// owner's device-check list precisely because no help-centre article settles
// them and accountscenter.instagram.com requires a login. Do not read this
// card as confirmation that the wording matches Meta's.
//
// `max-w-lg` reproduces the width the card actually gets in place: GuideEntry
// is `max-w-xl` (576px) with `p-6 md:p-8`, i.e. 528px shrinking to 512px.
export function Default() {
  return (
    <div className="max-w-lg">
      <RecipeCard />
    </div>
  );
}
