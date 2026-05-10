import { useState, useMemo } from "react";
import Card from "./Card";
import FilterBar from "./FilterBar";

// Parse event date properly: handle multiple date formats
function parseDate(dateStr) {
  if (!dateStr) return new Date(0).getTime();
  try {
    const date = new Date(dateStr);
    // Check if date is valid
    if (date instanceof Date && !isNaN(date.getTime())) {
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

const SORT_PRIORITY = {
  FOUND: 1,
  PRICE_EXCEEDED: 2,
  ERROR: 3,
  FINDING: 4,
  PURCHASED: 5,
  STOPPED: 6,
};

export default function MainSection({ queries = [], onCardClick }) {
  const [filterState, setFilterState] = useState({
    searchQuery: "",
    selectedCountry: "Tümü",
    selectedSite: "Tümü",
    sortDateAsc: false,
    selectedStatus: "ALL",
    sortByProfit: "HIGH", // HIGH, LOW
  });

  // Compute status counts from ALL queries (unfiltered)
  const statusCounts = useMemo(() => {
    const counts = { FINDING: 0, FOUND: 0, PRICE_EXCEEDED: 0, PURCHASED: 0, ERROR: 0, STOPPED: 0 };
    queries.forEach((q) => {
      const ds = getDisplayStatus(q);
      if (counts[ds] !== undefined) counts[ds]++;
    });
    return counts;
  }, [queries]);

  // Sort and filter queries
  const displayedQueries = useMemo(() => {
    if (queries.length === 0) return [];

    // Map display status to all queries
    const mapped = queries.map((q) => ({
      ...q,
      displayStatus: getDisplayStatus(q),
    }));

    // Apply filters
    let filtered = mapped.filter((q) => {
      // Search filter (order number or event name)
      if (filterState.searchQuery.trim()) {
        const query = filterState.searchQuery.toLowerCase();
        const matchesOrderNo =
          q.orderNo && q.orderNo.toLowerCase().includes(query);
        const matchesEventName =
          q.eventName && q.eventName.toLowerCase().includes(query);

        if (!matchesOrderNo && !matchesEventName) {
          return false;
        }
      }

      // Status filter
      if (
        filterState.selectedStatus !== "ALL" &&
        q.displayStatus !== filterState.selectedStatus
      ) {
        return false;
      }

      // Country filter
      if (filterState.selectedCountry !== "Tümü") {
        if (!q.domain || q.domain !== filterState.selectedCountry) {
          return false;
        }
      }

      // Site filter
      if (filterState.selectedSite !== "Tümü") {
        const expectedSite = filterState.selectedSite.toLowerCase();
        if (q.site) {
          if (q.site.toLowerCase() !== expectedSite) return false;
        } else if (q.url) {
          if (!q.url.toLowerCase().includes(expectedSite)) return false;
        } else {
          return false;
        }
      }

      return true;
    });

    // Sort: first by status priority, then profit or date
    filtered.sort((a, b) => {
      const pA = SORT_PRIORITY[a.displayStatus] || 99;
      const pB = SORT_PRIORITY[b.displayStatus] || 99;
      if (pA !== pB) return pA - pB;

      // Profit sorting (always active, takes priority over date)
      const profitA = a.profitLoss ?? -Infinity;
      const profitB = b.profitLoss ?? -Infinity;
      if (profitA !== profitB) {
        return filterState.sortByProfit === "HIGH"
          ? profitB - profitA
          : profitA - profitB;
      }

      // Use eventDate if available, otherwise fall back to updatedAt or createdAt
      const timeA = a.eventDate
        ? parseDate(a.eventDate)
        : new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = b.eventDate
        ? parseDate(b.eventDate)
        : new Date(b.updatedAt || b.createdAt).getTime();

      if (filterState.sortDateAsc) {
        return timeA - timeB;
      } else {
        return timeB - timeA;
      }
    });

    return filtered;
  }, [queries, filterState]);

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
      <FilterBar filterState={filterState} onFilterChange={setFilterState} statusCounts={statusCounts} />

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
