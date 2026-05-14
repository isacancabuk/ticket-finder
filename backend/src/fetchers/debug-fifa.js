import { gotScraping } from 'got-scraping';
import { readFile } from 'fs/promises';

const PERF_ID = '10229226700888';
const BASE_URL = 'https://fwc26-shop-usd.tickets.fifa.com';

async function debug() {
    // 1. Cookie yükle
    console.log('=== STEP 1: Cookie Yükleme ===');
    const raw = await readFile('fifa-cookies.json', 'utf-8');
    const cookieMap = JSON.parse(raw);
    const age = Math.round((Date.now() - (cookieMap._harvestedAt || 0)) / 1000);
    console.log(`Cookie yaşı: ${age} saniye`);

    const cookieString = Object.entries(cookieMap)
        .filter(([k]) => k !== '_harvestedAt')
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    console.log(`Cookie uzunluğu: ${cookieString.length} karakter\n`);

    // 2. HTML sayfasını çek
    console.log('=== STEP 2: HTML Sayfa Çekme ===');
    const pageUrl = `${BASE_URL}/secure/selection/event/seat/performance/${PERF_ID}/lang/en`;
    console.log(`URL: ${pageUrl}`);

    const pageRes = await gotScraping({
        url: pageUrl,
        headers: {
            Cookie: cookieString,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,tr;q=0.7',
            'Referer': `${BASE_URL}/`,
            'Origin': BASE_URL,
            'Sec-Ch-Ua': '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"macOS"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Upgrade-Insecure-Requests': '1',
        },
        headerGeneratorOptions: {
            browsers: [{ name: 'chrome', minVersion: 148, maxVersion: 148 }],
            operatingSystems: ['macos'],
        },
        timeout: { request: 15000 },
    });

    console.log(`Sayfa Status: ${pageRes.statusCode}`);
    console.log(`Sayfa Body Uzunluk: ${pageRes.body.length}`);

    // productId ara
    const productMatch = pageRes.body.match(/product_description_header\s+product_(\d+)/);
    if (!productMatch) {
        console.log('\n❌ productId bulunamadı!');
        console.log('Sayfa snippet (ilk 500 char):', pageRes.body.substring(0, 500));
        return;
    }
    const productId = productMatch[1];
    console.log(`✅ productId: ${productId}`);

    // Event name test
    const hostMatch = pageRes.body.match(/<span class="team host">\s*([^<]+?)\s*(?:<img)/s);
    const opposingMatch = pageRes.body.match(/class="team opposing">[\s\S]*?<img[^>]*>\s*([\s\S]*?)\s*<\/span>/);
    console.log(`Host match: ${hostMatch ? hostMatch[1].trim() : 'NOT FOUND'}`);
    console.log(`Opposing match: ${opposingMatch ? opposingMatch[1].trim() : 'NOT FOUND'}`);
    if (hostMatch && opposingMatch) {
        console.log(`✅ Event Name: ${hostMatch[1].trim()} vs ${opposingMatch[1].trim()}`);
    } else {
        const ogMatch = pageRes.body.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
        console.log(`Fallback og:title: ${ogMatch ? ogMatch[1] : 'NOT FOUND'}`);
    }

    // Extract event date from og:title: "Los Angeles Stadium | 12.06.2026 - 18:00 | FIFA World Cup 2026™"
    let eventDate = null;
    let eventLocation = null;
    const ogTitleMatch = pageRes.body.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
    if (ogTitleMatch) {
      console.log(`\nog:title meta tag content: "${ogTitleMatch[1]}"`);
      const parts = ogTitleMatch[1].split("|").map((s) => s.trim());
      if (parts.length >= 2) {
        eventDate = parts[1]; // e.g. "12.06.2026 - 18:00"
      }
      if (parts.length >= 1) {
        eventLocation = parts[0]; // e.g. "Los Angeles Stadium"
      }
    }
    console.log(`✅ eventDate: ${eventDate}`);
    console.log(`✅ eventLocation: ${eventLocation}`);
    console.log();

    // 3. Availability API çağır
    console.log('=== STEP 3: Availability API ===');
    const availUrl = `${BASE_URL}/tnwr/v1/secure/seatmap/availability?perfId=${PERF_ID}&productId=${productId}&isSeasonTicketMode=false&advantageId=&withPriceRange=true&ppid=&reservationIdx=&crossSellId=&baseOperationIdsString=`;
    console.log(`URL: ${availUrl}`);

    const availRes = await gotScraping({
        url: availUrl,
        headers: {
            Cookie: cookieString,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,tr;q=0.7',
            'Referer': `${BASE_URL}/secure/selection/event/seat/performance/${PERF_ID}/lang/en`,
            'Origin': BASE_URL,
            'X-Secutix-Host': 'fwc26-shop-usd.tickets.fifa.com',
            'Sec-Ch-Ua': '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"macOS"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
        },
        headerGeneratorOptions: {
            browsers: [{ name: 'chrome', minVersion: 148, maxVersion: 148 }],
            operatingSystems: ['macos'],
        },
        timeout: { request: 15000 },
    });

    console.log(`Availability Status: ${availRes.statusCode}`);
    console.log(`Response Headers:`, JSON.stringify(Object.fromEntries(
        Object.entries(availRes.headers).filter(([k]) => ['content-type', 'x-error', 'www-authenticate', 'set-cookie'].includes(k.toLowerCase()))
    ), null, 2));

    if (availRes.statusCode === 200) {
        try {
            const data = JSON.parse(availRes.body);
            const categories = data.priceRangeCategories || [];
            console.log(`\n✅ ${categories.length} kategori bulundu:`);
            for (const cat of categories) {
                console.log(`  - ${cat.name?.en || 'N/A'}: minPrice=${cat.minPrice}, blocks=${cat.blocks?.length || 0}`);
            }
        } catch {
            console.log('JSON parse hatası. Body snippet:', availRes.body.substring(0, 300));
        }
    } else {
        console.log(`\n❌ Body snippet:`, availRes.body.substring(0, 500));
    }
}

debug().catch(console.error);
