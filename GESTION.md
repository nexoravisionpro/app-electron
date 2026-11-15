# Core Point 1.0.3-crm.4 · Operación conectada

Conserva los módulos de la entrega anterior y agrega un Centro de gestión accesible desde el menú lateral. También hay accesos desde inventario, CRM, gastos, cotizaciones, empleados, caja y reportes.

## Funciones incorporadas

- **Proveedores:** directorio, contacto, teléfono, correo, RFC, domicilio, condiciones y notas. Se pueden archivar conservando compras anteriores.
- **Compras:** borradores con productos, cantidades de hasta tres decimales, costo, descuento, impuesto, almacén, fecha prevista, lotes, caducidad y códigos individuales nuevos. Confirmar una orden no la envía al proveedor ni realiza un pago. La orden se puede descargar en PDF con membrete del negocio.
- **Recepción de mercancía:** confirma la recepción completa y actualiza existencias, cantidad compatible del catálogo, lotes, costo promedio y kardex en una transacción. El costo promedio excluye el impuesto y considera el descuento. Una diferencia previa entre catálogo y almacenes debe conciliarse antes de recibir. Los reintentos no duplican la entrada. No incluye recepciones parciales en esta entrega.
- **Inventario:** activa los ajustes y transferencias con referencia única que la interfaz anterior ya utilizaba. Permite conciliar la cantidad del catálogo con los almacenes aunque las cantidades físicas no cambien. La eliminación de almacenes vacíos conserva los movimientos e impide eliminar el último almacén.
- **Reposición:** considera mínimos, punto de reorden, máximos, seguridad y mercancía de órdenes pendientes. Prepara una compra para revisar proveedor, almacén, cantidades y costos antes de guardarla.
- **Cuentas por cobrar y pagar:** registro de deuda real con documento, vencimiento y vínculo opcional a venta o compra recibida. Una compra recibida puede generar una cuenta por su importe completo, evitando cuentas abiertas duplicadas para esa referencia. Incluye saldos y antigüedad: sin vencer, 1–30, 31–60, 61–90 y más de 90 días.
- **Abonos:** no permite superar el saldo. Los abonos por pagar generan un gasto vinculado con su categoría. Los abonos por cobrar no vuelven a generar una venta. Se pueden anular con motivo; se conserva el historial y se retira el gasto administrativo asociado al abono anulado. No realiza cargos, transferencias ni movimientos automáticos de caja. No vuelvas a registrar los mismos pagos manualmente en Gastos.
- **Posventa y soporte:** casos de garantía, entrega, instalación, queja o soporte con cliente, venta opcional, responsable, prioridad, fecha objetivo y bitácora. Resolver exige describir la solución. Permite preparar una cita de seguimiento; el usuario debe guardarla.
- **Metas y presupuestos:** objetivos mensuales de venta neta y gastos pagados, comparados con registros reales. El resumen muestra compromisos vencidos, compras retrasadas y casos prioritarios. No representa utilidad contable ni saldo bancario.
- **Documentos y control:** estados de cuenta y órdenes de compra en PDF, exportación de las filas filtradas a Excel/PDF, búsquedas, filtros, paginación y registro de cambios.

## Confirmaciones y datos

Las operaciones nuevas pasan por una puerta de entrada autenticada con comprobación de propietario, referencia única y registro del resultado. Una respuesta de red incierta se conserva como operación pendiente por cuenta: se revisa o reintenta con los mismos datos antes de registrar otra. Un cambio de sesión impide aplicar el resultado a la pantalla de otro negocio. Las ediciones de proveedores, compras y casos comprueban la revisión esperada.

Las tablas nuevas permiten lectura únicamente al propietario. Las escrituras se realizan mediante funciones que validan las relaciones y ejecutan el movimiento completo. Los puestos locales siguen siendo controles de interfaz; no equivalen a identidades independientes de servidor. La bitácora distingue la cuenta del negocio de la etiqueta del operador.

Los importes de cuentas manuales deben representar deuda pendiente real. Crear una cuenta no transforma una venta ya pagada en una venta a crédito ni corrige automáticamente su caja. Las devoluciones posteriores requieren revisar el saldo administrativo correspondiente. Los dispositivos con versiones antiguas pueden seguir utilizando escrituras de inventario anteriores: deben actualizarse y conciliarse antes de operar simultáneamente.

## Verificación

- `tests/management-db.cjs`: PostgreSQL aislado. Prueba revisión de órdenes, recepción revertida ante error, recepción única, kardex, abonos únicos, saldo insuficiente, gastos protegidos, anulación, posventa, metas, transferencias, aislamiento y cambio de cuenta/token.
- `tests/management-dom.cjs`: formularios y lógica reales con servicios simulados. Prueba datos enviados, recuperación de respuesta incierta, ausencia de proveedor duplicado, escape de contenido, cantidad fraccionaria, reinicio de formularios y cambio de sesión durante una operación.
- `tests/management-live-rollback.sql`: comprobación en el proyecto real con todos los datos de prueba revertidos.
- `tests/management-pdf.cjs`: orden de compra y estado de cuenta de muestra, incluyendo cantidades de tres decimales. Se revisó su renderizado.
- Se conservan las comprobaciones anteriores de empleados, cotizaciones, agenda, gastos y reportes.
- Los instaladores verifican contenido, arranque y guardado de un PDF a través del puente real del proceso de escritorio, sustituyendo únicamente la selección de carpeta durante la prueba.

Las migraciones documentan los cambios aplicados al proyecto y no deben repetirse a ciegas. Los instaladores son de revisión; falta la prueba operativa completa en los dispositivos del negocio. Windows no tiene certificado de editor y Mac conserva firma ad hoc sin notarización Apple. No se contrataron servicios nuevos.
