


async function generarProducto(productoInput) {
  const productoFinal = await generarCopyDesdeProducto(productoInput);
  setProductoFinal(productoFinal);
  return productoFinal;
}

function asignarProductoFinal(producto) {
  setProductoFinal(producto);
}


// Exposición global
window.generarProducto = generarProducto;
window.asignarProductoFinal = asignarProductoFinal;
