import { useMemo } from 'react';

/**
 * Builds the subject and level options from the resources that were actually
 * fetched, so a dropdown can never offer a value that matches nothing.
 *
 * The dropdown used to hold a hard coded list of four subjects and three levels.
 * Those were the values in the original four-row seed, so the moment the library
 * held real content the two lists diverged: choosing any subject, or the
 * "advanced" level, returned no resources at all. Nothing in that is visible
 * until each option is clicked, because the unfiltered list still looks correct.
 *
 * Deriving both lists from the data makes that class of bug impossible by
 * construction. The one trade-off is that an option only appears once a matching
 * resource is on the page, which is the right behaviour here: the library is
 * small enough to fit on a page, and an option that appears and then vanishes
 * when you filter would be worse.
 */
const LEVEL_ORDER = ['beginner', 'intermediate', 'advanced'];

const prettify = (raw) =>
  String(raw || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const useFilterOptions = (resources, facets) =>
  useMemo(() => {
    const subjects = new Set();
    const levels = new Set();

    // The API sends the whole vocabulary. Falling back to the rows keeps this
    // working if that field is ever absent, and the page asks for twelve rows at
    // a time, so the fallback alone would miss anything off the first page.
    (facets?.subjects || []).forEach((s) => subjects.add(prettify(s)));
    (facets?.levels || []).forEach((l) => levels.add(String(l).toLowerCase()));

    (resources || []).forEach((r) => {
      if (r.subject) subjects.add(prettify(r.subject));
      if (r.difficulty_level) levels.add(String(r.difficulty_level).toLowerCase());
    });

    return {
      subjects: [...subjects].sort((a, b) => a.localeCompare(b)),
      // Known levels keep their intended order; anything unexpected goes last.
      levels: [...levels].sort(
        (a, b) => {
          const ai = LEVEL_ORDER.indexOf(a);
          const bi = LEVEL_ORDER.indexOf(b);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        }
      )
    };
  }, [resources, facets]);

export default useFilterOptions;
