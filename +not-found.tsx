import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Colors } from '@/constants/colors';
import { FontSize, Spacing } from '@/constants/typography';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This Screen Does Not Exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to Home Screen</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.screen,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: FontSize.heading,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  link: {
    marginTop: Spacing.card,
    paddingVertical: Spacing.card,
  },
  linkText: {
    fontSize: FontSize.body,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
});
