# Instaladores de revisión

Esta configuración genera Windows x64, macOS Intel x64 y macOS Apple Silicon arm64 desde `Facture01.html`.

Los instaladores se adjuntan a un borrador de Release, sin publicar una versión estable ni activar actualizaciones de clientes. Cada archivo tiene su SHA-256 y reportes de contenido y arranque. No hay certificado de editor para Windows ni Developer ID/notarización para Mac; macOS usa firma local ad hoc. El sistema puede solicitar autorización para abrirlos.

El empaquetado conserva el identificador de Core Point y verifica que el HTML del paquete coincida con el del repositorio. Las pruebas de arranque usan un perfil temporal sin sesión. No certifican ventas, inventario, impresión ni los cambios pendientes del servidor; esta versión sigue siendo de revisión.

Compilación local: `npm ci`, `npm run check:source`, y `npx electron-builder --win nsis --x64 --publish never` en Windows; en Mac, `npx electron-builder --mac dmg --x64 --publish never` o `--arm64` según el procesador. Las dependencias nativas se compilan en la plataforma y arquitectura correspondientes.
