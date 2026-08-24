// Ciudades conocidas para ubicar puntos en el mapa de la pestaña Geo cuando
// la columna "Ubicación" del Sheet trae una ciudad en vez de un país (los
// países se ubican directo contra el propio mapa en GeoMap.jsx, comparando
// nombres). Cubre las ciudades principales de los 5 países donde opera
// Mediaudience Latam (ver [[project_mediaudience_pais_clientes]]). `pais` usa
// el nombre exacto de Natural Earth/world-atlas -- GeoMap lo usa para saber
// qué país dibujar de fondo cuando el dato es a nivel ciudad, sin tener que
// mostrar el continente completo. Una ciudad que no aparezca acá simplemente
// no se dibuja en el mapa (sigue visible en la tabla de abajo).
export function normalizarUbicacion(texto) {
  return String(texto ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const CIUDADES = {
  lima: { lat: -12.0464, lon: -77.0428, pais: "Peru" },
  arequipa: { lat: -16.409, lon: -71.5375, pais: "Peru" },
  quito: { lat: -0.1807, lon: -78.4678, pais: "Ecuador" },
  guayaquil: { lat: -2.1894, lon: -79.8891, pais: "Ecuador" },
  cuenca: { lat: -2.9006, lon: -79.0045, pais: "Ecuador" },
  santiago: { lat: -33.4489, lon: -70.6693, pais: "Chile" },
  valparaiso: { lat: -33.0472, lon: -71.6127, pais: "Chile" },
  concepcion: { lat: -36.8201, lon: -73.0444, pais: "Chile" },
  "ciudad de mexico": { lat: 19.4326, lon: -99.1332, pais: "Mexico" },
  cdmx: { lat: 19.4326, lon: -99.1332, pais: "Mexico" },
  guadalajara: { lat: 20.6597, lon: -103.3496, pais: "Mexico" },
  monterrey: { lat: 25.6866, lon: -100.3161, pais: "Mexico" },
  bogota: { lat: 4.711, lon: -74.0721, pais: "Colombia" },
  medellin: { lat: 6.2442, lon: -75.5812, pais: "Colombia" },
  cali: { lat: 3.4516, lon: -76.532, pais: "Colombia" },
};

export function coordenadasDe(ubicacion) {
  return CIUDADES[normalizarUbicacion(ubicacion)] ?? null;
}
