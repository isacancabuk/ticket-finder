import Card from "./Card";

export default function MainSection({ queries = [], onCardClick }) {
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
    <div className="flex flex-col items-center">
      {queries.map((query) => (
        <Card key={query.id} query={query} onClick={onCardClick} />
      ))}
    </div>
  );
}
