import { gotScraping } from 'got-scraping';
import { readFile } from 'fs/promises';

async function testCookies() {
    // fifa-cookies.json'dan çerezleri oku
    const raw = await readFile('fifa-cookies.json', 'utf-8');
    const cookieMap = JSON.parse(raw);
    
    // _harvestedAt'ı çıkar ve cookie string'i oluştur
    const harvestedAt = cookieMap['_harvestedAt'];
    const ageSeconds = Math.round((Date.now() - harvestedAt) / 1000);
    console.log(`Çerez yaşı: ${ageSeconds} saniye önce alındı\n`);
    
    // Kritik çerezleri kontrol et
    const critical = ['datadome', 'ak_bmsc', '_abck', 'bm_sz', 'CACHE_PKP_TOKEN'];
    const session = ['STX_SESSION', 'PKP_ID', 'AcpAT-v3-11-FWC26-Shop'];
    
    console.log('--- KRİTİK ÇEREZLERİN DURUMU ---');
    for (const key of critical) {
        console.log(`  ${key}: ${cookieMap[key] ? '✅ VAR' : '❌ YOK'}`);
    }
    console.log('\n--- OTURUM ÇEREZLERİNİN DURUMU ---');
    for (const key of session) {
        console.log(`  ${key}: ${cookieMap[key] ? '✅ VAR' : '❌ YOK'}`);
    }
    
    // Cookie string oluştur
    const cookieString = Object.entries(cookieMap)
        .filter(([k]) => k !== '_harvestedAt')
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');

    // Bilet sayfasına istek at
    const testUrl = 'https://fwc26-shop-usd.tickets.fifa.com/secure/selection/event/date/product/10229225515651/lang/en';
    
    console.log(`\n--- TEST: ${testUrl} ---`);
    
    try {
        const response = await gotScraping({
            url: testUrl,
            headerGeneratorOptions: {
                browsers: [{ name: 'chrome', minVersion: 148, maxVersion: 148 }],
                operatingSystems: ['macos'],
            },
            headers: {
                'Cookie': cookieString,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,tr;q=0.7',
                'Sec-Ch-Ua': '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        console.log(`Status: ${response.statusCode}`);
        console.log(`Body length: ${response.body.length}`);
        
        // Product ID ara
        const match = response.body.match(/product_description_header\s+product_(\d+)/);
        if (match) {
            console.log(`\n🎉 BAŞARILI! Product ID bulundu: ${match[1]}`);
        } else if (response.body.includes('Please enable JS')) {
            console.log('\n❌ DataDome JS Challenge - Çerezler yetersiz veya süresi dolmuş');
        } else if (response.statusCode === 403) {
            console.log('\n❌ 403 Forbidden - Bot koruması engelledi');
        } else if (response.statusCode === 404) {
            console.log('\n⚠️ 404 Not Found - Sayfa bulunamadı (bilet/link süresi dolmuş olabilir)');
        } else {
            console.log('\nSayfa içeriği snippet:');
            console.log(response.body.substring(0, 500));
        }
    } catch (err) {
        console.error('İstek hatası:', err.message);
    }
}

testCookies().catch(console.error);
