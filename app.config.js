const appJson = require("./app.json");

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
    },
  },
};
