// Polyfill for CI environment
if (typeof window === 'undefined') {
    global.window = {};
    global.document = {};
    global.navigator = {};
    global.localStorage = {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { },
    };
}