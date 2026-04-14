<?php
/**
 * FX Convert — convert.php
 * Handles currency conversion using Frankfurter API (free, no key required)
 * Falls back to a static rates table if API is unreachable
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
error_reporting(0); // Hide PHP errors from frontend in production

// ─── Ticker Mode ──────────────────────────────────────────────────────────────
// GET ?ticker=1 returns all rates from USD for the ticker bar
if (isset($_GET['ticker'])) {
    $rates = fetchRatesFromAPI('USD');
    if ($rates) {
        echo json_encode(['rates' => $rates]);
    } else {
        echo json_encode(['rates' => getFallbackRates()]);
    }
    exit;
}

// ─── Validate POST inputs ────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Use POST.']);
    exit;
}

$amount = isset($_POST['amount']) ? trim($_POST['amount']) : '';
$from   = isset($_POST['from'])   ? strtoupper(trim($_POST['from']))   : '';
$to     = isset($_POST['to'])     ? strtoupper(trim($_POST['to']))     : '';

// ─── Input Validation ─────────────────────────────────────────────────────────
if (!is_numeric($amount) || (float)$amount <= 0) {
    echo json_encode(['error' => 'Invalid amount. Must be a positive number.']);
    exit;
}

$validCurrencies = [
    'USD','EUR','GBP','JPY','AUD','CAD','CHF','CNY','INR','BDT',
    'MXN','BRL','KRW','SGD','HKD','NOK','SEK','DKK','NZD','ZAR',
    'AED','SAR','TRY','THB','IDR','MYR','PHP','PKR','EGP','PLN',
    'CZK','HUF'
];

if (!in_array($from, $validCurrencies) || !in_array($to, $validCurrencies)) {
    echo json_encode(['error' => 'Unsupported currency code.']);
    exit;
}

$amount = (float)$amount;

// ─── Same currency shortcut ───────────────────────────────────────────────────
if ($from === $to) {
    echo json_encode([
        'result' => $amount,
        'rate'   => 1.0,
        'from'   => $from,
        'to'     => $to,
        'source' => 'same_currency',
    ]);
    exit;
}

// ─── Fetch Rate ───────────────────────────────────────────────────────────────
$rate = getRateFromAPI($from, $to);

if ($rate === false) {
    // Try fallback
    $rate = getRateFromFallback($from, $to);
    $source = 'fallback';
} else {
    $source = 'frankfurter';
}

if ($rate === false) {
    echo json_encode(['error' => 'Could not retrieve exchange rate. Try again later.']);
    exit;
}

$result = round($amount * $rate, 4);

echo json_encode([
    'result' => $result,
    'rate'   => $rate,
    'from'   => $from,
    'to'     => $to,
    'amount' => $amount,
    'source' => $source,
]);
exit;


// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Fetch a single exchange rate from Frankfurter API
 */
function getRateFromAPI(string $from, string $to): float|false {
    $url  = "https://api.frankfurter.app/latest?from={$from}&to={$to}";
    $data = fetchJSON($url);
    if ($data && isset($data['rates'][$to])) {
        return (float)$data['rates'][$to];
    }
    return false;
}

/**
 * Fetch all rates from a base currency (used for ticker)
 */
function fetchRatesFromAPI(string $base): array|false {
    $url  = "https://api.frankfurter.app/latest?from={$base}";
    $data = fetchJSON($url);
    return ($data && isset($data['rates'])) ? $data['rates'] : false;
}

/**
 * Generic JSON fetcher using cURL
 */
function fetchJSON(string $url): array|false {
    if (!function_exists('curl_init')) return false;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 6,
        CURLOPT_USERAGENT      => 'FXConvert/1.0',
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_FOLLOWLOCATION => true,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $httpCode !== 200) return false;

    $decoded = json_decode($response, true);
    return (json_last_error() === JSON_ERROR_NONE) ? $decoded : false;
}

/**
 * Static fallback rates (approximate, relative to USD)
 * Used only if the API is unreachable
 */
function getFallbackRates(): array {
    return [
        'EUR' => 0.9245, 'GBP' => 0.7921, 'JPY' => 149.50,
        'AUD' => 1.5312, 'CAD' => 1.3605, 'CHF' => 0.8972,
        'CNY' => 7.2345, 'INR' => 83.12,  'BDT' => 110.25,
        'MXN' => 17.12,  'BRL' => 4.97,   'KRW' => 1325.0,
        'SGD' => 1.3420, 'HKD' => 7.8240, 'NOK' => 10.58,
        'SEK' => 10.42,  'DKK' => 6.89,   'NZD' => 1.6250,
        'ZAR' => 18.72,  'AED' => 3.6725, 'SAR' => 3.7500,
        'TRY' => 32.10,  'THB' => 35.45,  'IDR' => 15680.0,
        'MYR' => 4.7150, 'PHP' => 56.32,  'PKR' => 278.50,
        'EGP' => 30.90,  'PLN' => 3.9870, 'CZK' => 22.94,
        'HUF' => 357.20,
    ];
}

/**
 * Convert using fallback static rates (via USD as pivot)
 */
function getRateFromFallback(string $from, string $to): float|false {
    $rates = getFallbackRates();
    // Add USD itself
    $rates['USD'] = 1.0;

    if (!isset($rates[$from]) || !isset($rates[$to])) return false;

    // Cross-rate: from → USD → to
    $inUSD = 1.0 / $rates[$from];
    return round($inUSD * $rates[$to], 6);
}
