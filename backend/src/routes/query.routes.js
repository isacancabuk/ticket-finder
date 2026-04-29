import express from "express";
import prisma from "../prisma.js";
import { parseTicketmasterUrl } from "../utils/parseTicketmasterUrl.js";
import { fetchEventMetadata } from "../utils/fetchEventMetadata.js";
import { runQuery } from "../services/runQuery.js";
import { fetchDEManifestSections } from "../../fetchDEManifestSections.js";
import { fetchESManifestSections } from "../../fetchESManifestSections.js";
import { fetchUKManifestSections } from "../../fetchUKManifestSections.js";
import { SUPPORTED_SALE_CURRENCIES } from "../utils/currencyConfig.js";
import {
  normalizePricesToEUR,
  calculateProfitLoss,
} from "../utils/enrichQueryResponse.js";

const router = express.Router();

// ── Manifest sections helper ────
router.get("/manifest-sections", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res
        .status(400)
        .json({ error: "Gerekli sorgu parametresi eksik: url" });
    }

    let parsed;
    try {
      parsed = parseTicketmasterUrl(url);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    if (parsed.domain !== "DE" && parsed.domain !== "ES" && parsed.domain !== "UK") {
      return res.status(400).json({
        error: `Manifest bölümleri yardımcısı yalnızca DE, ES ve UK etki alanları için desteklenir, alınan: ${parsed.domain}`,
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
    } else if (parsed.domain === "UK") {
      result = await fetchUKManifestSections({
        eventId: parsed.eventId,
      });
    }

    if (!result.success) {
      return res.status(502).json({ error: result.error });
    }

    res.json({ sections: result.sections });
  } catch (err) {
    console.error("[manifest-sections] Unexpected error:", err.message);
    res.status(500).json({ error: "Dahili sunucu hatası" });
  }
});

// ── Get all queries (with DB data + enriched data) ────
router.get("/", async (req, res) => {
  const queries = await prisma.query.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Enrich queries with normalized prices and profit/loss
  const enriched = await Promise.all(
    queries.map(async (q) => {
      const { salePriceInEUR, foundPriceInEUR } = await normalizePricesToEUR(q);
      const { profitLoss, profitLossCurrency } = calculateProfitLoss(
        salePriceInEUR,
        foundPriceInEUR,
      );

      return {
        ...q,
        salePriceInEUR,
        foundPriceInEUR,
        profitLoss,
        profitLossCurrency,
      };
    }),
  );

  res.json(enriched);
});

// ── Create a new query (with inputs + parsing + metadata) ────
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
        .json({ error: "Gerekli alanlar eksik: url, orderNo" });
    }

    // Section: trim to null if empty (broad availability mode)
    const sectionValue = section?.trim() || null;

    // Validate minSeats if provided
    const seats = minSeats ? parseInt(minSeats, 10) : 1;
    if (isNaN(seats) || seats < 1) {
      return res
        .status(400)
        .json({
          error: "Minimum koltuk sayısı pozitif bir tam sayı olmalıdır",
        });
    }

    // Validate maxPrice (input is in EUR, stored as cents, null = no limit)
    let maxPriceCents = null;
    if (maxPrice) {
      const price = parseInt(maxPrice, 10);
      if (isNaN(price) || price < 1) {
        return res.status(400).json({
          error:
            "Maksimum fiyat pozitif bir tam sayı olmalıdır (EUR cinsinden, örn. 200)",
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
          .json({ error: "Satış fiyatı pozitif bir tam sayı olmalıdır" });
      }
      salePriceCents = price * 100;
    }

    // Validate salePriceCurrency (default EUR)
    const saleCurrency = salePriceCurrency?.toUpperCase() || "EUR";
    if (!SUPPORTED_SALE_CURRENCIES.includes(saleCurrency)) {
      return res.status(400).json({
        error: `Satış fiyatı para birimi şunlardan biri olmalıdır: ${SUPPORTED_SALE_CURRENCIES.join(", ")}`,
      });
    }

    // Parse the Ticketmaster URL
    let parsed;
    try {
      parsed = parseTicketmasterUrl(url);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const { site, domain, eventId, eventSlug, eventName, eventUrl } = parsed;

    // Fetch event metadata
    const metadata = await fetchEventMetadata(eventUrl);

    try {
      const query = await prisma.query.create({
        data: {
          domain,
          site,
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

// ── Manuel run a query (trigger) ────
router.post("/:id/run", async (req, res) => {
  try {
    const updatedQuery = await runQuery(req.params.id);
    res.json(updatedQuery);
  } catch (err) {
    if (err.message === "QUERY_NOT_FOUND") {
      return res.status(404).json({ error: "Sorgu bulunamadı" });
    }

    if (err.message === "QUERY_STOPPED") {
      return res.status(400).json({ error: "Sorgu durdurulmuş" });
    }

    res.status(500).json({ error: "Dahili sunucu hatası" });
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
      return res.status(404).json({ error: "Sorgu bulunamadı" });
    }
    res.status(500).json({ error: "Dahili sunucu hatası" });
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
      return res.status(404).json({ error: "Sorgu bulunamadı" });
    }
    res.status(500).json({ error: "Dahili sunucu hatası" });
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
      return res.status(404).json({ error: "Sorgu bulunamadı" });
    }
    res.status(500).json({ error: "Dahili sunucu hatası" });
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

    // ── Validate section ────
    // Trim whitespace, allow null for broad availability
    if (section !== undefined) {
      updateData.section = section?.trim() || null;
    }

    // ── Validate orderNo ────
    // Must not be empty or whitespace-only if provided
    if (orderNo !== undefined) {
      if (orderNo !== null && typeof orderNo === "string") {
        const trimmedOrderNo = orderNo.trim();
        if (!trimmedOrderNo) {
          return res.status(400).json({ error: "Sipariş numarası boş olamaz" });
        }
        updateData.orderNo = trimmedOrderNo;
      } else {
        updateData.orderNo = orderNo;
      }
    }

    // ── Validate minSeats ────
    // Must be >= 1 if provided, set to null if cleared
    if (minSeats !== undefined) {
      if (minSeats === null || minSeats === "") {
        updateData.minSeats = null;
      } else {
        const parsedMin = parseInt(minSeats, 10);
        if (isNaN(parsedMin) || parsedMin < 1) {
          return res.status(400).json({
            error: "Minimum koltuk sayısı 1'den büyük veya eşit olmalıdır",
          });
        }
        updateData.minSeats = parsedMin;
      }
    }

    // ── Validate maxPrice ────
    // Must be >= 1 if provided (in EUR), set to null if cleared
    if (maxPrice !== undefined) {
      if (maxPrice === null || maxPrice === "") {
        updateData.maxPrice = null;
      } else {
        const parsedMax = parseInt(maxPrice, 10);
        if (isNaN(parsedMax) || parsedMax < 1) {
          return res.status(400).json({
            error: "Fiyat 1'den büyük veya eşit olmalıdır",
          });
        }
        updateData.maxPrice = parsedMax * 100;
      }
    }

    // ── Validate salePrice ────
    // Must be >= 1 if provided (in EUR, stored as cents), set to null if cleared
    if (salePrice !== undefined) {
      if (salePrice === null || salePrice === "") {
        updateData.salePrice = null;
      } else {
        const parsedSale = parseInt(salePrice, 10);
        if (isNaN(parsedSale) || parsedSale < 1) {
          return res.status(400).json({
            error: "Fiyat 1'den büyük veya eşit olmalıdır",
          });
        }
        updateData.salePrice = parsedSale * 100;
      }
    }

    // ── Accept salePriceCurrency as-is (no validation needed) ────
    if (salePriceCurrency !== undefined) {
      updateData.salePriceCurrency = salePriceCurrency?.toUpperCase() || "EUR";
    }

    // ── Update database ────
    const query = await prisma.query.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(query);
  } catch (err) {
    // Handle query not found
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Sorgu bulunamadı" });
    }

    // Log unexpected errors
    console.error("[PATCH /:id] Unexpected error:", err.message);

    // Return 500 for database or other unexpected errors
    res.status(500).json({ error: "Dahili sunucu hatası" });
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
      return res.status(404).json({ error: "Sorgu bulunamadı" });
    }
    res.status(500).json({ error: "Dahili sunucu hatası" });
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
    res.status(500).json({ error: "Dahili sunucu hatası" });
  }
});

export default router;
