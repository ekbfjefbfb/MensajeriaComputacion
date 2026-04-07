# 💬 Mensajería Instantánea - Demo Computación

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0.0-green.svg)](https://flask.palletsprojects.com)
[![SocketIO](https://img.shields.io/badge/Socket.IO-Real--time-orange.svg)](https://socket.io)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Aplicación educativa de chat en tiempo real para demostrar conceptos de:
- **WebSocket** - Comunicación bidireccional persistente
- **Broadcasting** - Mensajes a múltiples clientes simultáneamente
- **Estados de conexión** - Usuarios online/escribiendo
- **Fotos de perfil** - Avatares personalizados en Base64

![Chat Demo](https://via.placeholder.com/800x400/075E54/FFFFFF?text=Chat+Demo+WhatsApp+Style)

## 🚀 Demo en Vivo

👉 **[Ver demo en Render](https://mensajeria-computacion.onrender.com)** (Próximamente)

## 📋 Características

| Característica | Descripción |
|----------------|-------------|
| 💬 **Mensajes en tiempo real** | WebSocket con Socket.IO |
| 👤 **Fotos de perfil** | Subida de imágenes Base64 |
| 🎨 **Diseño WhatsApp** | Interfaz familiar para usuarios |
| 📱 **Responsive** | Funciona en móvil y desktop |
| 🔒 **HTTPS/SSL** | Conexión cifrada segura |
| 👥 **Múltiples usuarios** | Chat grupal ilimitado |
| ✏️ **Indicador de escritura** | "Está escribiendo..." en tiempo real |
| 🟢 **Lista de usuarios** | Quién está online alfabéticamente |

## 🛠️ Tecnologías

### Backend
- **Flask** - Framework web Python
- **Flask-SocketIO** - WebSocket para comunicación en tiempo real
- **Gunicorn** - Servidor WSGI para producción

### Frontend
- **HTML5** - Estructura semántica
- **CSS3** - Diseño responsive tipo WhatsApp
- **JavaScript** - Lógica del cliente
- **Socket.IO Client** - Conexión WebSocket

### Infraestructura
- **Render.com** - Hosting con HTTPS automático
- **GitHub** - Control de versiones

## 📦 Instalación Local

### Requisitos
- Python 3.10+
- pip

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/ekbfjefbfb/MensajeriaComputacion.git
cd MensajeriaComputacion

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Ejecutar servidor
python3 app.py

# 4. Abrir navegador
http://localhost:5001
```

## 🚀 Deploy en Render

### Opción 1: Blueprint (Automático)
1. Conecta tu repositorio de GitHub en [Render Dashboard](https://dashboard.render.com/)
2. Render detecta automáticamente `render.yaml`
3. Click "Create Web Service"

### Opción 2: Manual
```
Name: mensajeria-computacion
Runtime: Python 3
Build Command: pip install -r requirements.txt
Start Command: gunicorn -k threading -w 1 app:app --bind 0.0.0.0:$PORT
```

## 📁 Estructura del Proyecto

```
MensajeriaComputacion/
├── app.py                 # Servidor Flask + SocketIO
├── requirements.txt       # Dependencias Python
├── render.yaml           # Configuración Render
├── .gitignore           # Archivos ignorados por Git
├── README.md            # Este archivo
├── LICENSE              # Licencia MIT
└── templates/
    └── chat.html        # Interfaz de usuario
```

## 🎯 Uso en Clase

### Para el Profesor
1. Deploy la aplicación en Render (obtienes URL HTTPS)
2. Comparte la URL con los estudiantes
3. Proyecta tu pantalla mostrando el código (`app.py`, `chat.html`)
4. Explica los conceptos mientras los estudiantes chatean

### Para Estudiantes
1. Entran a la URL proporcionada
2. **Suben su foto de perfil** (clic en el círculo 📷)
3. **Escriben su nombre**
4. Click "Entrar al Chat"
5. ¡Conversan en tiempo real!

## 📚 Conceptos Demostrados

### 1. WebSocket vs HTTP
```
HTTP:   Cliente → Solicita → Servidor → Responde → Fin
WebSocket: Cliente ⟷══════════════════════⟷ Servidor
                 (Conexión persistente, bidireccional)
```

### 2. Broadcasting
```
Usuario A envía mensaje
         ↓
    Servidor recibe
         ↓
    Broadcast → Usuario A (eco local)
              → Usuario B (remoto)
              → Usuario C (remoto)
```

### 3. Eventos Socket.IO
| Evento | Descripción |
|--------|-------------|
| `connect` | Cliente conecta |
| `registrar_usuario` | Enviar nombre y avatar |
| `mensaje` | Enviar mensaje de chat |
| `escribiendo` | Indicador de escritura |
| `disconnect` | Cliente desconecta |

## 🔒 Seguridad

- ✅ **HTTPS automático** en Render
- ✅ **SECRET_KEY** en variables de entorno
- ✅ **Validación de archivos** (máx 2MB, imágenes only)
- ✅ **Sanitización HTML** (previene XSS)
- ✅ **Límite de mensajes** (500 caracteres)

## 🐛 Solución de Problemas

### Error "Port already in use"
```bash
fuser -k 5001/tcp  # Linux/Mac
# o cambia el puerto en app.py
```

### WebSocket no conecta
- Verificar que el servidor esté corriendo
- Verificar que no haya firewall bloqueando el puerto
- En producción: usar HTTPS (no HTTP)

## 🤝 Contribuir

1. Fork el repositorio
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está licenciado bajo [MIT License](LICENSE) - libre uso para fines educativos.

## 👨‍🏫 Autor

**Profesor de Computación** - Demo para clase de comunicaciones

---

💡 **Tip**: Para demo en clase, abre 3-4 pestañas con diferentes nombres/fotos y muestra cómo los mensajes llegan instantáneamente a todos.

🎓 **Conceptos clave**: WebSocket, Broadcasting, Comunicación Bidireccional, Estados de Conexión, Base64 Avatares.
