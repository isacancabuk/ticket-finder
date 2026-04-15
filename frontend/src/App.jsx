import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { RootLayout } from "./RootLayout";
import { apiFetch } from "./api";

// Loader: fetch all queries from backend
async function rootLoader() {
  const res = await apiFetch("/queries");
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
      section: formData.get("section") || "",
      minSeats: formData.get("minSeats") || "1",
      maxPrice: formData.get("maxPrice") || "",
      salePrice: formData.get("salePrice") || "",
      orderNo: formData.get("orderNo"),
    };

    const res = await apiFetch("/queries", {
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
    await apiFetch(`/queries/${id}/stop`, { method: "PATCH" });
    return { ok: true };
  }

  if (intent === "resume") {
    const id = formData.get("queryId");
    await apiFetch(`/queries/${id}/resume`, { method: "PATCH" });
    return { ok: true };
  }

  if (intent === "delete") {
    const id = formData.get("queryId");
    await apiFetch(`/queries/${id}`, { method: "DELETE" });
    return { ok: true, deleted: true };
  }

  if (intent === "purchase") {
    const id = formData.get("queryId");
    await apiFetch(`/queries/${id}/purchase`, { method: "PATCH" });
    return { ok: true };
  }

  if (intent === "edit") {
    const id = formData.get("queryId");
    const body = {
      section: formData.get("section"),
      minSeats: formData.get("minSeats") || "1",
      maxPrice: formData.get("maxPrice"),
      salePrice: formData.get("salePrice"),
      orderNo: formData.get("orderNo"),
    };
    const res = await apiFetch(`/queries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      return { error: err.error || "Failed to edit query" };
    }
    return { ok: true, edited: true };
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
