import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
import * as Location from "expo-location";
import { Polygon } from "react-native-maps";

const MAP_STYLE = [
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "all",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "all",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
];

function generateGrid() {
  const tileSize = 0.005;
  const tiles = [];

  for (let lat = 59.84; lat < 59.98; lat += tileSize) {
    for (let lng = 10.62; lng < 10.94; lng += tileSize) {
      tiles.push([
        { latitude: lat, longitude: lng },
        { latitude: lat + tileSize, longitude: lng },
        { latitude: lat + tileSize, longitude: lng + tileSize },
        { latitude: lat, longitude: lng + tileSize },
      ]);
    }
  }

  return tiles;
}

function isVisited(
  tile: { latitude: number; longitude: number }[],
  visitedLocations: { latitude: number; longitude: number }[],
) {
  return visitedLocations.some((position) => {
    return (
      position.latitude > tile[0].latitude &&
      position.latitude < tile[0].latitude + 0.005 &&
      position.longitude > tile[0].longitude &&
      position.longitude < tile[0].longitude + 0.005
    );
  });
}

export default function App() {
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [visitedLocations, setVisitedLocations] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [grid, setGrid] = useState<{ latitude: number; longitude: number }[][]>(
    [],
  );

  useEffect(() => {
    async function getLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      setGrid(generateGrid());

      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation },
        (newPosition) => {
          setLocation(newPosition);
          setVisitedLocations((prev) => [...prev, newPosition.coords]);
        },
      );
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

        {grid.map(
          (rute, index) =>
            !isVisited(rute, visitedLocations) && (
              <Polygon
                key={index}
                coordinates={rute}
                fillColor="rgba(0,0,0,0.8)"
              />
            ),
        )}
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
