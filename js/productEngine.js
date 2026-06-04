import { setProductoFinal } from './state.js';
import { generarCopyDesdeProducto } from './conversionEngine.js';

export async function generarProducto(productoInput) {
  const productoFinal = await generarCopyDesdeProducto(productoInput);
  setProductoFinal(productoFinal);
  return productoFinal;
}

export function asignarProductoFinal(producto) {
  setProductoFinal(producto);
}
