// Browser check: no tags at all.
async (page) => {
  return `ok ${page.url()}`;
};
