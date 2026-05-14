import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';

chromium.use(StealthPlugin());

async function testPlaywright() {
    console.log('Başlatılıyor: Persistent Context (Kalıcı Oturum)...');
    
    const userDataDir = path.resolve('./fifa-session-data');
    
    // browser.launch() yerine browser.launchPersistentContext() kullanıyoruz.
    // Bu sayede giriş yaptığınızda (login) tüm çerezler ./fifa-session-data klasörüne kalıcı olarak kaydedilir.
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false, // İlk adımda tarayıcıyı göreceğiz
        viewport: null, // Tam ekran hissi için
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        ignoreDefaultArgs: ['--enable-automation'] // Otomasyon çubuğunu gizler
    });

    const page = await context.newPage();
    const targetUrl = 'https://fwc26-shop-usd.tickets.fifa.com/secure/selection/event/seat/performance/10229226700888';

    console.log(`\nURL'ye gidiliyor: ${targetUrl}`);
    console.log('--- LÜTFEN EKRANDAN MANUEL GİRİŞ (LOGIN) YAPINIZ ---');
    console.log('Eğer JS testi veya Captcha çıkarsa lütfen elinizle çözün.');
    console.log('Giriş yaptıktan sonra bilet sayfasını gördüğünüzde terminalden bu işlemi durdurabilirsiniz.');
    
    await page.goto(targetUrl);

    // Sürekli her 10 saniyede bir o anki datadome ve oturum cookielerini ekrana yazdıran bir döngü:
    setInterval(async () => {
        try {
            const cookies = await context.cookies();
            const datadomeCookie = cookies.find(c => c.name === 'datadome');
            const sessionCookie = cookies.find(c => c.name.includes('STX_SESSION') || c.name.includes('PKP_ID') || c.name.includes('AcpAT'));

            console.log(`\n[Durum Raporu] ${new Date().toLocaleTimeString()}`);
            console.log(`DataDome Çerezi: ${datadomeCookie ? 'VAR' : 'YOK'}`);
            console.log(`Oturum Çerezleri: ${sessionCookie ? 'VAR' : 'YOK'}`);
            
            // Eğer isterseniz çerezleri kaydedebilir veya doğrudan axios/got'a aktarabilirsiniz
        } catch (e) {
            console.error('Çerezler okunamadı:', e.message);
        }
    }, 900000);

}

testPlaywright().catch(console.error);
