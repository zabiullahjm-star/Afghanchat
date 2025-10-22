// Polyfill for CI environment - Complete version
if (typeof window === 'undefined') {
    global.window = {
        document: {
            getElementsByTagName: () => [],
            createElement: () => ({
                setAttribute: () => { },
                appendChild: () => { },
            }),
            head: {
                appendChild: () => { },
            },
        },
        navigator: {
            userAgent: '',
        },
        location: {
            href: '',
            protocol: 'https:',
            host: '',
            hostname: '',
            port: '',
            pathname: '',
            search: '',
            hash: '',
            origin: 'https://localhost',
        },
    };

    global.document = global.window.document;
    global.navigator = global.window.navigator;
    global.location = global.window.location;

    global.localStorage = {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { },
        clear: () => { },
        key: () => null,
        length: 0,
    };

    global.sessionStorage = {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { },
        clear: () => { },
        key: () => null,
        length: 0,
    };

    // Prevent vaul from trying to insert CSS
    global.CSS = {
        supports: () => false,
    };
}