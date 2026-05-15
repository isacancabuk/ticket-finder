import { connect } from "puppeteer-real-browser";

const COOKIE_SAVE_INTERVAL_MS = 30 * 1000; // 30 saniyede bir çerez kaydet
const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000; // 4 dakikada bir sayfa yenile (oturumu canlı tut)

// Variant config: shop ve resale için (iki sekme paralel)
const VARIANTS = [
  {
    name: "shop",
    url: "https://fwc26-shop-usd.tickets.fifa.com/secured/content",
  },
  {
    name: "resale",
    url: "https://fwc26-resale-usd.tickets.fifa.com/secured/content",
  },
];

async function setupVariantTab(browser, variant) {
  const page = await browser.newPage();

  console.log(
    `\n[${variant.name.toUpperCase()}] YENİ TAB: URL'ye gidiliyor: ${variant.url}`,
  );
  console.log(
    `--- LÜTFEN ${variant.name.toUpperCase()} İÇİN MANUEL GİRİŞ YAPINIZ VEYA WAITING ROOM'U GEÇİNİZ ---`,
  );

  await page.goto(variant.url);

  return page;
}

async function startCookieHarvesting(page, variant) {
  const fs = await import("fs/promises");

  return new Promise((resolve) => {
    // Başarılı çerez toplaması flag'i
    let cookiesCollected = false;

    const cookieInterval = setInterval(async () => {
      try {
        const cookies = await page.cookies();
        const datadomeCookie = cookies.find((c) => c.name === "datadome");
        const sessionCookie = cookies.find(
          (c) =>
            c.name === "STX_SESSION" ||
            c.name === "PKP_ID" ||
            c.name.startsWith("AcpAT"),
        );

        const now = new Date().toLocaleTimeString();

        if (datadomeCookie && sessionCookie) {
          const cookieMap = {};
          for (const c of cookies) {
            cookieMap[c.name] = c.value;
          }
          cookieMap["_harvestedAt"] = Date.now();

          // Mevcut dosyayı oku
          let allCookies = {};
          try {
            const existing = await fs.readFile("fifa-cookies.json", "utf-8");
            allCookies = JSON.parse(existing);
          } catch {
            // Dosya yoksa yeni başla
          }

          // Variant'ın cookies'ini güncelle
          allCookies[variant.name] = cookieMap;

          // Dosyaya yaz
          await fs.writeFile(
            "fifa-cookies.json",
            JSON.stringify(allCookies, null, 2),
          );

          if (!cookiesCollected) {
            console.log(
              `[${now}] ✅ ${variant.name.toUpperCase()} çerezleri BAŞARIYLA ALINDI (DataDome + Oturum VAR)`,
            );
            cookiesCollected = true;
            resolve(true);
          } else {
            console.log(
              `[${now}] 🔄 ${variant.name.toUpperCase()} çerezleri güncellendi`,
            );
          }
        } else {
          console.log(
            `[${now}] ⏳ ${variant.name.toUpperCase()} Bekleniyor... DataDome: ${datadomeCookie ? "VAR" : "YOK"} | Oturum: ${sessionCookie ? "VAR" : "YOK"}`,
          );
        }
      } catch (e) {
        if (
          e.message.includes("Session closed") ||
          e.message.includes("Target closed")
        ) {
          clearInterval(cookieInterval);
          if (!cookiesCollected) {
            resolve(false);
          }
        } else {
          console.error(
            `${variant.name.toUpperCase()} Çerezler okunamadı:`,
            e.message,
          );
        }
      }
    }, COOKIE_SAVE_INTERVAL_MS);
  });
}

async function startKeepAlive(page, variant) {
  return setInterval(async () => {
    try {
      const now = new Date().toLocaleTimeString();
      console.log(
        `[${now}] 🔄 ${variant.name.toUpperCase()} oturum canlı tutma: Sayfa yenileniyor...`,
      );
      await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
      console.log(`[${now}] ✓ ${variant.name.toUpperCase()} sayfa yenilendi.`);
    } catch (e) {
      if (
        e.message.includes("Session closed") ||
        e.message.includes("Target closed")
      ) {
        console.log(
          `[${new Date().toLocaleTimeString()}] ${variant.name.toUpperCase()} tab kapatıldı.`,
        );
      } else {
        console.error(
          `${variant.name.toUpperCase()} sayfa yenilenemedi:`,
          e.message,
        );
      }
    }
  }, KEEP_ALIVE_INTERVAL_MS);
}

async function testRealBrowser() {
  console.log(
    "Başlatılıyor: Puppeteer Real Browser (İKİ SEKME PARALEL MOD)...",
  );

  const { browser, page } = await connect({
    headless: false,
    turnstile: true,
  });

  const fs = await import("fs/promises");

  try {
    console.log(
      `\n${"=".repeat(70)}\n🌐 İKİ SEKME PARALELİ BAŞLATILIYOR\n${"=".repeat(70)}`,
    );

    // Her variant için sekme aç ve cookie harvesting başlat
    const tabConfigs = [];

    for (const variant of VARIANTS) {
      const tab = await setupVariantTab(browser, variant);
      const harvestingPromise = startCookieHarvesting(tab, variant);
      const keepAliveInterval = await startKeepAlive(tab, variant);

      tabConfigs.push({
        variant,
        tab,
        harvestingPromise,
        keepAliveInterval,
      });
    }

    // Tüm sekmeler için cookielerin toplanmasını bekle
    console.log(
      `\n${"=".repeat(70)}\n⏳ Cookielerin toplanması bekleniyor...\n${"=".repeat(70)}`,
    );
    await Promise.all(tabConfigs.map((config) => config.harvestingPromise));

    // Başarıyla tamamlandı
    console.log(
      `\n${"=".repeat(70)}\n✅ TÜM ÇEREZLER BAŞARIYLA ALINDI\n${"=".repeat(70)}\n`,
    );
    const finalCookies = JSON.parse(
      await fs.readFile("fifa-cookies.json", "utf-8"),
    );
    console.log("📄 fifa-cookies.json yapısı:");
    for (const [variant, data] of Object.entries(finalCookies)) {
      const timestamp = data._harvestedAt
        ? new Date(data._harvestedAt).toLocaleString()
        : "N/A";
      const cookieCount = Object.keys(data).length - 1; // _harvestedAt hariç
      console.log(
        `  - ${variant}: ${cookieCount} çerez (${timestamp} tarihinde alındı)`,
      );
    }

    console.log(`\n${"=".repeat(70)}`);
    console.log("✓ Her iki sekme paralel olarak çalışmaya devam ediyor.");
    console.log("✓ 30 saniyede bir çerezler otomatik güncelleniyor.");
    console.log("✓ 4 dakikada bir oturumlar canlı tutuluyor.");
    console.log(
      "✓ Tarayıcıyı açık bırakın (istediğiniz zaman kapatabilirsiniz).",
    );
    console.log(`${"=".repeat(70)}\n`);
  } catch (e) {
    console.error("İşlem sırasında hata:", e.message);
    process.exit(1);
  }
}

testRealBrowser().catch(console.error);
