export type RootStackParamList = {
    '(tabs)': undefined;
    'chat/[roomId]': { roomId: string };
    'index': undefined;
};

// این برای auto-completion و type checking استفاده می‌شه
declare global {
    namespace ReactNavigation {
        interface RootParamList extends RootStackParamList { }
    }
}