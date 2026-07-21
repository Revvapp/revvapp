import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';

type Point = { uid: string; lat?: number; lng?: number; label: string };

export function DetailerMap({ points, selectedId, region, onSelect }: {
  points: Point[];
  selectedId: string | null;
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  onSelect: (id: string) => void;
}) {
  return (
    <MapView style={StyleSheet.absoluteFill} initialRegion={region} showsUserLocation showsMyLocationButton={false}>
      {points.filter((point) => point.lat != null && point.lng != null).map((point) => (
        <Marker key={point.uid} coordinate={{ latitude: point.lat!, longitude: point.lng! }} onPress={() => onSelect(point.uid)}>
          <View style={[styles.pin, selectedId === point.uid && styles.selected]}>
            <Text style={[styles.text, selectedId === point.uid && styles.selectedText]}>{point.label}</Text>
          </View>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: { backgroundColor: '#1A3A5C', borderColor: '#C9A227', borderRadius: 18, borderWidth: 2, paddingHorizontal: 8, paddingVertical: 5 },
  selected: { backgroundColor: '#C9A227', borderColor: '#FFFFFF' },
  text: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  selectedText: { color: '#1A3A5C' },
});
