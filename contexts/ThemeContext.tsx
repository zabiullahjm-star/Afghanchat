import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AppTheme = 'light' | 'dark' | 'auto';
type ChatBackground = {
    type: 'color' | 'image';
    value: string; // رنگ یا آدرس تصویر
};

interface ThemeContextType {
    // تم کلی اپ
    appTheme: AppTheme;
    setAppTheme: (theme: AppTheme) => void;

    // تم چت روم
    chatBackground: ChatBackground;
    setChatBackground: (background: ChatBackground) => void;

    // رنگ‌های动态 براساس تم
    colors: any;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemTheme = useColorScheme();
    const [appTheme, setAppTheme] = useState<AppTheme>('auto');
    const [chatBackground, setChatBackground] = useState<ChatBackground>({
        type: 'color',
        value: '#f8f9fa'
    });

    // محاسبه تم فعال (resolve possible null/undefined from useColorScheme)
    const resolvedSystemTheme: 'light' | 'dark' = (systemTheme ?? 'light') as 'light' | 'dark';
    const activeTheme: 'light' | 'dark' = appTheme === 'auto'
        ? resolvedSystemTheme
        : (appTheme === 'dark' ? 'dark' : 'light');
    const isDark = activeTheme === 'dark';

    // رنگ‌های تم
    const colors = {
        light: {
            background: '#ffffff',
            surface: '#f8f9fa',
            primary: '#007AFF',
            text: '#1a1a1a',
            // ...
        },
        dark: {
            background: '#1a1a1a',
            surface: '#2d2d2d',
            primary: '#0A84FF',
            text: '#ffffff',
            // ...
        }
    }[activeTheme];

    // ذخیره در AsyncStorage
    useEffect(() => {
        AsyncStorage.setItem('appTheme', appTheme);
    }, [appTheme]);

    useEffect(() => {
        AsyncStorage.setItem('chatBackground', JSON.stringify(chatBackground));
    }, [chatBackground]);

    // بارگذاری از AsyncStorage
    useEffect(() => {
        loadSavedThemes();
    }, []);

    const loadSavedThemes = async () => {
        try {
            const savedAppTheme = await AsyncStorage.getItem('appTheme');
            const savedChatBg = await AsyncStorage.getItem('chatBackground');

            if (savedAppTheme) setAppTheme(savedAppTheme as AppTheme);
            if (savedChatBg) setChatBackground(JSON.parse(savedChatBg));
        } catch (error) {
            console.log('خطا در بارگذاری تم‌ها');
        }
    };

    return (
        <ThemeContext.Provider value={{
            appTheme,
            setAppTheme,
            chatBackground,
            setChatBackground,
            colors,
            isDark
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};