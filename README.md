# FormCamps2

Landing de inscripción de **participantes** para el Camp's, el Campamento de jóvenes Shalom.
Cada inscripción se guarda en una Google Sheet de tu Drive y el comprobante de pago en una carpeta de Drive.
Es el mismo proyecto que [FormCamps](https://github.com/yinoxavier/FormCamps), que se usa para los servidores, pero con su propia hoja y su propia carpeta.

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
Queda en `https://yinoxavier.github.io/FormCamps2/`.

## Datos que se ajustan en `index.html`

- **Fecha del campamento:** busca `data-fecha` (el texto que se muestra) y `fechaCampamento` en `CONFIG` (con formato AAAA-MM-DD, se usa para calcular la edad el día del campamento).
- **Precio y pagos:** sección *Paquete del campamento*.

## Cómo funciona el formulario

- **Obligatorios:** nombre, cédula o pasaporte, fecha de nacimiento, WhatsApp, autorización y forma de pago.
- Si la persona es **menor de 18 años**, aparecen los campos del responsable y pasan a ser obligatorios.
- Si la edad está fuera de **14 a 28 años**, se muestra un aviso, pero no se bloquea la inscripción.
- La hoja guarda la edad calculada y marca con "Sí" la columna **¿Documento repetido?** cuando un documento ya estaba inscrito.
