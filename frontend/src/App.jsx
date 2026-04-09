import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { RootLayout } from "./RootLayout";
import { API_BASE } from "./api";

// Loader: fetch all queries from backend
async function rootLoader() {
  const res = await fetch(`${API_BASE}/queries`);
  if (!res.ok) throw new Response("Failed to load queries", { status: res.status });
  return res.json();
}

// Action: handles create, stop, resume, delete
async function rootAction({ request }) {
  const formData = await request.formData();
  const intent = formData.get("_action");

  if (intent === "create") {
    const body = {
      url: formData.get("url"),
      section: formData.get("section"),
      minSeats: formData.get("minSeats") || "1",
    };

    const res = await fetch(`${API_BASE}/queries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      return { error: err.error || "Failed to create query" };
    }

    return { ok: true };
  }

  if (intent === "stop") {
    const id = formData.get("queryId");
    await fetch(`${API_BASE}/queries/${id}/stop`, { method: "PATCH" });
    return { ok: true };
  }

  if (intent === "resume") {
    const id = formData.get("queryId");
    await fetch(`${API_BASE}/queries/${id}/resume`, { method: "PATCH" });
    return { ok: true };
  }

  if (intent === "delete") {
    const id = formData.get("queryId");
    await fetch(`${API_BASE}/queries/${id}`, { method: "DELETE" });
    return { ok: true, deleted: true };
  }

  return { error: "Unknown action" };
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    loader: rootLoader,
    action: rootAction,
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
