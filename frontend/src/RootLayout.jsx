import { useEffect, useState, useCallback } from "react";
import { useLoaderData, useRevalidator } from "react-router-dom";
import HeaderSection from "./Header/HeaderSection";
import MainSection from "./Main/MainSection";
import QueryModal from "./Main/QueryModal";
import "./index.css";

export function RootLayout() {
  const queries = useLoaderData();
  const revalidator = useRevalidator();

  const [selectedQuery, setSelectedQuery] = useState(null);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (revalidator.state === "idle") {
        revalidator.revalidate();
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [revalidator]);

  // Keep selectedQuery in sync with fresh data after revalidation
  useEffect(() => {
    if (selectedQuery) {
      const updated = queries.find((q) => q.id === selectedQuery.id);
      if (updated) {
        setSelectedQuery(updated);
      } else {
        // Query was deleted
        setSelectedQuery(null);
      }
    }
  }, [queries, selectedQuery?.id]);

  const handleCardClick = useCallback((query) => {
    setSelectedQuery(query);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedQuery(null);
  }, []);

  return (
    <main className="min-h-screen w-full flex flex-col items-center">
      <HeaderSection />
      <MainSection queries={queries} onCardClick={handleCardClick} />
      {selectedQuery && (
        <QueryModal query={selectedQuery} onClose={handleCloseModal} />
      )}
    </main>
  );
}
