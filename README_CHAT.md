# 💬 Demo: Mensajería Instantánea

Aplicación educativa para demostrar los conceptos fundamentales de la mensajería instantánea en una clase de computación.

---

## 🎯 Conceptos que Demuestra

| Concepto | Descripción | Implementación |
|----------|-------------|----------------|
| **WebSocket** | Protocolo de comunicación bidireccional persistente | `SocketIO` mantiene conexión abierta |
| **Broadcasting** | Envío de mensajes a múltiples clientes | `emit(..., broadcast=True)` |
| **Tiempo Real** | Entrega instantánea sin polling | Eventos disparados desde servidor |
| **Estados** | Seguimiento de usuarios online/escribiendo | Variables en memoria + eventos |
| **Concurrencia** | Múltiples conexiones simultáneas | Hilos manejados por Flask-SocketIO |

---

## 🚀 Cómo Ejecutar

### 1. Instalar dependencias

```bash
pip install flask flask-socketio
```

### 2. Iniciar el servidor

```bash
python app.py
```

### 3. Abrir en navegador

Abre múltiples pestañas en:
```
http://localhost:5000
```

---

## 🏗️ Arquitectura

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│   Cliente 1     │◄──────────────────►│                 │
│  (Navegador)    │                    │    Servidor     │
└─────────────────┘                    │   Flask-SIO     │
                                       │                 │
┌─────────────────┐     WebSocket      │  • Broadcasting │
│   Cliente 2     │◄──────────────────►│  • Estado Users │
│  (Navegador)    │                    │  • Eventos RT   │
└─────────────────┘                    └─────────────────┘
```

---

## 📡 Flujo de Mensajes

```
Usuario escribe mensaje
         ↓
    [WebSocket]
         ↓
    Servidor recibe
         ↓
    [Broadcast]
         ↓
┌────────┴────────┐
↓                 ↓
Cliente 1      Cliente 2
(muestra msg)  (muestra msg)
```

---

## 🔧 Archivos

| Archivo | Propósito |
|---------|-----------|
| `app.py` | Servidor WebSocket con Flask-SocketIO |
| `templates/chat.html` | Interfaz web completa con CSS/JS |
| `service.py` | Versión básica TCP (socket tradicional) |
| `cliente.py` | Cliente terminal (versión legacy) |

---

## 📝 Para la Demostración en Clase

### Paso 1: Explicar WebSocket vs HTTP
```
HTTP:    Cliente → Solicita → Servidor → Responde → Fin ❌
WebSocket: Cliente ⟷ Conexión persistente ⟷ Servidor ✓
                (mensajes en ambas direcciones)
```

### Paso 2: Mostrar Broadcasting
1. Abre 3 navegadores con nombres diferentes
2. Envía mensaje desde uno
3. Muestra cómo llega a todos instantáneamente

### Paso 3: Demostrar Estados
- Observa el indicador "✏️ Usuario está escribiendo..."
- Muestra lista de usuarios conectados
- Cierra una pestaña y muestra notificación de salida

### Paso 4: Explicar Ventajas
- ✅ Baja latencia (< 100ms)
- ✅ Menor consumo de recursos (sin polling)
- ✅ Push nativo (servidor puede iniciar)

---

## 🎨 Características Visuales

- Interfaz tipo WhatsApp para familiaridad
- Colores únicos por usuario
- Timestamps en mensajes
- Indicador "escribiendo..."
- Lista de usuarios online
- Notificaciones de entrada/salida
- Diseño responsivo

---

## 🔍 Código Clave

### Broadcasting (app.py:42-50)
```python
emit('nuevo_mensaje', {
    'nombre': nombre,
    'mensaje': mensaje,
    'hora': obtener_hora()
}, broadcast=True)  # ← Envía a TODOS los clientes
```

### WebSocket Cliente (chat.html:225-235)
```javascript
const socket = io();  // ← Conexión persistente
socket.on('nuevo_mensaje', (data) => {
    mostrarMensaje(data);  // ← Llega en tiempo real
});
```

---

## 📚 Recursos para Estudiantes

**WebSocket**: Protocolo en capa de aplicación que proporciona comunicación bidireccional sobre una conexión TCP persistente.

**Socket.IO**: Biblioteca que facilita WebSocket con fallbacks para navegadores antiguos.

**Broadcasting**: Patrón donde un mensaje enviado por un cliente es retransmitido por el servidor a todos los demás clientes conectados.

---

**Demo lista para la clase! 🎓**
