Título del Proyecto: Diseño de Interfaz y Flujo de Usuario para la Aplicación "Control de Stock" de "La Chacra Fútbol"
Descripción General:
Diseña una interfaz de usuario profesional, limpia y con un toque rústico-deportivo para una aplicación de gestión de stock. La app se llamará "Control de Stock" y está diseñada para un club deportivo y complejo llamado "La Chacra Fútbol". El diseño debe integrarse perfectamente con la identidad de marca establecida en los logos adjuntos (image_0.png y image_1.png).

I. Identidad Visual y Estética
1. Paleta de Colores Exclusiva:

Color Primario (Acciones/Navegación): Verde oscuro de image_1.png y image_0.png. Úsalo para botones principales, acentos de navegación, y encabezados destacados.

Color Secundario/Texto y Bordes: Gris/marrón oscuro de image_0.png. Úsalo para todo el texto principal y las líneas divisorias.

Fondo Principal: Blanco limpio o gris muy claro para áreas de tarjetas. El fondo general puede tener un tono beige muy sutil, recordando el estilo de "cojinete" del logo original.

2. Estética:

Tipografía: Limpia, moderna y de alta legibilidad (ej. Poppins, Montserrat). Sin embargo, para encabezados especiales, busca una variante que tenga detalles sutiles que recuerden el estilo texturizado de los logos originales.

Equilibrio: La interfaz debe ser funcional y profesional (estilo SAAS moderno), pero con texturas o detalles gráficos mínimos que refuercen la identidad rústica del lugar.

3. Integración de Marca:

El logo completo de "cojinete" (image_0.png) debe ser el elemento central de la pantalla de login y aparecer en la barra de navegación superior.

El isotipo circular de "LCH" (image_1.png) se usará como el avatar de usuario predeterminado y como un icono de sistema para elementos clave (ej. marcadores de historial).

II. Estructura y Navegación
Diseña un sistema de navegación lateral (sidebar) o inferior (para móvil) que incluya las siguientes secciones principales:

1. Dashboard (Resumen): Pantalla de inicio que muestra un resumen del stock total, acceso rápido a alertas semanales y un historial reciente de modificaciones.

2. Productos: Listado principal con CRUD y filtros.

3. Almacenes: Gestión CRUD de zonas y visualización de stock real por almacén.

4. Pedidos: Gestión completa de pedidos a proveedores (creación, pendientes y confirmación de arribo).

5. Reportes: Un apartado para visualizar el resumen de fecha, alertas semanales y el historial de modificaciones.

6. Configuración/Usuarios: Sección de gestión de usuarios y ajustes de la app.

III. Diseño Detallado por Módulo
1. Pantalla de Login (Módulo 1)
Muestra el logo image_0.png arriba del formulario, centrado.

Formulario simple con campos para "Usuario", "Contraseña".

Botón "Ingresar" con el color primario verde.

Enlace para "Olvidé mi contraseña".

2. Módulo "Productos" (Módulo 2)
Lista (CRUD): Tabla con columnas: Imagen del Producto (pequeña), Nombre, Categoría (opcional), Cantidad Total, Ubicación (Múltiples), Acciones (Ver/Editar/Eliminar).

Formulario Alta/Modificación (Modal): Pantalla modal o de detalle para Nombre, Código, Descripción, Imagen. Una sección crítica es "Stock por Almacén" donde se puede añadir una ubicación (warehouse) de una lista desplegable y especificar la cantidad en esa ubicación específica. (Un producto puede tener stock en múltiplos almacenes).

3. Módulo "Pedidos" (Módulo 3)
Este es el flujo más complejo. Diseña las siguientes pantallas interactivas:

Interfaz de Creación (Flujo Automatizado):

Paso 1 (Selectores): Un selector claro para "Tipo de Fecha: After / Regular" y un selector de período de tiempo (ej. últimos 3 meses) para calcular el promedio.

Paso 2 (Cálculo Sugerido): Una pantalla que muestra una tabla con la lista de productos necesarios, el "Uso Promedio Histórico" sugerido, el "Stock Actual" y una columna editable de "Cantidad Pedida" (que por defecto es la diferencia entre promedio y stock). Incluye un botón para "Actualizar con datos de fecha especial" y otro para "Armar pedido manualmente".

Confirmación y Descarga: Pantalla de resumen final del pedido con botón "Confirmar Pedido". Tras la confirmación, una pantalla que muestra un comprobante de pedido listo para descargar en formato PDF.

Visualización de Pedidos y Recepción:

Lista de Pedidos Pendientes: Tabla con ID, Fecha, Proveedor, Estado ("Enviado", "Confirmado"), Acciones.

Pantalla de Confirmación de Arribo: Al seleccionar "Confirmar Llegada Total", muestra una interfaz con la lista de productos pedidos. Cada producto tiene un campo de "Cantidad Pedida" (solo lectura) y un campo editable de "Cantidad Recibida" para que el usuario confirme cuántas unidades llegaron realmente (manejando productos de más o de menos). Botón "Confirmar Llegada". (Al confirmar, se deben actualizar las cantidades totales y las ubicaciones en los almacenes).

4. Módulo "Almacenes" (Módulo 4)
Lista (CRUD): Tabla con Nombre del Almacén, Ubicación, Capacidad, Cantidad total de productos. Botones de "Ver Detalles", "Modificar", "Eliminar".

Detalle del Almacén: Ver todos los productos presentes en ese almacén con sus cantidades a tiempo real, filtrables.

5. Módulo "Reportes" (Módulo 5, 6, 7 y 8)
Reporte 1: Resumen de Fecha (Consumo): Un input de fecha (calendario). Botón "Consultar". Muestra una tabla estilo excel con columnas: Producto, Cantidad Consumida en esa fecha, Almacén de procedencia.

Reporte 2: Alertas de Stock Faltante (Semanal): Un panel que se visualiza de forma destacada, especialmente antes de cada viernes, listando productos en riesgo. Debe mostrar visiblemente el cálculo utilizado: (Stock Actual + Pedidos Pendientes) < (Cálculo Promedio de Stock Semanal).

Reporte 3: Historial de Modificaciones (Auditoría): Tabla con columnas: Fecha y Hora, Usuario (isotipo image_1.png + Nombre), Acción ("Alta Producto", "Edición Stock Almacén X", "Confirmación Pedido X"), Producto/Elemento afectado, Cantidad Anterior, Cantidad Nueva (si aplica).

IV. Interacciones y Feedback
Estados: Diseña estados de error para login y confirmaciones fallidas. Estados de éxito para productos creados, pedidos confirmados y arribos de stock.

Modales: Usa ventanas emergentes (modales) para confirmaciones críticas (borrado), detalles de productos y la pantalla de cálculo de pedidos.

Integración de Marca:

Usa el isotipo circular image_1.png como avatar de usuario en la barra superior de la navegación y como el icono asociado a cada entrada del historial de modificaciones.

Utiliza el logo completo image_0.png en el login y en la barra superior de navegación como "Home" link.