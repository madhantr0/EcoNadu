/* ==========================================================
   EcoNadu settings. Edit only this file for setup.
   ========================================================== */
window.ECONADU_CONFIG = {
  // Google sign-in: paste your OAuth Web Client ID here (see README.md)
  GOOGLE_CLIENT_ID: '',

  // Optional: sync posts between devices through Gun.js relays.
  // Leave as [] to keep everything on this device.
  GUN_PEERS: [],

  // Require phone motion (liveness) between the two shots. Set false only for desktop testing.
  REQUIRE_MOTION: true,

  // Tamil Nadu bounding box, used for GPS checks on planting
  TN_BOUNDS: { minLat: 8.05, maxLat: 13.6, minLng: 76.2, maxLng: 80.38 },

  DISTRICTS: [
    { name: 'Ariyalur', lat: 11.14, lng: 79.08 },
    { name: 'Chengalpattu', lat: 12.69, lng: 79.98 },
    { name: 'Chennai', lat: 13.08, lng: 80.27 },
    { name: 'Coimbatore', lat: 11.0, lng: 76.96 },
    { name: 'Cuddalore', lat: 11.75, lng: 79.77 },
    { name: 'Dharmapuri', lat: 12.13, lng: 78.16 },
    { name: 'Dindigul', lat: 10.36, lng: 77.98 },
    { name: 'Erode', lat: 11.34, lng: 77.72 },
    { name: 'Kallakurichi', lat: 11.74, lng: 78.96 },
    { name: 'Kanchipuram', lat: 12.83, lng: 79.7 },
    { name: 'Kanyakumari', lat: 8.08, lng: 77.54 },
    { name: 'Karur', lat: 10.96, lng: 78.08 },
    { name: 'Krishnagiri', lat: 12.52, lng: 78.21 },
    { name: 'Madurai', lat: 9.93, lng: 78.12 },
    { name: 'Mayiladuthurai', lat: 11.1, lng: 79.65 },
    { name: 'Nagapattinam', lat: 10.77, lng: 79.84 },
    { name: 'Namakkal', lat: 11.22, lng: 78.17 },
    { name: 'Nilgiris', lat: 11.41, lng: 76.7 },
    { name: 'Perambalur', lat: 11.23, lng: 78.88 },
    { name: 'Pudukkottai', lat: 10.38, lng: 78.82 },
    { name: 'Ramanathapuram', lat: 9.37, lng: 78.83 },
    { name: 'Ranipet', lat: 12.93, lng: 79.33 },
    { name: 'Salem', lat: 11.65, lng: 78.16 },
    { name: 'Sivaganga', lat: 9.85, lng: 78.48 },
    { name: 'Tenkasi', lat: 8.96, lng: 77.31 },
    { name: 'Thanjavur', lat: 10.79, lng: 79.14 },
    { name: 'Theni', lat: 10.01, lng: 77.48 },
    { name: 'Thoothukudi', lat: 8.76, lng: 78.13 },
    { name: 'Tiruchirappalli', lat: 10.79, lng: 78.7 },
    { name: 'Tirunelveli', lat: 8.71, lng: 77.76 },
    { name: 'Tirupathur', lat: 12.5, lng: 78.57 },
    { name: 'Tiruppur', lat: 11.11, lng: 77.34 },
    { name: 'Tiruvallur', lat: 13.14, lng: 79.91 },
    { name: 'Tiruvannamalai', lat: 12.23, lng: 79.07 },
    { name: 'Tiruvarur', lat: 10.77, lng: 79.64 },
    { name: 'Vellore', lat: 12.92, lng: 79.13 },
    { name: 'Viluppuram', lat: 11.94, lng: 79.49 },
    { name: 'Virudhunagar', lat: 9.58, lng: 77.96 }
  ]
};
