/**
 * Classify and sort manifest sections intelligently for picker UI.
 * Works cross-domain (Germany, Spain, etc.) by considering both code and name semantics.
 *
 * Priority buckets (in display order):
 * 1. Floor/Standing/Special Premium Areas (Pista, Gold Circle, Standing, Floor, Pit, Stehplatz, etc.)
 * 2. Other Important Named Areas (Box, Loge, Club, VIP – but not numeric-only)
 * 3. Numeric Seating Sections
 * 4. Unknown/Fallback Items
 */

/**
 * Classify a single section item into a priority bucket.
 * @param {object} item - { code: string, name: string }
 * @returns {number} - Priority value (lower = higher priority, appears first)
 */

export function classifySectionPriority(item) {
  if (!item || !item.code || !item.name) return 4;

  const codeLower = String(item.code).toLowerCase().trim();
  const nameLower = String(item.name).toLowerCase().trim();
  const combined = `${codeLower} ${nameLower}`;

  // Priority 0: Floor/Standing/Special Premium Areas
  // Keywords: pista, general, standing, floor, pit, admission, gold circle, stehplatz, innenraum
  const floorKeywords = [
    "pista",
    "general",
    "standing",
    "floor",
    "pit",
    "admission",
    "gold circle",
    "golden circle",
    "steh",
    "innenraum",
  ];
  if (floorKeywords.some((kw) => combined.includes(kw))) {
    return 0;
  }

  // Priority 1: Other Important Named Areas (Box, Loge, Club, VIP)
  // But exclude pure numeric codes/names to keep those in seating section bucket
  const specialKeywords = ["loge", "box", "club", "vip"];
  const hasSpecialKeyword = specialKeywords.some((kw) => combined.includes(kw));
  const isNumericOnly = /^\d+$/.test(codeLower);
  if (hasSpecialKeyword && !isNumericOnly) {
    return 1;
  }

  // Priority 2: Non-numeric codes (e.g., ET, GCL, GCR, ST*, L*)
  // These are typically special or premium sections
  if (!/^\d+$/.test(codeLower)) {
    return 2;
  }

  // Priority 3: Numeric seating sections
  if (/^\d+$/.test(codeLower)) {
    return 3;
  }

  // Priority 4: Unknown/fallback
  return 4;
}

/**
 * Sort manifest sections by priority and secondary criteria.
 * @param {Array<{code: string, name: string}>} sections
 * @returns {Array<{code: string, name: string}>} - Sorted copy
 */
export function sortManifestSections(sections) {
  if (!Array.isArray(sections)) return [];

  // Create array with priority info for sorting
  const withPriority = sections.map((item) => ({
    ...item,
    priority: classifySectionPriority(item),
  }));

  // Sort by priority, then by secondary criteria within priority group
  withPriority.sort((a, b) => {
    // First: compare by priority
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    // Within same priority:
    const priorityGroup = a.priority;

    // Numeric codes: sort numerically
    if (priorityGroup === 3) {
      const numA = parseInt(a.code, 10);
      const numB = parseInt(b.code, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
    }

    // Everything else: sort alphabetically by code
    return String(a.code).localeCompare(String(b.code));
  });

  // Strip priority info before returning
  return withPriority.map(({ priority, ...rest }) => rest);
}
