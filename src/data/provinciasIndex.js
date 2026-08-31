// Provincias por país para la pestaña Geo (GeoMap.jsx) -- mismo mecanismo de
// coincidencia por nombre que ya se usa para países (comparando contra el
// propio topojson, ver cargarTopologiaMundo en GeoMap.jsx) y ciudades
// (geoCoordenadas.js), pero a nivel subnacional. El Sheet trae valores como
// "Provincia de Guayas" o "Provincia del Azuay" (a veces el nombre pelado,
// ver el canal YouTube de Granasa) -- para cada provincia se registran varias
// claves normalizadas ("provincia de <nombre>", "provincia del <nombre>" y el
// nombre pelado) para que cualquiera de esas formas matchee.
//
// Agregar un país nuevo cuando llegue un cliente con datos a nivel provincia/
// departamento/estado: sumar su topojson en este mismo directorio
// (properties.name = nombre a mostrar, ver src/data/provincias/ecuador.json
// como ejemplo de formato -- generado con mapshaper a partir de geoBoundaries
// ADM1, CC0) y una entrada en CARGADORES con el nombre EXACTO de Natural
// Earth/world-atlas (el mismo que usa GeoMap.jsx para dibujar países), para
// poder cargarlo dinámicamente solo cuando la pestaña Geo lo necesita.
import { feature } from "topojson-client";
import { normalizarUbicacion } from "./geoCoordenadas";

const CARGADORES = {
  Ecuador: () => import("./provincias/ecuador.json"),
};

export const PAISES_CON_PROVINCIAS = Object.keys(CARGADORES);

// Casos donde el texto del Sheet no calza ni con "provincia de/del <nombre>"
// ni con el nombre pelado -- compuestos con guión (Morona-Santiago), formas
// abreviadas de un nombre oficial largo (Francisco de Orellana -> Orellana)
// o un alias corto de uso común (Santo Domingo, sin "de los Tsáchilas").
const ALIAS_EXTRA = {
  "provincia de morona-santiago": "Morona Santiago",
  "morona-santiago": "Morona Santiago",
  "provincia de zamora-chinchipe": "Zamora Chinchipe",
  "zamora-chinchipe": "Zamora Chinchipe",
  "provincia de francisco de orellana": "Orellana",
  "francisco de orellana": "Orellana",
  "provincia de santo domingo": "Santo Domingo de los Tsáchilas",
  "santo domingo": "Santo Domingo de los Tsáchilas",
};

const cache = new Map(); // país -> Map(clave normalizada -> feature GeoJSON)

export async function indiceProvinciasDe(pais) {
  if (cache.has(pais)) return cache.get(pais);
  const cargador = CARGADORES[pais];
  if (!cargador) return null;

  const mod = await cargador();
  const topologia = mod.default ?? mod;
  const objectKey = Object.keys(topologia.objects)[0];
  const coleccion = feature(topologia, topologia.objects[objectKey]);

  const indice = new Map();
  for (const f of coleccion.features) {
    const base = normalizarUbicacion(f.properties.name);
    indice.set(`provincia de ${base}`, f);
    indice.set(`provincia del ${base}`, f);
    indice.set(base, f);
  }
  for (const [alias, nombreProvincia] of Object.entries(ALIAS_EXTRA)) {
    const destino = coleccion.features.find((f) => f.properties.name === nombreProvincia);
    if (destino) indice.set(alias, destino);
  }

  cache.set(pais, indice);
  return indice;
}
