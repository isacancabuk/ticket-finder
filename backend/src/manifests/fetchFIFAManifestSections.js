/**
 * Fetches the price range categories for a FIFA WC26 event and returns
 * section code + name pairs for the manifest sections helper.
 * 
 * NOTE: As requested, this now returns a static list of categories instead of making an API request.
 *
 * @param {object} opts
 * @param {string} opts.eventId - perfId from URL
 * @param {string} [opts.variant] - "shop" or "resale" from URL (defaults to "shop")
 * @param {string} [opts.productId] - Optional productId. If not provided, fetches from HTML.
 * @returns {Promise<{ success: boolean, sections?: Array<{code: string, name: string}>, error?: string }>}
 */
export async function fetchFIFAManifestSections() {
  const sections = [
    { code: "Category 1", name: "Kategori 1" },
    { code: "Category 2", name: "Kategori 2" },
    { code: "Category 3", name: "Kategori 3" },
    { code: "Category 4", name: "Kategori 4" },
    { code: "Front Category 1", name: "Ön Kategori 1" },
    { code: "Front Category 2", name: "Ön Kategori 2" },
  ];

  return { success: true, sections };
}
