const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');

// --- KONFIGURASI UMUM ---
const CLAIM_INTERVAL_MS = 24 * 60 * 60 * 1000; // Klaim setiap 24 jam untuk setiap akun
const DAILY_CLAIM_API_URL = 'https://testnet.humanity.org/api/rewards/daily/claim';
// USER_INFO_API_URL dihapus
const ACCOUNTS_FILE = path.join(__dirname, 'multi.json'); // Path ke file multi.json

const DELAY_BETWEEN_ACCOUNTS_MS = 5000; // Jeda 5 detik antar klaim setiap akun

// --- FUNGSI UTILITY ---

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function loadAccounts() {
    try {
        const accountsData = await fs.readFile(ACCOUNTS_FILE, 'utf8');
        const accounts = JSON.parse(accountsData);

        if (!Array.isArray(accounts) || accounts.length === 0) {
            console.error(`[${new Date().toLocaleString('id-ID')}] ❌ ERROR: File '${ACCOUNTS_FILE}' kosong atau tidak dalam format array JSON yang benar.`);
            return [];
        }
        console.log(`[${new Date().toLocaleString('id-ID')}] ✅ Berhasil memuat ${accounts.length} akun dari '${ACCOUNTS_FILE}'.`);
        return accounts;
    } catch (error) {
        console.error(`[${new Date().toLocaleString('id-ID')}] ❌ ERROR: Gagal memuat '${ACCOUNTS_FILE}': ${error.message}`);
        console.error(`[${new Date().toLocaleString('id-ID')}] Pastikan file tersebut ada di direktori yang sama dan format JSON-nya benar.`);
        return [];
    }
}

// Fungsi getUserInfo dihapus


async function claimReward(account) {
    const { name, AUTH_TOKEN, COOKIE } = account;
    console.log(`\n--- [${new Date().toLocaleString('id-ID')}] Memulai klaim untuk: ${name} ---`);

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
        'Content-Length': '0' // Penting: body kosong untuk POST request ini
    };

    try {
        const response = await axios.post(DAILY_CLAIM_API_URL, {}, { headers: HEADERS });
        
        if (response.status === 200) {
            console.log(`[${new Date().toLocaleString('id-ID')}] ✅ Klaim BERHASIL untuk ${name}.`);
            if (response.data && typeof response.data === 'object' && response.data.daily_claimed === true && response.data.available === false) {
                console.log(`[${new Date().toLocaleString('id-ID')}] ℹ️ Reward harian SUDAH DIKLAIM untuk ${name} hari ini.`);
            } else if (response.data) {
                const responseDataString = typeof response.data === 'object' ? JSON.stringify(response.data) : response.data;
                console.log(`[${new Date().toLocaleString('id-ID')}] ✨ Detail Klaim ${name}: ${responseDataString}`);
            } else {
                console.log(`[${new Date().toLocaleString('id-ID')}] ✨ Detail Klaim ${name}: (Tidak ada respons data yang berarti)`);
            }
        } else {
            console.error(`[${new Date().toLocaleString('id-ID')}] ❌ Klaim GAGAL untuk ${name} (Status: ${response.status}).`);
            const errorResponseData = typeof response.data === 'object' ? JSON.stringify(response.data) : response.data;
            console.error(`[${new Date().toLocaleString('id-ID')}] Pesan API: ${errorResponseData}`);
        }
    } catch (error) {
        if (error.response) {
            const errorResponseBody = typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : error.response.data;
            console.error(`[${new Date().toLocaleString('id-ID')}] ❌ Error klaim untuk ${name} (Respons Server): ${error.response.status} - ${error.response.data.message || errorResponseBody}`);
            if (error.response.status === 401 || error.response.status === 403) {
                console.error(`[${new Date().toLocaleString('id-ID')}] ⚠️ Token otorisasi atau cookie untuk ${name} kemungkinan KADALUARSA/TIDAK VALID. Harap perbarui di 'multi.json'.`);
            }
        } else if (error.request) {
            console.error(`[${new Date().toLocaleString('id-ID')}] ❌ Error klaim untuk ${name} (Tidak ada Respons dari Server): ${error.message}`);
        } else {
            console.error(`[${new Date().toLocaleString('id-ID')}] ❌ Error klaim untuk ${name} (Umum): ${error.message}`);
        }
    } finally {
        // Bagian untuk mengambil dan menampilkan total balance dihapus
        // console.log(`[${new Date().toLocaleString('id-ID')}] Mengambil total balance untuk ${name}...`);
        // const totalRewardsAfterClaim = await getUserInfo(account);
        // console.log(`[${new Date().toLocaleString('id-ID')}] 💰 Total Balance untuk ${name}: ${totalRewardsAfterClaim}`);
    }
}

async function runAllClaims() {
    console.log(`\n===== [${new Date().toLocaleString('id-ID')}] Memulai siklus klaim Humanity.org =====`);
    
    const ACCOUNTS = await loadAccounts(); 
    
    if (ACCOUNTS.length === 0) {
        console.warn(`[${new Date().toLocaleString('id-ID')}] ⚠️ Tidak ada akun yang valid dimuat dari 'multi.json'. Menghentikan siklus klaim ini.`);
        console.log(`===== [${new Date().toLocaleString('id-ID')}] Siklus klaim selesai. Menunggu siklus berikutnya... =====`);
        return;
    }

    console.log(`[${new Date().toLocaleString('id-ID')}] Memproses ${ACCOUNTS.length} akun terdaftar.`);

    for (let i = 0; i < ACCOUNTS.length; i++) {
        const account = ACCOUNTS[i];
        console.log(`[${new Date().toLocaleString('id-ID')}] Memproses akun ${i + 1}/${ACCOUNTS.length}: ${account.name}`);
        await claimReward(account);

        if (i < ACCOUNTS.length - 1) {
            console.log(`[${new Date().toLocaleString('id-ID')}] Menunggu ${DELAY_BETWEEN_ACCOUNTS_MS / 1000} detik sebelum klaim akun berikutnya...`);
            await delay(DELAY_BETWEEN_ACCOUNTS_MS);
        }
    }
    console.log(`\n===== [${new Date().toLocaleString('id-ID')}] Siklus klaim selesai. Menunggu siklus berikutnya dalam ${CLAIM_INTERVAL_MS / (1000 * 60 * 60)} jam. =====`);
}

// --- INISIALISASI DAN PENJADWALAN ---

console.log(`\n[${new Date().toLocaleString('id-ID')}] 🎉 Bot auto claim Humanity.org telah dimulai!`);
console.log(`[${new Date().toLocaleString('id-ID')}] Bot akan menjalankan siklus klaim setiap ${CLAIM_INTERVAL_MS / (1000 * 60 * 60)} jam.`);
console.log(`[${new Date().toLocaleString('id-ID')}] Jeda antar klaim akun: ${DELAY_BETWEEN_ACCOUNTS_MS / 1000} detik.`);
console.log(`[${new Date().toLocaleString('id-ID')}] Pastikan token otorisasi dan cookie untuk setiap akun di 'multi.json' selalu valid.`);

runAllClaims();
setInterval(runAllClaims, CLAIM_INTERVAL_MS);