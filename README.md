# Camp's · Inscripción de participantes

Landing de inscripción de **participantes** para el Camp's, el Campamento de jóvenes Shalom.
Cada inscripción se guarda en una Google Sheet de tu Drive y el comprobante de pago en una carpeta de Drive.
Es el mismo proyecto que [servidores](https://github.com/campsshalom/servidores), que se usa para los servidores, pero con su propia hoja y su propia carpeta.

```
index.html              ← la landing (formulario, paquete, datos de pago)
apps-script/Code.gs     ← el código que guarda en Google Drive
assets/                 ← portada, logo y paloma
```

Mientras la landing no esté conectada a Google, funciona en **modo de prueba**: se puede llenar y enviar, pero no guarda nada.

## 1. Conectar con Google Drive (una sola vez)

1. Entra a **https://script.google.com** → **Nuevo proyecto** → ponle de nombre `FormCamps2`. Tiene que ser un proyecto nuevo, no el de servidores.
2. Borra lo que trae `Código.gs`, pega todo [`apps-script/Code.gs`](apps-script/Code.gs) y guarda.
3. Elige la función **`setup`** → **Ejecutar** → acepta los permisos (**Configuración avanzada → Ir a FormCamps2 → Permitir**).
   Así se crean la hoja **"Inscripciones Participantes Camps"** y la carpeta **"Comprobantes de pago - Participantes Camps"**.
4. **Implementar → Nueva implementación → Aplicación web**. En *Ejecutar como* elige **Yo** y en *Quién tiene acceso*, **Cualquier persona**.
5. Copia la URL que termina en `/exec` y pégala en `index.html`, en `scriptUrl: ''`.

Si quieres un correo por cada inscripción, escribe tu correo en `NOTIFY_EMAIL` dentro de `Code.gs`.

## 2. Publicar (GitHub Pages)

**Settings → Pages → Deploy from a branch → main → / (root) → Save**.
Queda en `https://campsshalom.github.io/inscripcion/`.

## Datos que se ajustan en `index.html`

- **Fecha del campamento:** busca `data-fecha` (el texto que se muestra) y `fechaCampamento` en `CONFIG` (con formato AAAA-MM-DD, se usa para calcular la edad el día del campamento).
- **Precio y pagos:** sección *Paquete del campamento*.

## Cómo funciona el formulario

- **Obligatorios:** nombre, cédula o pasaporte, fecha de nacimiento, WhatsApp, autorización y forma de pago.
- Si la persona es **menor de 18 años**, aparecen los campos del responsable y pasan a ser obligatorios.
- Si la edad está fuera de **14 a 28 años**, se muestra un aviso, pero no se bloquea la inscripción.
- La hoja guarda la edad calculada y marca con "Sí" la columna **¿Documento repetido?** cuando un documento ya estaba inscrito.

## Avisos por Telegram

Cada inscripción manda un mensaje a un grupo de Telegram con lo básico: nombre, forma de pago, si subió comprobante y el total de inscritos. Los datos de salud y los contactos se quedan solo en la hoja.

1. En Telegram, abre **@BotFather** → `/newbot` → ponle un nombre (por ejemplo "Avisos Camps") y un usuario que termine en `bot`. Copia el **token** que te da.
2. Crea un grupo (por ejemplo "Equipo Camp's 2027"), agrega el bot y escribe `/start` en el grupo.
3. En Apps Script, pega el token en `TELEGRAM_TOKEN: ''` dentro de `SETTINGS`. **No subas el token a GitHub.**
4. Elige la función **`configurarTelegram`** → **Ejecutar** → acepta el permiso nuevo ("conectarse a un servicio externo"). Debe llegar un mensaje de prueba al grupo.
5. **Implementar → Gestionar implementaciones → lápiz → Versión: Nueva versión → Implementar.** La URL no cambia.

Si Telegram falla, la inscripción se guarda igual; el error queda en **Ejecuciones** de Apps Script.
