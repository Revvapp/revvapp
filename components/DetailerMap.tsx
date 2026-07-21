import { StyleSheet, Text, View } from 'react-native';

type Point = { uid: string; lat?: number; lng?: number; label: string };

export function DetailerMap(_: {
  points: Point[];
  selectedId: string | null;
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  onSelect: (id: string) => void;
}) {
  return <View style={styles.container}><Text style={styles.text}>Map view is available in the Revv mobile app.</Text></View>;
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', backgroundColor: '#E8EDF3', flex: 1, justifyContent: 'center', padding: 24 },
  text: { color: '#1A3A5C', fontSize: 15, textAlign: 'center' },
});
