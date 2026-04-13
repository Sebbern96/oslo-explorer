import 'dotenv/config';

export default {
  expo: {
    name: "oslo-explorer",
    slug: "oslo-explorer",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    plugins:[
      [
        "react-native-maps",{
          googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
        }
      ]
    ],
    ios: {
      bundleIdentifier: "com.anonymous.osloexplorer",
        supportsTablet: true,
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    },
    android: {
      package: "com.anonymous.osloexplorer",
        adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    web: {
      favicon: "./assets/favicon.png"
    }
  }
};