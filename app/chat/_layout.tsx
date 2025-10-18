import { Stack } from 'expo-router';

export default function ChatLayout() {
    return (
        <Stack>
            <Stack.Screen
                name="[roomId]"
                options={{
                    title: 'چت',
                    headerBackTitle: 'بازگشت'
                }}
            />
        </Stack>
    );
}