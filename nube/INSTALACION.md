# Solaris Math: instalación de la nube en Google Sheets

Tiempo aproximado: 15 minutos. Hazlo desde un computador, porque Apps Script no funciona bien en el celular.

Necesitas:

- Tu cuenta de Google (o la del colegio).
- El archivo **Code.gs**.
- El archivo **index.html**.

---

## Paso 1. Crear la hoja de cálculo

1. Abre **sheets.new** en el navegador. Se crea una hoja en blanco.
2. Ponle un nombre, por ejemplo **Solaris Math – Base de datos**.

## Paso 2. Pegar y preparar el script

1. En la hoja, entra a **Extensiones → Apps Script**.
2. Borra todo lo que aparece en el editor.
3. Abre **Code.gs**, copia todo su contenido y pégalo en el editor.
4. Guarda con el ícono del disquete.
5. En la barra de arriba, en el selector de funciones, elige **configurar**.
6. Presiona **Ejecutar**.
7. Google pedirá permisos:
   - Elige tu cuenta.
   - Si aparece "Google no ha verificado esta app", presiona **Configuración avanzada** y luego **Ir a … (no seguro)**. Es normal: el script es tuyo y solo usa tu hoja.
   - Presiona **Permitir**.
8. Vuelve a la hoja. Deben aparecer las pestañas **Panel, Estudiantes, Progreso, Intentos y Diplomas**.

## Paso 3. Publicar el script como aplicación web

1. En Apps Script, presiona **Implementar → Nueva implementación**.
2. Haz clic en el engranaje ⚙️ y elige **Aplicación web**.
3. Configura:
   - **Descripción:** Solaris Math
   - **Ejecutar como:** Yo
   - **Quién tiene acceso:** Cualquier usuario
4. Presiona **Implementar**.
5. Copia la **URL de la aplicación web**. Termina en `/exec`.

**Prueba rápida:** pega esa URL en una pestaña nueva. Debe mostrar algo como:

```
{"ok":true,"app":"Solaris Math","mensaje":"Servidor activo"}
```

## Paso 4. Conectar la app

1. Abre **index.html** con un editor de texto. En GitHub también puedes: abre el archivo y toca el lápiz ✏️.
2. Busca esta línea, que está al comienzo del código:

   ```js
   const NUBE_URL = '';
   ```

3. Pega tu URL entre las comillas:

   ```js
   const NUBE_URL = 'https://script.google.com/macros/s/AKfy..../exec';
   ```

4. Guarda y sube el archivo a GitHub.

Listo. Al abrir la app, el registro pedirá **apodo + PIN** y aparecerá la opción **"¿Ya tienes perfil?"**.

---

## Uso diario para el profesor

Al abrir la hoja aparece el menú **Solaris Math**. Si no lo ves, recarga la página.

| Opción | Para qué sirve |
|---|---|
| **Actualizar panel** | Llena la pestaña *Panel* con el total de estudiantes, los activos en la última semana, los ejercicios resueltos, los diplomas y los temas ordenados del más difícil al más fácil. |
| **Restablecer PIN del estudiante seleccionado** | Para cuando un estudiante olvida su PIN. Selecciona su fila en *Estudiantes* y escribe el PIN nuevo. Sus sesiones abiertas se cierran. |
| **Configurar hojas** | Vuelve a preparar las pestañas si algo se desordenó. No borra datos. |

**Qué muestra cada pestaña:**

- **Estudiantes:** una fila por estudiante, con su apodo, grado, temas aprobados, temas validados, promedio (sobre 10), grado alcanzado en la prueba de ubicación y última conexión.
- **Progreso:** la mejor nota de cada estudiante en cada tema y su estado (Aprobado, En proceso o Validado en prueba).
- **Intentos:** cada vez que un estudiante termina un tema, con fecha y nota sobre 15.
- **Diplomas:** los diplomas emitidos y su código.

Puedes usar filtros, gráficos o descargar en Excel (**Archivo → Descargar**).

## Verificar un diploma

Cada diploma trae un código como `CN-1A2B3C4D`. En la pantalla del diploma, la app muestra un enlace **"verificar diploma"**. Cualquier persona que lo abra ve si el código es válido, a nombre de quién está y su fecha.

## Seguridad

- **PIN:** nunca se guarda tal cual. Se guarda cifrado (hash SHA-256 con sal).
- **Intentos fallidos:** después de 5 intentos con PIN equivocado, el perfil se bloquea 15 minutos.
- **PIN fáciles:** la app no acepta PIN como 1111 o 1234.
- **Sesiones:** cada estudiante puede tener hasta 5 abiertas, por ejemplo celular, tablet y computador.
- **Columnas técnicas:** en *Estudiantes* están ocultas y no deben editarse (PIN cifrado, sesiones, avance completo).
- **Privacidad:** no compartas la hoja con estudiantes, porque contiene los datos de todos. Compártela solo con otros profesores.

## Si cambias el código más adelante

Para que la URL no cambie:

1. Entra a **Implementar → Gestionar implementaciones**.
2. Presiona el lápiz ✏️.
3. En **Versión**, elige **Nueva versión**.
4. Presiona **Implementar**.

Si creas una implementación nueva, la URL cambia y tendrías que actualizar `index.html`.

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| La app dice "No hay conexión con el servidor" | Revisa que la URL en `index.html` sea la correcta y termine en `/exec`, y que el acceso esté en **Cualquier usuario**. |
| No aparece el menú Solaris Math | Recarga la hoja. Si sigue sin aparecer, ejecuta **configurar** otra vez desde Apps Script. |
| Un estudiante dice "Tu sesión se cerró" | Su PIN fue restablecido. Debe entrar con el PIN nuevo. |
| Un estudiante quedó bloqueado | Espera 15 minutos o restablece su PIN. |

## Límites de Google

Google limita cuántas veces al día puede ejecutarse un script y cuántas conexiones atiende al mismo tiempo. Para un colegio es más que suficiente, porque la app solo guarda cuando un estudiante termina un tema. Si en el futuro la usaran miles de estudiantes a la vez, convendría pasar a una base de datos como Supabase.
