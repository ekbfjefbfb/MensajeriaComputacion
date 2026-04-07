"""
Servidor de Mensajería Instantánea - Demo para Clase
Muestra: WebSocket, Broadcasting, Estados de Conexión, Hilos
"""
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from datetime import datetime
import random
import os
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'demo-secreta-cambiar-en-produccion')

# Configuración SocketIO para producción y desarrollo
socketio = SocketIO(
    app, 
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25
)

# Almacenamiento de estado en memoria
usuarios_conectados = {}  # sid -> nombre
salas = {'general': {'nombre': 'General', 'usuarios': set()}}
colores_usuario = {}  # sid -> color
avatares_usuario = {}  # sid -> base64 imagen

colores_disponibles = [
    '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', 
    '#F59E0B', '#EC4899', '#14B8A6', '#6366F1'
]

def obtener_color():
    return random.choice(colores_disponibles)

def obtener_hora():
    return datetime.now().strftime('%H:%M')

@app.route('/')
def index():
    return render_template('chat.html')

@socketio.on('connect')
def manejar_conexion():
    logger.info(f'🟢 Cliente conectado: {request.sid}')

@socketio.on('registrar_usuario')
def registrar_usuario(data):
    nombre = data.get('nombre', 'Anónimo').strip()
    avatar = data.get('avatar')  # Base64 de la imagen
    
    # Validar tamaño del avatar (max 100KB para no sobrecargar memoria)
    if avatar and len(avatar) > 100000:
        avatar = None
    
    # Evitar nombres duplicados
    contador = 1
    nombre_original = nombre
    while nombre in usuarios_conectados.values():
        nombre = f"{nombre_original}_{contador}"
        contador += 1
    
    usuarios_conectados[request.sid] = nombre
    colores_usuario[request.sid] = obtener_color()
    if avatar:
        avatares_usuario[request.sid] = avatar
    salas['general']['usuarios'].add(request.sid)
    
    join_room('general')
    
    # Notificar al nuevo usuario
    emit('usuario_asignado', {
        'nombre': nombre,
        'color': colores_usuario[request.sid],
        'avatar': avatar
    })
    
    # Notificar a todos que alguien se unió
    emit('sistema', {
        'tipo': 'entrada',
        'mensaje': f'📥 {nombre} se unió al chat',
        'hora': obtener_hora(),
        'usuarios_online': len(usuarios_conectados)
    }, broadcast=True)
    
    # Enviar lista de usuarios conectados (con avatares)
    emit('lista_usuarios', {
        'usuarios': [
            {
                'nombre': usuarios_conectados[sid], 
                'color': colores_usuario[sid],
                'avatar': avatares_usuario.get(sid)
            }
            for sid in usuarios_conectados
        ]
    }, broadcast=True)
    
    logger.info(f'👤 Usuario registrado: {nombre} ({request.sid})')

@socketio.on('mensaje')
def manejar_mensaje(data):
    sid = request.sid
    if sid not in usuarios_conectados:
        return
    
    mensaje = data.get('mensaje', '').strip()
    if not mensaje:
        return
    
    # Limitar longitud del mensaje
    if len(mensaje) > 500:
        mensaje = mensaje[:500] + '...'
    
    nombre = usuarios_conectados[sid]
    color = colores_usuario[sid]
    avatar = avatares_usuario.get(sid)  # Obtener avatar del usuario
    
    emit('nuevo_mensaje', {
        'nombre': nombre,
        'mensaje': mensaje,
        'color': color,
        'avatar': avatar,
        'hora': obtener_hora(),
        'tipo': 'normal'
    }, broadcast=True)
    
    logger.info(f'💬 {nombre}: {mensaje[:50]}...' if len(mensaje) > 50 else f'💬 {nombre}: {mensaje}')

@socketio.on('escribiendo')
def manejar_escribiendo(data):
    sid = request.sid
    if sid not in usuarios_conectados:
        return
    
    nombre = usuarios_conectados[sid]
    esta_escribiendo = data.get('escribiendo', False)
    
    emit('usuario_escribiendo', {
        'nombre': nombre,
        'escribiendo': esta_escribiendo
    }, broadcast=True, include_self=False)

@socketio.on('disconnect')
def manejar_desconexion():
    sid = request.sid
    if sid in usuarios_conectados:
        nombre = usuarios_conectados[sid]
        del usuarios_conectados[sid]
        
        if sid in colores_usuario:
            del colores_usuario[sid]
        
        if sid in avatares_usuario:
            del avatares_usuario[sid]
        
        salas['general']['usuarios'].discard(sid)
        
        # Notificar salida
        emit('sistema', {
            'tipo': 'salida',
            'mensaje': f'📤 {nombre} salió del chat',
            'hora': obtener_hora(),
            'usuarios_online': len(usuarios_conectados)
        }, broadcast=True)
        
        # Actualizar lista
        emit('lista_usuarios', {
            'usuarios': [
                {
                    'nombre': usuarios_conectados[s], 
                    'color': colores_usuario[s],
                    'avatar': avatares_usuario.get(s)
                }
                for s in usuarios_conectados
            ]
        }, broadcast=True)
        
        logger.info(f'🔴 {nombre} desconectado')

if __name__ == '__main__':
    # Puerto desde variable de entorno (Render) o default 5001 (local)
    port = int(os.environ.get('PORT', 5001))
    
    print("=" * 60)
    print("🚀 SERVIDOR DE MENSAJERÍA INSTANTÁNEA")
    print("=" * 60)
    print("\n📚 Conceptos que demuestra esta aplicación:")
    print("   • WebSocket: Comunicación bidireccional persistente")
    print("   • Broadcasting: Envío masivo a todos los clientes")
    print("   • Eventos en tiempo real: Mensajes instantáneos")
    print("   • Manejo de estado: Usuarios online/escribiendo")
    print("   • Concurrencia: Múltiples conexiones simultáneas")
    print("   • HTTPS: Conexión cifrada SSL/TLS")
    print("\n🌐 Servidor iniciado")
    print(f"   Local:    http://localhost:{port}")
    print(f"   Network:  http://0.0.0.0:{port}")
    print("=" * 60)
    
    # En desarrollo local usar socketio.run, en producción Render usa gunicorn
    socketio.run(
        app, 
        host='0.0.0.0', 
        port=port, 
        debug=False,
        use_reloader=False
    )
