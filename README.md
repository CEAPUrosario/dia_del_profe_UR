# 🎓 Día del Profesor — Universidad del Rosario

Página web estilo post-its con mensajes en **tiempo real**, likes persistentes y lista de profesores desde Google Sheets.

---

## 📁 Archivos

```
index.html   → estructura
style.css    → diseño y estilos
app.js       → lógica + Firebase + Google Sheets
```

---

## ✅ Checklist antes de publicar

- [ ] Firestore activado en Firebase (modo prueba)
- [ ] URL de Google Sheets pegada en `app.js`
- [ ] Reglas de Firestore actualizadas (ver abajo)
- [ ] Archivos subidos a GitHub
- [ ] GitHub Pages activado

---

## 🔥 Configurar Firestore (base de datos)

### Activar escritura pública (necesario para que funcione)

1. En Firebase, ve a **Bases de datos → Firestore Database → Reglas**
2. Reemplaza todo el contenido con esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /mensajes/{docId} {
      allow read: if true;
      allow create: if request.resource.data.texto is string
                    && request.resource.data.texto.size() < 1000;
      allow update: if request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['likes']);
    }
  }
}
```

> Estas reglas permiten leer y crear mensajes, y solo actualizar el campo `likes`. Nadie puede borrar ni editar el texto de un mensaje.

3. Haz clic en **Publicar**

---

## 🔗 Conectar Google Sheets

### Estructura del Sheet

| nombre | materia |
|--------|---------|
| Profesora García | Matemáticas |
| Profesor Martínez | Ciencias |

### Obtener la URL CSV

1. **Archivo → Compartir → Publicar en la web**
2. Elige la hoja → formato **CSV** → **Publicar**
3. Copia la URL

### Pegar en app.js

```js
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/XXXX/pub?output=csv';
```

---

## 🚀 Publicar en GitHub Pages

1. Crea un repositorio en [github.com](https://github.com), ej: `dia-del-profesor`
2. Sube los 3 archivos: `index.html`, `style.css`, `app.js`
3. Ve a **Settings → Pages → Source: main / (root) → Save**
4. Tu URL pública:
   ```
   https://tuusuario.github.io/dia-del-profesor
   ```

---

## 🎨 Colores post-it disponibles

`#fde87c` amarillo · `#ffb3c6` rosado · `#b5f0d3` menta · `#a8d8f8` azul · `#d4c5f9` lavanda · `#ffc9a8` durazno

---

> Hecho con ♥ por los estudiantes · Universidad del Rosario
