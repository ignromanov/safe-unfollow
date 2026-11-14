import { describe, expect, it } from 'vitest';
import { analyzeZipStructure } from '@/core/parsers/instagram-zip-analysis';

const RELATIONSHIPS = [
  'connections/followers_and_following/followers_1.json',
  'connections/followers_and_following/following.json',
];

describe('archiveScope (v1.8 task 02)', () => {
  it('is followers_only for an export of the relationship folder alone', () => {
    expect(analyzeZipStructure(RELATIONSHIPS).archiveScope).toBe('followers_only');
  });

  it('is followers_only for the legacy root folder alone', () => {
    expect(analyzeZipStructure(['followers_and_following/following.json']).archiveScope).toBe(
      'followers_only'
    );
  });

  it.each(['media', 'messages', 'your_instagram_activity', 'personal_information'])(
    'is extended when the archive also has a top-level %s folder',
    folder => {
      const files = [...RELATIONSHIPS, `${folder}/some_file.json`];
      expect(analyzeZipStructure(files).archiveScope).toBe('extended');
    }
  );

  it('ignores a file at the root that only shares a folder name', () => {
    // A root file is not a folder; only `name/...` entries count.
    expect(analyzeZipStructure([...RELATIONSHIPS, 'media']).archiveScope).toBe('followers_only');
  });

  it('is decided on every top-level folder, not on the five kept for diagnostics', () => {
    const files = [
      ...RELATIONSHIPS,
      'a/x.json',
      'b/x.json',
      'c/x.json',
      'd/x.json',
      'e/x.json',
      'messages/inbox/x.json',
    ];
    const analysis = analyzeZipStructure(files);
    expect(analysis.topLevelFolders).not.toContain('messages');
    expect(analysis.archiveScope).toBe('extended');
  });
});
