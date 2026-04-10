import express from "express";
import prisma from "../prisma.js";
import { parseTicketmasterUrl } from "../utils/parseTicketmasterUrl.js";
import { fetchEventMetadata } from "../utils/fetchEventMetadata.js";
import { runQuery } from "../services/runQuery.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const queries = await prisma.query.findMany({
    orderBy: { createdAt: "desc" },
  });

  res.json(queries);
});

router.post("/", async (req, res) => {
  try {
    const { url, section, minSeats, maxPrice, orderNo } = req.body;

    if (!url || !section || !orderNo || maxPrice == null) {
      return res.status(400).json({ error: "Missing required fields: url, section, orderNo, maxPrice" });
    }

    // Validate minSeats if provided
    const seats = minSeats ? parseInt(minSeats, 10) : 1;
    if (isNaN(seats) || seats < 1) {
      return res.status(400).json({ error: "minSeats must be a positive integer" });
    }

    // Validate maxPrice (input is in EUR, stored as cents)
    const price = parseInt(maxPrice, 10);
    if (isNaN(price) || price < 1) {
      return res.status(400).json({ error: "maxPrice must be a positive integer (in EUR, e.g. 200)" });
    }
    const maxPriceCents = price * 100;

    // Parse the Ticketmaster URL
    let parsed;
    try {
      parsed = parseTicketmasterUrl(url);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const { domain, eventId, eventSlug, eventName, eventUrl } = parsed;

    // Fetch event metadata (best-effort, non-blocking)
    const metadata = await fetchEventMetadata(eventUrl);

    try {
      const query = await prisma.query.create({
        data: {
          domain,
          site: "TICKETMASTER",
          eventId,
          eventSlug,
          eventName,
          eventUrl,
          section,
          minSeats: seats,
          maxPrice: maxPriceCents,
          orderNo,
          eventLocation: metadata.eventLocation,
          eventDate: metadata.eventDate,
        },
      });

      res.status(201).json(query);
    } catch (err) {
      // Prisma unique constraint violation
      if (err.code === "P2002") {
        return res.status(409).json({
          error: "A query with this event and section already exists",
        });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  } catch (outerErr) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/run", async (req, res) => {
  try {
    const updatedQuery = await runQuery(req.params.id);
    res.json(updatedQuery);
  } catch (err) {
    if (err.message === "QUERY_NOT_FOUND") {
      return res.status(404).json({ error: "Query not found" });
    }

    if (err.message === "QUERY_STOPPED") {
      return res.status(400).json({ error: "Query is stopped" });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

// Stop a query
router.patch("/:id/stop", async (req, res) => {
  try {
    const query = await prisma.query.update({
      where: { id: req.params.id },
      data: { status: "STOPPED" },
    });
    res.json(query);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Query not found" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Resume a query
router.patch("/:id/resume", async (req, res) => {
  try {
    const query = await prisma.query.update({
      where: { id: req.params.id },
      data: { status: "FINDING", lastErrorMessage: null },
    });
    res.json(query);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Query not found" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete a query (cascades to CheckResults via schema)
router.delete("/:id", async (req, res) => {
  try {
    await prisma.query.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Query not found" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get logs (CheckResults) for a query
router.get("/:id/logs", async (req, res) => {
  try {
    const significantOnly = req.query.filter === "significant";

    const where = { queryId: req.params.id };
    if (significantOnly) {
      where.OR = [
        { status: "FOUND" },
        { status: "ERROR" },
        { priceExceeded: true },
      ];
    }

    const logs = await prisma.checkResult.findMany({
      where,
      orderBy: { checkedAt: "desc" },
      take: 50,
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
