import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Polygon } from 'react-native-maps';

export default function App() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [visitedLocations, setVisitedLocations] = useState<{ latitude: number, longitude: number }[]>([]);

  useEffect(() => {
    async function getLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const current = await Location.getCurrentPositionAsync({});
      setLocation(current);
    }
    getLocation();
  }, []);

  

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 59.9139,
          longitude: 10.7522,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="Du er her"
          />
        )}
        <Polygon 
          coordinates={[
              {
                  "latitude": 59.9600,
                  "longitude": 10.6200
              },
              {
                  "latitude": 59.9600,
                  "longitude": 10.9000
              },
              {
                  "latitude": 59.8400,
                  "longitude": 10.9000
              },
              {
                  "latitude": 59.8400,
                  "longitude": 10.6200
              },
            ]}
            fillColor="rgba(0,0,0,0.7)"
          />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});