import { select } from '@inquirer/prompts';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function start() {
  const answer = await select({
    message: 'Hangi modu çalıştırmak istiyorsunuz?',
    choices: [
      {
        name: 'Tüm Sistem (API Sunucusu + Bütün Schedulerlar)',
        value: 'all',
        description: 'Tüm sistemi tek terminalde başlatır (Varsayılan)',
      },
      {
        name: 'UK Scheduler + API Sunucusu',
        value: 'uk_api',
        description: 'Sadece UK sorgularını çalıştırır ve arayüz için API sunucusunu başlatır.',
      },
      {
        name: 'Non-UK Scheduler (Ek Terminal)',
        value: 'non_uk',
        description: 'Sadece DE, ES, NL, vb. sorgularını çalıştırır. (API sunucusu başlatmaz)',
      },
      {
        name: 'MX Scheduler (Ek Terminal)',
        value: 'mx',
        description: 'Sadece MX sorgularını çalıştırır. (API sunucusu başlatmaz)',
      },
      {
        name: 'FIFA Scheduler (Ek Terminal)',
        value: 'fifa',
        description: 'Sadece FIFA WC26 sorgularını çalıştırır. (API sunucusu başlatmaz, 1dk aralıkla)',
      },
      {
        name: 'FIFA Cookie Harvester (Puppeteer)',
        value: 'fifa_cookie',
        description: 'Arka planda Puppeteer çalıştırarak FIFA çerezlerini günceller. (API sunucusu başlatmaz)',
      },
    ],
  });

  console.log(`\nSeçilen mod: ${answer}\nNodemon başlatılıyor...\n`);

  const nodemonProcess = spawn('npx', ['nodemon', '--ignore', 'fifa-cookies.json', 'src/index.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      RUN_MODE: answer,
    },
    shell: true,
  });

  nodemonProcess.on('close', (code) => {
    process.exit(code);
  });
}

start().catch(console.error);
