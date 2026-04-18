import express from "express";
import prisma from "../prisma.js";
import { parseTicketmasterUrl } from "../utils/parseTicketmasterUrl.js";
import { fetchEventMetadata } from "../utils/fetchEventMetadata.js";
import { runQuery } from "../services/runQuery.js";
import { fetchDEManifestSections } from "../../fetchDEManifestSections.js";
import { fetchESManifestSections } from "../../fetchESManifestSections.js";
import {
  SUPPORTED_SALE_CURRENCIES,
  DOMAIN_CURRENCY,
} from "../utils/currencyConfig.js";
import { convert } from "../services/fxService.js";

const router = express.Router();

// ── Manifest sections helper (must be before /:id routes) ────
router.get("/manifest-sections", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res
        .status(400)
        .json({ error: "Missing required query param: url" });
    }

    let parsed;
    try {
      parsed = parseTicketmasterUrl(url);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    if (parsed.domain !== "DE" && parsed.domain !== "ES") {
      return res.status(400).json({
        error: `Manifest sections helper is only supported for DE and ES domains, got: ${parsed.domain}`,
      });
    }

    let result;
    if (parsed.domain === "DE") {
      result = await fetchDEManifestSections({
        eventId: parsed.eventId,
        domain: "de",
      });
    } else if (parsed.domain === "ES") {
      result = await fetchESManifestSections({
        eventId: parsed.eventId,
        domain: "es",
      });
    }

    if (!result.success) {
      return res.status(502).json({ error: result.error });
    }

    res.json({ sections: result.sections });
  } catch (err) {
    console.error("[manifest-sections] Unexpected error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req, res) => {
  const queries = await prisma.query.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Enrich queries with computed profit/loss (FX-converted if needed) + EUR normalization
  const enriched = await Promise.all(
    queries.map(async (q) => {
      const foundCurrency = DOMAIN_CURRENCY[q.domain] || "EUR";
      const saleCurrency = q.salePriceCurrency || "EUR";
      const minSeats = q.minSeats || 1;

      // Calculate total found price for all seats
      const totalFoundPrice =
        q.foundPrice != null ? q.foundPrice * minSeats : null;

      // Initialize EUR normalization
      let salePriceInEUR = null;
      let foundPriceInEUR = null;

      // Convert sale price to EUR if needed
      if (q.salePrice != null) {
        if (saleCurrency === "EUR") {
          salePriceInEUR = q.salePrice;
        } else {
          try {
            salePriceInEUR = await convert(q.salePrice, saleCurrency, "EUR");
          } catch (e) {
            // FX failure fallback
          }
        }
      }

      // Convert found price to EUR if needed
      if (totalFoundPrice != null) {
        if (foundCurrency === "EUR") {
          foundPriceInEUR = totalFoundPrice;
        } else {
          try {
            foundPriceInEUR = await convert(
              totalFoundPrice,
              foundCurrency,
              "EUR",
            );
          } catch (e) {
            // FX failure fallback
          }
        }
      }

      if (q.foundPrice == null || q.salePrice == null) {
        return {
          ...q,
          profitLoss: null,
          profitLossCurrency: null,
          salePriceInEUR,
          foundPriceInEUR,
        };
      }

      // Calculate profit/loss in EUR normalization
      let profitLoss = null;
      let profitLossCurrency = "EUR";

      if (salePriceInEUR != null && foundPriceInEUR != null) {
        profitLoss = salePriceInEUR - foundPriceInEUR;
      }

      return {
        ...q,
        profitLoss,
        profitLossCurrency,
        salePriceInEUR,
        foundPriceInEUR,
      };
    }),
  );

  res.json(enriched);
});

router.post("/", async (req, res) => {
  try {
    const {
      url,
      section,
      minSeats,
      maxPrice,
      salePrice,
      salePriceCurrency,
      orderNo,
    } = req.body;

    if (!url || !orderNo) {
      return res
        .status(400)
        .json({ error: "Missing required fields: url, orderNo" });
    }

    // Section: trim to null if empty (broad availability mode)
    const sectionValue = section?.trim() || null;

    // Validate minSeats if provided
    const seats = minSeats ? parseInt(minSeats, 10) : 1;
    if (isNaN(seats) || seats < 1) {
      return res
        .status(400)
        .json({ error: "minSeats must be a positive integer" });
    }

    // Validate maxPrice (input is in EUR, stored as cents, null = no limit)
    let maxPriceCents = null;
    if (maxPrice) {
      const price = parseInt(maxPrice, 10);
      if (isNaN(price) || price < 1) {
        return res.status(400).json({
          error: "maxPrice must be a positive integer (in EUR, e.g. 200)",
        });
      }
      maxPriceCents = price * 100;
    }

    // Validate salePrice (optional, stored as cents)
    let salePriceCents = null;
    if (salePrice) {
      const price = parseInt(salePrice, 10);
      if (isNaN(price) || price < 1) {
        return res
          .status(400)
          .json({ error: "salePrice must be a positive integer" });
      }
      salePriceCents = price * 100;
    }

    // Validate salePriceCurrency (default EUR)
    const saleCurrency = salePriceCurrency?.toUpperCase() || "EUR";
    if (!SUPPORTED_SALE_CURRENCIES.includes(saleCurrency)) {
      return res.status(400).json({
        error: `salePriceCurrency must be one of: ${SUPPORTED_SALE_CURRENCIES.join(", ")}`,
      });
    }

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
          section: sectionValue,
          minSeats: seats,
          maxPrice: maxPriceCents,
          salePrice: salePriceCents,
          salePriceCurrency: saleCurrency,
          orderNo,
          eventLocation: metadata.eventLocation,
          eventDate: metadata.eventDate,
        },
      });

      res.status(201).json(query);
    } catch (err) {
      console.error("[POST /] prisma.query.create error:", err);
      res.status(500).json({ error: `Database error: ${err.message}` });
    }
  } catch (outerErr) {
    console.error("[POST /] outer error:", outerErr);
    res.status(500).json({ error: `Server error: ${outerErr.message}` });
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

// Purchase a query
router.patch("/:id/purchase", async (req, res) => {
  try {
    const query = await prisma.query.update({
      where: { id: req.params.id },
      data: { status: "PURCHASED" },
    });
    res.json(query);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Query not found" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Edit a query
router.patch("/:id", async (req, res) => {
  try {
    const {
      section,
      minSeats,
      maxPrice,
      salePrice,
      salePriceCurrency,
      orderNo,
    } = req.body;

    const updateData = {};
    if (section !== undefined) updateData.section = section?.trim() || null;
    if (orderNo !== undefined) updateData.orderNo = orderNo;

    if (minSeats !== undefined) {
      const parsedMin = parseInt(minSeats, 10);
      if (!isNaN(parsedMin) && parsedMin >= 1) updateData.minSeats = parsedMin;
    }

    if (maxPrice !== undefined) {
      if (maxPrice) {
        const parsedMax = parseInt(maxPrice, 10);
        if (!isNaN(parsedMax) && parsedMax >= 0)
          updateData.maxPrice = parsedMax * 100;
      } else {
        updateData.maxPrice = null;
      }
    }

    if (salePrice !== undefined) {
      if (salePrice) {
        const parsedSale = parseInt(salePrice, 10);
        if (!isNaN(parsedSale) && parsedSale >= 0)
          updateData.salePrice = parsedSale * 100;
      } else {
        updateData.salePrice = null;
      }
    }

    // Validate salePriceCurrency if provided
    if (salePriceCurrency !== undefined) {
      const cur = salePriceCurrency?.toUpperCase() || "EUR";
      if (SUPPORTED_SALE_CURRENCIES.includes(cur)) {
        updateData.salePriceCurrency = cur;
      }
    }

    const query = await prisma.query.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json(query);
  } catch (err) {
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
    const filter = req.query.filter;

    const where = { queryId: req.params.id };
    if (filter === "significant") {
      where.OR = [
        { status: "FOUND" },
        { status: "ERROR" },
        { priceExceeded: true },
      ];
    } else if (filter === "found") {
      where.status = "FOUND";
    }

    const logs = await prisma.checkResult.findMany({
      where,
      orderBy: { checkedAt: "desc" },
      take: 150,
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
