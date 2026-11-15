# Core Point 1.0.3-crm.3

Esta entrega amplía empleados, cotizaciones, agenda, gastos y reportes en la aplicación de escritorio original. Conserva los datos anteriores. No introduce servicios de pago.

- Personal: expediente laboral, número único por negocio, departamento, contacto de emergencia, ingreso/baja, contrato, directorio con búsqueda y filtros. Asistencias, faltas, retardos, vacaciones, permisos e incapacidades se registran manualmente con fecha y motivo. No cambian automáticamente el salario.
- Pagos de personal: registro administrativo por periodo. Cada pago genera un gasto vinculado en una transacción. Reintentar la misma solicitud no duplica el pago. Se bloquean periodos cruzados y la edición/eliminación directa de esos gastos. Los importes históricos no se asignan a empleados por coincidencia de nombre. No calcula obligaciones fiscales ni emite CFDI.
- Cotizaciones: partidas, cantidad, precio, descuento, impuesto configurable, datos del cliente y condiciones. Monto y desglose se comprueban también en la base. PDF con nombre, domicilio, RFC y teléfono del negocio configurado, folio, vigencia y páginas. El nombre y datos del negocio se conservan con la propuesta. Duplicación, aceptación/rechazo y preparación de venta; preparar no equivale a cobrar.
- Agenda: calendario mensual y lista, búsquedas, estados, responsable, duración, ubicación y tipo. Aviso por solapamiento de horarios del mismo responsable, incluso después de medianoche. Exportación iCalendar para importar a la agenda del celular. WhatsApp abre un mensaje para revisión del usuario; no envía por sí solo.
- Gastos: pagados y pendientes, vencimiento, fecha/método de pago, comprobante y centro de costo. Filtros, saldos de la vista y exportación. Registrar un gasto no realiza una transferencia bancaria.
- Reportes: ventas POS y tickets unidos solo por su vínculo exacto. Excluye cancelaciones y descuenta devoluciones. Rangos de fechas, búsqueda, paginación, clientes, unidades por SKU, gastos y exportación Excel/PDF de las filas filtradas. Los reportes por SKU solo incluyen partidas guardadas. El balance administrativo no es utilidad contable ni saldo de caja. Las devoluciones se atribuyen a la fecha de la venta original. El PDF admite hasta 10,000 filas.

## Validación

`tests/business-math.cjs`: cálculos, vínculos, devoluciones y horarios.

`tests/operations-dom.cjs`: formularios y lógica reales con servicios simulados; comprueba los datos enviados, filtros, escape de contenido y limpieza de sesión.

`tests/operations-db.cjs`: PostgreSQL local aislado; RLS entre cuentas, total de partidas, movimientos, pagos, reintentos y bloqueo de gastos vinculados.

`tests/operations-live-rollback.sql`: comprobación en el proyecto real dentro de una transacción revertida. Pasó sin conservar los registros de prueba.

`tests/pdf-documents.cjs`: documentos de ejemplo, cotización extensa y rechazo de totales inconsistentes. Se revisó el renderizado y la integridad del contenido multipágina.

Los instaladores se construyen en Windows, Mac Intel y Mac Apple Silicon. Se verifica que los archivos empaquetados coincidan, que la aplicación arranque y que genere un PDF desde el paquete. Son entregas para revisión; esta validación no sustituye una operación comercial completa en los dispositivos del negocio. Windows no tiene certificado de editor; Mac usa firma ad hoc sin notarización Apple.

## Base de datos

Los archivos de `migrations/` documentan los cambios ya aplicados al proyecto. No ejecutarlos de nuevo a ciegas: varias creaciones son deliberadamente no idempotentes. Los nuevos datos mantienen aislamiento por propietario. Los puestos locales de la app no crean identidades de servidor independientes.
