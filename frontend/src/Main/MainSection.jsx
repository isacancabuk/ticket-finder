import { useState } from "react";
import Card from "./Card";

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

const FILTER_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Found", value: "FOUND" },
  { label: "Price Exceeded", value: "PRICE_EXCEEDED" },
  { label: "Finding", value: "FINDING" },
  { label: "Error", value: "ERROR" },
  { label: "Purchased", value: "PURCHASED" },
];

export default function MainSection({ queries = [], onCardClick }) {
  const [filter, setFilter] = useState("ALL");

  if (queries.length === 0) {
    return (
      <div className="flex flex-col items-center mt-12">
        <p className="text-lg text-gray-400">
          No queries yet. Add an event URL above to start tracking.
        </p>
      </div>
    );
  }

  const mapped = queries.map(q => ({ ...q, displayStatus: getDisplayStatus(q) }));
  const filtered = filter === "ALL" ? mapped : mapped.filter(q => q.displayStatus === filter);

  filtered.sort((a, b) => {
    const pA = SORT_PRIORITY[a.displayStatus] || 99;
    const pB = SORT_PRIORITY[b.displayStatus] || 99;
    if (pA !== pB) return pA - pB;
    return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
  });

  return (
    <div className="flex flex-col items-center w-full pb-20">
      <div className="flex gap-1 mb-8 bg-gray-200 p-1 rounded-lg">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${
              filter === opt.value
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center">
        {filtered.map((query) => (
          <Card key={query.id} query={query} onClick={onCardClick} />
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-400 mt-8">No cards matching this status.</p>
        )}
      </div>
    </div>
  );
}
