import { useEffect, useState } from "react";
import * as Updates from "expo-updates";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";

export default function UpdateChecker() {
    const [isChecking, setIsChecking] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        async function checkForUpdates() {
            try {
                console.log("🔍 چک کردن برای آپدیت...");

                // چک کردن برای آپدیت
                const update = await Updates.checkForUpdateAsync();

                if (update.isAvailable) {
                    console.log("📥 آپدیت جدید پیدا شد، در حال دانلود...");
                    setIsUpdating(true);

                    // شروع دانلود آپدیت
                    await Updates.fetchUpdateAsync();

                    console.log("✅ آپدیت دانلود شد، در حال ریستارت...");
                    // بعد از دانلود → ریستارت برنامه
                    await Updates.reloadAsync();
                } else {
                    console.log("✅ برنامه به‌روز است");
                }
            } catch (error) {
                console.log("❌ خطا در بروزرسانی:", error);
            } finally {
                setIsChecking(false);
            }
        }

        checkForUpdates();
    }, []);

    if (isUpdating) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.text}>📦 در حال بروزرسانی...</Text>
            </View>
        );
    }

    return null; // وقتی آپدیتی نبود، هیچ چیزی نشون نده
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
        backgroundColor: '#fff',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#007AFF',
        zIndex: 9999,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    text: {
        marginLeft: 12,
        fontSize: 16,
        fontWeight: '500',
        color: "#007AFF",
    },
});