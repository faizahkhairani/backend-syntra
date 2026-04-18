// Haversine formula — hitung jarak antara 2 koordinat (dalam meter)
const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // radius bumi dalam meter
  const toRad = (val) => (val * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // hasil dalam meter
};

const isWithinOfficeRadius = (latitude, longitude) => {
  const officeLat = parseFloat(process.env.OFFICE_LATITUDE);
  const officeLon = parseFloat(process.env.OFFICE_LONGITUDE);
  const allowedRadius = parseFloat(process.env.OFFICE_RADIUS_METERS);

  const distance = getDistanceInMeters(
    latitude,
    longitude,
    officeLat,
    officeLon
  );

  return {
    isValid: distance <= allowedRadius,
    distance: Math.round(distance), // bulatkan ke meter
    allowedRadius,
  };
};

module.exports = { isWithinOfficeRadius };