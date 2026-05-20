import { useState, useMemo } from "react";
import Card from "./Card";
import FilterBar from "./FilterBar";

// Parse event date properly: handle multiple date formats
// Ticketmaster: "2026-06-10" (ISO date)
// FIFA: "12.06.2026 - 18:00" (DD.MM.YYYY - HH:MM)
function parseDate(dateStr) {
  if (!dateStr) return 0;
  try {
    const str = String(dateStr).trim();

    // DD.MM.YYYY or DD.MM.YYYY - HH:MM
    const dotMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dotMatch) {
      const [, day, month, year] = dotMatch;
      const timeMatch = str.match(/(\d{1,2}):(\d{2})$/);
      const hours = timeMatch ? parseInt(timeMatch[1], 10) : 0;
      const mins = timeMatch ? parseInt(timeMatch[2], 10) : 0;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hours, mins).getTime();
    }

    // YYYY-MM-DD or full ISO string
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }

    return 0;
  } catch (e) {
    return 0;
  }
}

function getDisplayStatus(query) {
  if (query.status === "PURCHASED") return "PURCHASED";
  if (query.status === "STOPPED") return "STOPPED";
  if (query.status === "ERROR") return "ERROR";
  if (query.priceExceeded && query.foundPrice != null) return "PRICE_EXCEEDED";
  if (query.status === "FOUND") return "FOUND";
  return "FINDING";
}

// Helper: get site name from query
function getQuerySite(q) {
  if (q.site) return q.site.toLowerCase();
  if (q.url) {
    if (q.url.toLowerCase().includes("ticketmaster")) return "ticketmaster";
    if (q.url.toLowerCase().includes("fifa")) return "fifa";
  }
  return "";
}

// Helper: get sale site from query
function getQuerySaleSite(q) {
  if (!q.saleSite || q.saleSite.trim() === "") return "Belirtilmemiş";
  return q.saleSite;
}

const SORT_PRIORITY = {
  FOUND: 1,
  PRICE_EXCEEDED: 2,
  ERROR: 3,
  FINDING: 4,
  PURCHASED: 5,
  STOPPED: 6,
};

// Apply a subset of filters (excluding the specified filter group)
function applyFilters(mapped, filterState, excludeFilter) {
  return mapped.filter((q) => {
    // Search filter
    if (excludeFilter !== "search" && filterState.searchQuery.trim()) {
      const query = filterState.searchQuery.toLowerCase();
      const matchesOrderNo = q.orderNo && q.orderNo.toLowerCase().includes(query);
      const matchesEventName = q.eventName && q.eventName.toLowerCase().includes(query);
      if (!matchesOrderNo && !matchesEventName) return false;
    }

    // Status filter
    if (excludeFilter !== "status" && filterState.selectedStatus !== "ALL" && q.displayStatus !== filterState.selectedStatus) {
      return false;
    }

    // Country filter
    if (excludeFilter !== "country" && filterState.selectedCountry !== "Tümü") {
      if (!q.domain || q.domain !== filterState.selectedCountry) return false;
    }

    // Site filter
    if (excludeFilter !== "site" && filterState.selectedSite !== "Tümü") {
      const expectedSite = filterState.selectedSite.toLowerCase();
      const querySite = getQuerySite(q);
      if (querySite !== expectedSite) return false;
    }

    // Sale Site filter
    if (excludeFilter !== "saleSite" && filterState.selectedSaleSite !== "Tümü") {
      const qSaleSite = getQuerySaleSite(q);
      if (qSaleSite !== filterState.selectedSaleSite) return false;
    }

    return true;
  });
}

export default function MainSection({ queries = [], onCardClick }) {
  const [filterState, setFilterState] = useState({
    searchQuery: "",
    selectedCountry: "Tümü",
    selectedSite: "Tümü",
    selectedSaleSite: "Tümü",
    sortDateAsc: false,
    selectedStatus: "ALL",
    sortByProfit: "HIGH", // HIGH, LOW
    primarySort: "profit", // "profit" or "date"
  });

  // Pre-compute displayStatus for all queries
  const mappedQueries = useMemo(() => {
    return queries.map((q) => ({
      ...q,
      displayStatus: getDisplayStatus(q),
    }));
  }, [queries]);

  // Cross-filter counts: each count excludes its own filter group
  const statusCounts = useMemo(() => {
    const filtered = applyFilters(mappedQueries, filterState, "status");
    const counts = {};
    filtered.forEach((q) => {
      counts[q.displayStatus] = (counts[q.displayStatus] || 0) + 1;
    });
    return counts;
  }, [mappedQueries, filterState]);

  const countryCounts = useMemo(() => {
    const filtered = applyFilters(mappedQueries, filterState, "country");
    const counts = {};
    filtered.forEach((q) => {
      const country = q.domain || "Bilinmiyor";
      counts[country] = (counts[country] || 0) + 1;
    });
    return counts;
  }, [mappedQueries, filterState]);

  const platformCounts = useMemo(() => {
    const filtered = applyFilters(mappedQueries, filterState, "site");
    const counts = {};
    filtered.forEach((q) => {
      let site = getQuerySite(q);
      // Normalize display names
      if (site === "ticketmaster") site = "ticketmaster";
      else if (site === "fifa") site = "fifa";
      else site = site || "Bilinmiyor";
      counts[site] = (counts[site] || 0) + 1;
    });
    return counts;
  }, [mappedQueries, filterState]);

  const saleSiteCounts = useMemo(() => {
    const filtered = applyFilters(mappedQueries, filterState, "saleSite");
    const counts = {};
    filtered.forEach((q) => {
      const saleSite = getQuerySaleSite(q);
      counts[saleSite] = (counts[saleSite] || 0) + 1;
    });
    return counts;
  }, [mappedQueries, filterState]);

  // Final displayed queries: apply ALL filters + sorting
  const displayedQueries = useMemo(() => {
    if (mappedQueries.length === 0) return [];

    let filtered = applyFilters(mappedQueries, filterState, null);

    // Sort: first by status priority, then by active sort mode
    filtered.sort((a, b) => {
      const pA = SORT_PRIORITY[a.displayStatus] || 99;
      const pB = SORT_PRIORITY[b.displayStatus] || 99;
      if (pA !== pB) return pA - pB;

      if (filterState.primarySort === "date") {
        // Date sorting active
        const timeA = a.eventDate
          ? parseDate(a.eventDate)
          : new Date(a.updatedAt || a.createdAt).getTime();
        const timeB = b.eventDate
          ? parseDate(b.eventDate)
          : new Date(b.updatedAt || b.createdAt).getTime();
        return filterState.sortDateAsc ? timeA - timeB : timeB - timeA;
      } else {
        // Profit sorting active
        const profitA = a.profitLoss ?? -Infinity;
        const profitB = b.profitLoss ?? -Infinity;
        return filterState.sortByProfit === "HIGH"
          ? profitB - profitA
          : profitA - profitB;
      }
    });

    return filtered;
  }, [mappedQueries, filterState]);

  if (queries.length === 0) {
    return (
      <div className="flex flex-col items-center mt-12">
        <p className="text-lg text-gray-400">
          No queries yet. Add an event URL above to start tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full pb-20">
      <FilterBar
        filterState={filterState}
        onFilterChange={setFilterState}
        statusCounts={statusCounts}
        countryCounts={countryCounts}
        platformCounts={platformCounts}
        saleSiteCounts={saleSiteCounts}
      />

      <div className="flex flex-col items-center">
        {displayedQueries.map((query) => (
          <Card key={query.id} query={query} onClick={onCardClick} />
        ))}
        {displayedQueries.length === 0 && (
          <p className="text-gray-400 mt-8">Bu filtrelerle eşleşen kart yok.</p>
        )}
      </div>
    </div>
  );
}
