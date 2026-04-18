import { useState, useCallback } from "react";
import Card from "./Card";
import FilterBar from "./FilterBar";

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
  });

  if (queries.length === 0) {
    return (
      <div className="flex flex-col items-center mt-12">
        <p className="text-lg text-gray-400">
          No queries yet. Add an event URL above to start tracking.
        </p>
      </div>
    );
  }

  // Map display status to all queries
  const mapped = queries.map((q) => ({
    ...q,
    displayStatus: getDisplayStatus(q),
  }));

  // Apply filters
  let filtered = mapped.filter((q) => {
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

    // Site filter (currently only ticketmaster)
    if (filterState.selectedSite !== "Tümü") {
      if (filterState.selectedSite !== "ticketmaster") {
        return false;
      }
    }

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

    return true;
  });

  // Sort: first by status priority (for status order), then by date
  filtered.sort((a, b) => {
    const pA = SORT_PRIORITY[a.displayStatus] || 99;
    const pB = SORT_PRIORITY[b.displayStatus] || 99;
    if (pA !== pB) return pA - pB;

    // Parse event date properly: handle multiple date formats
    const parseDate = (dateStr) => {
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
    };

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

  const handleFilterChange = useCallback((newFilterState) => {
    setFilterState(newFilterState);
  }, []);

  return (
    <div className="flex flex-col items-center w-full pb-20">
      <FilterBar onFilterChange={handleFilterChange} />

      <div className="flex flex-col items-center">
        {filtered.map((query) => (
          <Card key={query.id} query={query} onClick={onCardClick} />
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-400 mt-8">Bu filtrelerle eşleşen kart yok.</p>
        )}
      </div>
    </div>
  );
}
