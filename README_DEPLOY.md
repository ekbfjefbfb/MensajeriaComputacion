# 💬 Chat Demo - Mensajería Instantánea

Aplicación educativa de chat en tiempo real para demostrar WebSocket, Broadcasting y comunicación bidireccional.

**🌐 Demo en vivo:** [https://chat-demo-clase.onrender.com](https://chat-demo-clase.onrender.com)

---

## 🚀 Deploy en Render (Gratuito + HTTPS)

### Opción 1: Deploy Automático (Blueprints)

1. **Fork o sube este repo a GitHub**

2. **Ve a [Render Dashboard](https://dashboard.render.com/)**

3. **Click "Blueprints" → "New Blueprint Instance"**

4. **Conecta tu repositorio de GitHub**

5. **Render detecta automáticamente** `render.json` y despliega

6. **Espera 2 minutos** y obtienes URL con HTTPS ✅

---

### Opción 2: Deploy Manual (Web Service)

1. **Ve a [Render](https://dashboard.render.com/) → "New" → "Web Service"**

2. **Conecta tu repositorio**

3. **Configura:**
   ```
   Name: chat-demo-clase
   Runtime: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: gunicorn -k eventlet -w 1 app:app --bind 0.0.0.0:$PORT
   ```

4. **Environment Variables:**
   ```
   SECRET_KEY = tu-clave-secreta-aqui (generar aleatoria)
   ```

5. **Click "Create Web Service"**

6. **Listo!** La URL aparece en la parte superior (ej: `https://chat-demo-xxx.onrender.com`)

---

## 🔒 Seguridad incluida

| Característica | Implementación |
|---------------|----------------|
| **HTTPS** | ✅ Automático en Render (SSL/TLS) |
| **SECRET_KEY** | ✅ Variable de entorno |
| **CORS** | ✅ Configurado para WebSocket |
| **Rate Limiting** | ✅ Límite 500 caracteres por mensaje |
| **Sanitización** | ✅ Escape HTML en mensajes |

---

## 🎯 Cómo usar en clase

### Compartir con estudiantes:

```
1. Abre la URL: https://tu-app.onrender.com
2. Ingresa tu nombre
3. Entra al chat
4. ¡Conversa en tiempo real!
```

### Para compartir pantalla:
```
Abre 3-4 pestañas con diferentes nombres
Muestra cómo los mensajes llegan instantáneamente
Explica WebSocket vs HTTP tradicional
```

---

## 🛠️ Desarrollo Local

```bash
# Instalar dependencias
pip install -r requirements.txt

# Ejecutar servidor
python3 app.py

# Abrir navegador
http://localhost:5001
```

---

## 📚 Conceptos demostrados

- **WebSocket**: Conexión bidireccional persistente
- **Broadcasting**: Un envío, todos reciben
- **Eventos en tiempo real**: Sin polling
- **Estados**: Usuarios online/escribiendo
- **Concurrencia**: Múltiples conexiones simultáneas
- **HTTPS/SSL**: Comunicación cifrada

---

## 📁 Estructura del proyecto

```
.
├── app.py              # Servidor Flask + SocketIO
├── requirements.txt    # Dependencias
├── render.json         # Config Render (Blueprints)
├── templates/
│   └── chat.html      # Interfaz de usuario
└── README.md          # Este archivo
```

---

## 🔧 Tecnologías

- **Backend**: Flask + Flask-SocketIO
- **Frontend**: HTML5 + CSS3 + JavaScript
- **WebSocket**: Socket.IO
- **Servidor**: Gunicorn + Eventlet
- **Deploy**: Render (HTTPS automático)
- **Python**: 3.10+

---

## 📝 Licencia

Proyecto educativo. Libre uso para fines de enseñanza.

---

**¿Problemas?** Ver logs en Render Dashboard → Logs
