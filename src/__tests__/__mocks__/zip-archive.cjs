// A ZipArchive double: the same members the interface declares.
//
// It replaces __mocks__/jszip.cjs, which reimplemented JSZip's `files` /
// `file(regex)` / `async()` — the surface the parser used, and now the surface
// it names. No test in the repository mentions a ZIP library any more.
const createEntry = (name, textMock) => ({
  name,
  text: textMock,
});

const MockZipArchive = function () {
  const filesMap = new Map();

  return {
    get names() {
      return [...filesMap.keys()];
    },

    // The real adapter counts every entry and retains names only up to its
    // bound; nothing here is large enough for the two to differ.
    get count() {
      return filesMap.size;
    },

    find: function (pattern) {
      const matched = [];
      for (const [name, file] of filesMap.entries()) {
        if (pattern.test(name)) matched.push(createEntry(name, file.text));
      }
      return matched;
    },

    // Helper method to add files to the mock
    _addFile: function (name, textMock) {
      filesMap.set(name, { text: textMock });
    },
  };
};

module.exports = { MockZipArchive };
module.exports.default = MockZipArchive;
