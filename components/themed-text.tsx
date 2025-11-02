import { Text } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export default function ThemedText(props: any) {
  const { colors } = useTheme();
  return (
    <Text
      {...props}
      style={[{ color: colors.text }, props.style]}
    >
      {props.children}
    </Text>
  );
}