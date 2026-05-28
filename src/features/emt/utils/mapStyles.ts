const MAP_STYLES: google.maps.MapTypeStyle[] = [
  // Base global
  { featureType: 'all', elementType: 'geometry.fill',       stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'all', elementType: 'geometry.stroke',     stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'all', elementType: 'labels.text.fill',    stylers: [{ color: '#6b7280' }] },
  { featureType: 'all', elementType: 'labels.text.stroke',  stylers: [{ color: '#f5f5f5' }] },

  // Carreteras
  { featureType: 'road',          elementType: 'geometry.fill',   stylers: [{ color: '#ffffff' }] },
  { featureType: 'road',          elementType: 'geometry.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill',   stylers: [{ color: '#d4d4d4' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#d4d4d4' }] },
  { featureType: 'road.highway',  elementType: 'geometry.fill',   stylers: [{ color: '#b8b8b8' }] },
  { featureType: 'road.highway',  elementType: 'geometry.stroke', stylers: [{ color: '#c8c8c8' }] },
  { featureType: 'road.local',    elementType: 'labels',          stylers: [{ visibility: 'off' }] },

  // Transporte público
  { featureType: 'transit.station', elementType: 'labels', stylers: [{ visibility: 'off' }] },

  // Paisaje natural
  { featureType: 'landscape.natural', elementType: 'geometry.fill', stylers: [{ color: '#d8e0d4' }] },

  // Agua
  { featureType: 'water', elementType: 'geometry.fill',    stylers: [{ color: '#c9d8e0' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },

  // POI: ocultar geometría y etiquetas
  { featureType: 'poi', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels',   stylers: [{ visibility: 'off' }] },
]

export default MAP_STYLES
