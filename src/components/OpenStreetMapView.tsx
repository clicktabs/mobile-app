import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export type MapPin = {
  id: string | number;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
};

function buildMapHtml(
  pins: MapPin[],
  user?: { lat: number; lng: number } | null,
) {
  const center = user
    ? [user.lat, user.lng]
    : pins[0]
      ? [pins[0].lat, pins[0].lng]
      : [39.8283, -98.5795];
  const zoom = pins.length || user ? 11 : 4;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin:0; padding:0; height:100%; width:100%; background:#e8f0e8; }
    .arrow-wrap {
      width: 0; height: 0;
      border-left: 11px solid transparent;
      border-right: 11px solid transparent;
      border-bottom: 22px solid #FF4D8D;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,.35));
      transform: translate(-11px, -18px);
    }
    .arrow-wrap::after {
      content: '';
      position: absolute;
      left: -5px; top: 14px;
      width: 10px; height: 10px;
      background: #FF4D8D;
      border-radius: 50%;
    }
    .user-dot {
      width: 14px; height: 14px;
      background: #2563eb;
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(37,99,235,.35);
      transform: translate(-7px, -7px);
    }
    .leaflet-popup-content { margin: 10px 12px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    .popup-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
    .popup-sub { color: #6b7280; font-size: 12px; line-height: 1.35; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var pins = ${JSON.stringify(pins)};
    var user = ${JSON.stringify(user || null)};
    var map = L.map('map', { zoomControl: true }).setView([${center[0]}, ${center[1]}], ${zoom});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var arrowIcon = L.divIcon({
      className: '',
      html: '<div class="arrow-wrap"></div>',
      iconSize: [22, 22],
      iconAnchor: [0, 0]
    });

    var bounds = [];
    pins.forEach(function (p) {
      var m = L.marker([p.lat, p.lng], { icon: arrowIcon }).addTo(map);
      var html = '<div class="popup-title">' + (p.title || 'Patient') + '</div>';
      if (p.subtitle) html += '<div class="popup-sub">' + p.subtitle + '</div>';
      m.bindPopup(html);
      bounds.push([p.lat, p.lng]);
    });

    if (user) {
      L.marker([user.lat, user.lng], {
        icon: L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [14, 14], iconAnchor: [0, 0] })
      }).addTo(map).bindPopup('You are here');
      bounds.push([user.lat, user.lng]);
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 13);
    }
  </script>
</body>
</html>`;
}

export function OpenStreetMapView({
  pins,
  user,
}: {
  pins: MapPin[];
  user?: { lat: number; lng: number } | null;
}) {
  const html = useMemo(() => buildMapHtml(pins, user), [pins, user]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.fill}>
        {React.createElement('iframe', {
          title: 'Route map',
          srcDoc: html,
          style: webIframeStyle,
        })}
      </View>
    );
  }

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      style={styles.fill}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      mixedContentMode="always"
    />
  );
}

const webIframeStyle = {
  border: 'none',
  width: '100%',
  height: '100%',
} as const;

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#e8f0e8' },
});
