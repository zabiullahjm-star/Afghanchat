// scripts/ci-polyfills.js
// جلوگیری از خطای "window is not defined" در محیط CI (مثل GitHub Actions)

if (typeof global.window === 'undefined') {
    global.window = {}; // فقط وجود window را شبیه‌سازی می‌کند
}

if (typeof global.navigator === 'undefined') {
    global.navigator = { product: 'Node' };
}

if (typeof global.document === 'undefined') {
    global.document = {};
}