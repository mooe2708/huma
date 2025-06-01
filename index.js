const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');

// --- KONFIGURASI UMUM ---
const CLAIM_INTERVAL_MS = 24 * 60 * 60 * 1000; // Klaim setiap 24 jam untuk setiap akun
const DAILY_CLAIM_API_URL = 'https://testnet.humanity.org/api/rewards/daily/claim';
const ACCOUNTS_FILE = path.join(__dirname, 'multi.json'); // Path ke file multi.json

const DELAY_BETWEEN_ACCOUNTS_MS = 5000; // Jeda 5 detik antar klaim setiap akun

// --- FUNGSI UTILITY UNTUK LOGGING BERWARNA ---
const Colors = {
    Reset: "\x1b[0m",
    Bright: "\x1b[1m",
    Dim: "\x1b[2m",
    Underscore: "\x1b[4m",
    Blink: "\x1b[5m",
    Reverse: "\x1b[7m",
    Hidden: "\x1b[8m",

    FgBlack: "\x1b[30m",
    FgRed: "\x1b[31m",
    FgGreen: "\x1b[32m",
    FgYellow: "\x1b[33m",
    FgBlue: "\x1b[34m",
    FgMagenta: "\x1b[35m",
    FgCyan: "\x1b[36m",
    FgWhite: "\x1b[37m",

    BgBlack: "\x1b[40m",
    BgRed: "\x1b[41m",
    BgGreen: "\x1b[42m",
    BgYellow: "\x1b[43m",
    BgBlue: "\x1b[44m",
    BgMagenta: "\x1b[45m",
    BgCyan: "\x1b[46m",
    BgWhite: "\x1b[47m",
};

// Fungsi helper untuk log yang lebih cantik
function logMessage(level, message, color = Colors.Reset) {
    const timestamp = new Date().toLocaleString('id-ID');
    let prefix = '';
    switch (level) {
        case 'INFO':
            prefix = `${Colors.FgCyan}${Colors.Bright}[INFO]${Colors.Reset}`;
            break;
        case 'SUCCESS':
            prefix = `${Colors.FgGreen}${Colors.Bright}[SUCCESS]${Colors.Reset}`;
            break;
        case 'WARNING':
            prefix = `${Colors.FgYellow}${Colors.Bright}[WARNING]${Colors.Reset}`;
            break;
        case 'ERROR':
            prefix = `${Colors.FgRed}${Colors.Bright}[ERROR]${Colors.Reset}`;
            break;
        default:
            prefix = `[LOG]`;
    }
    console.log(`${prefix} ${Colors.Dim}${timestamp}${Colors.Reset} ${color}${message}${Colors.Reset}`);
}

function logDivider(char = '=', length = 50, color = Colors.FgBlue) {
    console.log(`${color}${char.repeat(length)}${Colors.Reset}`);
}

// --- FUNGSI UTAMA BOT ---

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function loadAccounts() {
    try {
        const accountsData = await fs.readFile(ACCOUNTS_FILE, 'utf8');
        const accounts = JSON.parse(accountsData);

        if (!Array.isArray(accounts) || accounts.length === 0) {
            logMessage('ERROR', `File '${ACCOUNTS_FILE}' kosong atau tidak dalam format array JSON yang benar.`, Colors.FgRed);
            return [];
        }
        logMessage('INFO', `Berhasil memuat ${Colors.FgYellow}${accounts.length}${Colors.Reset} akun dari '${Colors.FgYellow}${ACCOUNTS_FILE}${Colors.Reset}'.`, Colors.FgCyan);
        return accounts;
    } catch (error) {
        logMessage('ERROR', `Gagal memuat '${ACCOUNTS_FILE}': ${error.message}`, Colors.FgRed);
        logMessage('INFO', `Pastikan file tersebut ada di direktori yang sama dan format JSON-nya benar.`, Colors.FgYellow);
        return [];
    }
}

async function claimReward(account) {
    const { name, AUTH_TOKEN, COOKIE } = account;
    logDivider('-', 40, Colors.FgMagenta);
    logMessage('INFO', `Memulai klaim untuk akun: ${Colors.FgCyan}${name}${Colors.Reset}`, Colors.FgWhite);

    const HEADERS = {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Cookie': COOKIE,
        'Origin': 'https://testnet.humanity.org',
        'Referer': 'https://testnet.humanity.org/dashboard',
        'Sec-Ch-Ua': '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        'Content-Length': '0'
    };

    try {
        const response = await axios.post(DAILY_CLAIM_API_URL, {}, { headers: HEADERS });
        
        if (response.status === 200) {
            logMessage('SUCCESS', `Klaim BERHASIL untuk ${Colors.FgCyan}${name}${Colors.Reset}.`, Colors.FgGreen);
            if (response.data && typeof response.data === 'object' && response.data.daily_claimed === true && response.data.available === false) {
                logMessage('INFO', `Reward harian ${Colors.FgYellow}SUDAH DIKLAIM${Colors.Reset} untuk ${Colors.FgCyan}${name}${Colors.Reset} hari ini.`, Colors.FgYellow);
            } 
            // Bagian untuk mencetak detail klaim API yang mungkin rusak telah dihapus.
        } else {
            logMessage('ERROR', `Klaim GAGAL untuk ${Colors.FgCyan}${name}${Colors.Reset} (Status: ${response.status}).`, Colors.FgRed);
            const errorResponseData = typeof response.data === 'object' ? JSON.stringify(response.data) : response.data;
            logMessage('ERROR', `Pesan API: ${errorResponseData}`, Colors.FgRed);
        }
    } catch (error) {
        if (error.response) {
            const errorResponseBody = typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : error.response.data;
            logMessage('ERROR', `Error klaim untuk ${Colors.FgCyan}${name}${Colors.Reset} (Respons Server): ${error.response.status} - ${error.response.data.message || errorResponseBody}`, Colors.FgRed);
            if (error.response.status === 401 || error.response.status === 403) {
                logMessage('WARNING', `Token otorisasi atau cookie untuk ${Colors.FgCyan}${name}${Colors.Reset} kemungkinan KADALUARSA/TIDAK VALID. Harap perbarui di 'multi.json'.`, Colors.FgYellow);
            }
        } else if (error.request) {
            logMessage('ERROR', `Error klaim untuk ${Colors.FgCyan}${name}${Colors.Reset} (Tidak ada Respons dari Server): ${error.message}`, Colors.FgRed);
        } else {
            logMessage('ERROR', `Error klaim untuk ${Colors.FgCyan}${name}${Colors.Reset} (Umum): ${error.message}`, Colors.FgRed);
        }
    }
}

async function runAllClaims() {
    logDivider('=');
    logMessage('INFO', `Memulai siklus klaim Humanity.org.`);
    logDivider('=');
    
    const ACCOUNTS = await loadAccounts(); 
    
    if (ACCOUNTS.length === 0) {
        logMessage('WARNING', `Tidak ada akun yang valid dimuat dari 'multi.json'. Menghentikan siklus klaim ini.`, Colors.FgYellow);
        logDivider('=');
        logMessage('INFO', `Siklus klaim selesai. Menunggu siklus berikutnya...`);
        logDivider('=');
        return;
    }

    logMessage('INFO', `Memproses ${Colors.FgYellow}${ACCOUNTS.length}${Colors.Reset} akun terdaftar.`, Colors.FgCyan);
    logDivider('-');

    for (let i = 0; i < ACCOUNTS.length; i++) {
        const account = ACCOUNTS[i];
        logMessage('INFO', `Memproses akun ${Colors.FgYellow}${i + 1}/${ACCOUNTS.length}${Colors.Reset}: ${Colors.FgCyan}${account.name}${Colors.Reset}`);
        await claimReward(account);

        if (i < ACCOUNTS.length - 1) {
            logMessage('INFO', `Menunggu ${Colors.FgYellow}${DELAY_BETWEEN_ACCOUNTS_MS / 1000}${Colors.Reset} detik sebelum klaim akun berikutnya...`, Colors.FgBlue);
            await delay(DELAY_BETWEEN_ACCOUNTS_MS);
        }
    }
    logDivider('=');
    logMessage('SUCCESS', `Siklus klaim untuk semua akun selesai!`, Colors.FgGreen);
    logMessage('INFO', `Siklus berikutnya dalam ${Colors.FgYellow}${CLAIM_INTERVAL_MS / (1000 * 60 * 60)}${Colors.Reset} jam.`);
    logDivider('=');
}

// --- INISIALISASI DAN PENJADWALAN ---

logDivider('*', 60, Colors.FgMagenta);
logMessage('INFO', `🎉 ${Colors.Bright}Bot Auto Claim Humanity.org${Colors.Reset} telah dimulai!`, Colors.FgWhite);
logMessage('INFO', `Bot akan menjalankan siklus klaim setiap ${Colors.FgYellow}${CLAIM_INTERVAL_MS / (1000 * 60 * 60)}${Colors.Reset} jam.`, Colors.FgCyan);
logMessage('INFO', `Jeda antar klaim akun: ${Colors.FgYellow}${DELAY_BETWEEN_ACCOUNTS_MS / 1000}${Colors.Reset} detik.`, Colors.FgCyan);
logMessage('WARNING', `Pastikan ${Colors.Bright}TOKEN OTORISASI${Colors.Reset} dan ${Colors.Bright}COOKIE${Colors.Reset} untuk setiap akun di '${Colors.FgYellow}multi.json${Colors.Reset}' selalu ${Colors.Bright}VALID${Colors.Reset}.`, Colors.FgYellow);
logDivider('*', 60, Colors.FgMagenta);

// Jalankan siklus klaim pertama kali saat bot dimulai
runAllClaims();

// Jadwalkan siklus klaim berikutnya
setInterval(runAllClaims, CLAIM_INTERVAL_MS);
