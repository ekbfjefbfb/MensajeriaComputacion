"""
Servidor de Mensajería Instantánea - Versión Corregida (Local Only)
Sin servicios de terceros - Todo en memoria local
"""
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from datetime import datetime
import re
import random
import os
import threading
import time
from collections import defaultdict, deque

# Configuración y almacenamiento de chat
HISTORIAL_MAX = 100
historial_mensajes = deque(maxlen=HISTORIAL_MAX) # Almacena historial grupal para nuevos usuarios

# Validación de nombre - letras, números, espacios (no al inicio)
NOMBRE_REGEX = re.compile(r'^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ][a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]*$')

def validar_nombre(nombre):
    """Valida que el nombre solo contenga letras, números y espacios (no al inicio)"""
    if not nombre:
        return False
    nombre = nombre.strip()
    if len(nombre) < 2 or len(nombre) > 20:
        return False
    return NOMBRE_REGEX.match(nombre) is not None

# Configuración minimalista (sin servicios externos)
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'demo-local-secreta')

# SocketIO simple (sin async_mode externo)
socketio = SocketIO(
    app, 
    cors_allowed_origins="*",
    logger=False,  # Sin logs excesivos
    engineio_logger=False,
    ping_timeout=30,
    ping_interval=15,
    max_http_buffer_size=100000  # 100KB máximo
)

# Almacenamiento thread-safe en memoria
usuarios_lock = threading.RLock()
usuarios_conectados = {}  # sid -> {nombre, color, avatar}
colores_usuario = {}
avatares_usuario = {}
rate_limit_lock = threading.Lock()
rate_limits = defaultdict(lambda: deque(maxlen=10))  # sid -> deque de timestamps

colores_disponibles = [
    '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', 
    '#F59E0B', '#EC4899', '#14B8A6', '#6366F1'
]

def obtener_color():
    return random.choice(colores_disponibles)

def obtener_hora():
    return datetime.now().strftime('%H:%M')

def check_rate_limit(sid, max_msgs=5, window=5):
    """Rate limiter simple en memoria"""
    with rate_limit_lock:
        now = time.time()
        history = rate_limits[sid]
        
        # Limpiar mensajes antiguos
        while history and now - history[0] > window:
            history.popleft()
        
        if len(history) >= max_msgs:
            return False
        
        history.append(now)
        return True

def get_unique_name(nombre):
    """Genera nombre único sin race conditions"""
    with usuarios_lock:
        base = nombre[:20].strip()
        if not base:
            base = "Usuario"
        
        existing = set(usuarios_conectados.values())
        if base not in existing:
            return base
        
        counter = 1
        while f"{base}_{counter}" in existing:
            counter += 1
        return f"{base}_{counter}"

@app.route('/')
def index():
    return render_template('chat.html')

@socketio.on('connect')
def manejar_conexion():
    print(f'🟢 Cliente conectado: {request.sid[:8]}...')

@socketio.on('registrar_usuario')
def registrar_usuario(data):
    try:
        sid = request.sid
        nombre = data.get('nombre', '').strip()
        avatar = data.get('avatar')
        
        # Validar nombre
        if not validar_nombre(nombre):
            emit('error', {'message': 'Nombre inválido. Solo letras, números y espacios. No empezar con espacio (2-20 chars)'})
            return
        
        # Rate limit en registro
        if not check_rate_limit(f"reg_{sid}", 3, 10):
            emit('error', {'message': 'Demasiados intentos'})
            return
        
        # Limitar avatar (50KB)
        if avatar and len(avatar) > 50000:
            avatar = None
        
        # Registrar thread-safe
        with usuarios_lock:
            nombre = get_unique_name(nombre)
            usuarios_conectados[sid] = nombre
            colores_usuario[sid] = obtener_color()
            if avatar:
                avatares_usuario[sid] = avatar
        
        join_room('general')
        
        # Responder al nuevo usuario
        emit('usuario_asignado', {
            'nombre': nombre,
            'color': colores_usuario[sid],
            'avatar': avatar
        })
        
        # Notificar a TODOS EXCEPTO al nuevo usuario que alguien se unió
        emit('sistema', {
            'mensaje': f'📥 {nombre} se unió al chat',
            'hora': obtener_hora(),
            'usuarios_online': len(usuarios_conectados)
        }, room='general', broadcast=True, include_self=False)  # No enviar al propio usuario
        
        # Lista de usuarios (con sids para chat privado)
        with usuarios_lock:
            users = [
                {'nombre': usuarios_conectados[s], 
                 'color': colores_usuario[s],
                 'avatar': avatares_usuario.get(s),
                 'sid': s}
                for s in usuarios_conectados
            ]
        emit('lista_usuarios', {'usuarios': users}, room='general', broadcast=True)
        
        # Enviar historial al nuevo usuario solamente
        with usuarios_lock:
            history_list = list(historial_mensajes)
        emit('historial_mensajes', {'mensajes': history_list})
        
        print(f'👤 Registrado: {nombre}')
        
    except Exception as e:
        print(f'❌ Error registro: {e}')
        emit('error', {'message': 'Error al registrar'})

@socketio.on('mensaje')
def manejar_mensaje(data):
    try:
        sid = request.sid
        
        # Verificar usuario
        with usuarios_lock:
            nombre = usuarios_conectados.get(sid)
            color = colores_usuario.get(sid)
            avatar = avatares_usuario.get(sid)
        
        if not nombre:
            return
        
        # Rate limiting
        if not check_rate_limit(sid, 5, 5):
            emit('error', {'message': 'Mensajes muy rápido'})
            return
        
        # Si avatar es muy grande, ignorarlo
        if avatar and len(avatar) > 50000:
            avatar = None
        
        mensaje = str(data.get('mensaje', '')).strip()[:500]
        if not mensaje:
            return
        
        msg_response = {
            'nombre': nombre,
            'mensaje': mensaje,
            'color': color,
            'avatar': avatar,
            'hora': obtener_hora(),
            'tipo': 'normal'
        }
        
        # Guardar en el historial grupal
        with usuarios_lock:
            historial_mensajes.append(msg_response)
            
        emit('nuevo_mensaje', msg_response, room='general', broadcast=True)  # Todos reciben incluyendo remitente (misma hora)
        
        print(f'💬 {nombre}: {mensaje[:30]}...')
        
    except Exception as e:
        print(f'❌ Error mensaje: {e}')

@socketio.on('mensaje_privado')
def manejar_mensaje_privado(data):
    """Maneja mensajes privados entre dos usuarios"""
    try:
        sid = request.sid
        
        with usuarios_lock:
            remitente = usuarios_conectados.get(sid)
            remitente_color = colores_usuario.get(sid)
            remitente_avatar = avatares_usuario.get(sid)
        
        if not remitente:
            return
        
        destinatario_sid = data.get('destinatario_sid')
        mensaje = str(data.get('mensaje', '')).strip()[:500]
        
        if not mensaje or not destinatario_sid:
            return
        
        # Rate limiting
        if not check_rate_limit(f"priv_{sid}", 10, 5):
            emit('error', {'message': 'Mensajes privados muy rápido'})
            return
        
        hora_actual = obtener_hora()
        
        # Enviar al destinatario
        emit('mensaje_privado', {
            'nombre': remitente,
            'mensaje': mensaje,
            'color': remitente_color,
            'avatar': remitente_avatar,
            'hora': hora_actual,
            'remitente': remitente,
            'esPrivado': True
        }, room=destinatario_sid)
        
        # Confirmar al remitente
        emit('mensaje_privado_enviado', {
            'destinatario_sid': destinatario_sid,
            'mensaje': mensaje,
            'hora': hora_actual
        })
        
        print(f'🔒 Mensaje privado de {remitente} a {destinatario_sid[:8]}...: {mensaje[:30]}...')
        
    except Exception as e:
        print(f'❌ Error mensaje privado: {e}')

@socketio.on('escribiendo')
def manejar_escribiendo(data):
    sid = request.sid
    with usuarios_lock:
        nombre = usuarios_conectados.get(sid)
    if nombre:
        emit('usuario_escribiendo', {
            'nombre': nombre,
            'escribiendo': data.get('escribiendo', False)
        }, room='general', broadcast=True, include_self=False)

@socketio.on('disconnect')
def manejar_desconexion():
    sid = request.sid
    
    with usuarios_lock:
        nombre = usuarios_conectados.pop(sid, None)
        colores_usuario.pop(sid, None)
        avatares_usuario.pop(sid, None)
    
    if nombre:
        leave_room('general')
        
        emit('sistema', {
            'mensaje': f'📤 {nombre} salió',
            'hora': obtener_hora(),
            'usuarios_online': len(usuarios_conectados)
        }, room='general', broadcast=True)
        
        with usuarios_lock:
            users = [
                {'nombre': usuarios_conectados[s], 
                 'color': colores_usuario[s],
                 'avatar': avatares_usuario.get(s)}
                for s in usuarios_conectados
            ]
        emit('lista_usuarios', {'usuarios': users}, room='general', broadcast=True)
        
        print(f'🔴 {nombre} desconectado')

@socketio.on_error_default
def default_error_handler(e):
    print(f'❌ Error: {e}')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    
    print("=" * 60)
    print("🚀 CHAT LOCAL - Versión Corregida (Thread-Safe)")
    print("=" * 60)
    print(f"� URL: http://localhost:{port}")
    print(f"🔒 Thread-safe: Sí (RLock)")
    print(f"📊 Rate limiting: 5 msg / 5 seg")
    print(f"🖼️  Max avatar: 50KB")
    print(f"💻 100% Local - Sin servicios externos")
    print("=" * 60)
    
    socketio.run(
        app,
        host='0.0.0.0',
        port=port,
        debug=False,
        use_reloader=False,
        log_output=False
    )
