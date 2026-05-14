import { connect } from 'puppeteer-real-browser';
import path from 'path';

const COOKIE_SAVE_INTERVAL_MS = 30 * 1000;     // 30 saniyede bir çerez kaydet
const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000;  // 4 dakikada bir sayfa yenile (oturumu canlı tut)

async function testRealBrowser() {
    console.log('Başlatılıyor: Puppeteer Real Browser...');
    
    const { browser, page } = await connect({
        headless: false,
        turnstile: true,
    });

    const targetUrl = 'https://fwc26-shop-usd.tickets.fifa.com/secured/content';

    console.log(`\nURL'ye gidiliyor: ${targetUrl}`);
    console.log('--- LÜTFEN EKRANDAN MANUEL GİRİŞ YAPINIZ VEYA WAITING ROOM\'U GEÇİNİZ ---');
    console.log('Giriş yaptıktan sonra bu tarayıcıyı açık bırakın. Sistem otomatik çalışacaktır.\n');
    
    await page.goto(targetUrl);

    const fs = await import('fs/promises');

    // --- ÇEREZ KAYDETME DÖNGÜSÜ (30 saniyede bir) ---
    const cookieInterval = setInterval(async () => {
        try {
            const cookies = await page.cookies();
            const datadomeCookie = cookies.find(c => c.name === 'datadome');
            const sessionCookie = cookies.find(c => 
                c.name === 'STX_SESSION' || c.name === 'PKP_ID' || c.name.startsWith('AcpAT')
            );

            const now = new Date().toLocaleTimeString();

            if (datadomeCookie && sessionCookie) {
                const cookieMap = {};
                for (const c of cookies) {
                    cookieMap[c.name] = c.value;
                }
                cookieMap['_harvestedAt'] = Date.now();
                
                await fs.writeFile('fifa-cookies.json', JSON.stringify(cookieMap, null, 2));
                console.log(`[${now}] ✅ Çerezler güncellendi (DataDome + Oturum VAR)`);
            } else {
                console.log(`[${now}] ⏳ Bekleniyor... DataDome: ${datadomeCookie ? 'VAR' : 'YOK'} | Oturum: ${sessionCookie ? 'VAR' : 'YOK'}`);
            }
            
        } catch (e) {
            if (e.message.includes('Session closed') || e.message.includes('Target closed')) {
                console.log('\nTarayıcı kapatıldı. Döngü sonlandırılıyor...');
                clearInterval(cookieInterval);
                clearInterval(keepAliveInterval);
                process.exit(0);
            } else {
                console.error('Çerezler okunamadı:', e.message);
            }
        }
    }, COOKIE_SAVE_INTERVAL_MS);

    // --- OTURUMU CANLI TUTMA DÖNGÜSÜ (4 dakikada bir) ---
    const keepAliveInterval = setInterval(async () => {
        try {
            const now = new Date().toLocaleTimeString();
            console.log(`[${now}] 🔄 Oturum canlı tutma: Sayfa yenileniyor...`);
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
            console.log(`[${now}] 🔄 Sayfa başarıyla yenilendi.`);
        } catch (e) {
            if (e.message.includes('Session closed') || e.message.includes('Target closed')) {
                console.log('\nTarayıcı kapatıldı.');
                clearInterval(cookieInterval);
                clearInterval(keepAliveInterval);
                process.exit(0);
            } else {
                console.error('Sayfa yenilenemedi:', e.message);
            }
        }
    }, KEEP_ALIVE_INTERVAL_MS);
}

testRealBrowser().catch(console.error);
