import { View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export default function ThemedView(props: any) {
  const { colors } = useTheme();
  return (
    <View
      {...props}
      style={[{ backgroundColor: colors.background }, props.style]}
    >
      {props.children}
    </View>
  );
}