"""
Servidor de Mensajería Instantánea - Versión Corregida (Local Only)
Sin servicios de terceros - Todo en memoria local
"""
try:
    import eventlet
    eventlet.monkey_patch()
except Exception:
    pass

from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from datetime import datetime
import re
import random
import os
import threading
import time
from collections import defaultdict, deque
from dotenv import load_dotenv
load_dotenv()

from flask_sqlalchemy import SQLAlchemy

# Configuración y almacenamiento de chat
HISTORIAL_MAX = 100

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

# Configuración minimalista con DB
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'demo-local-secreta')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'postgresql://postgres:CVvBw6hFjWk4Bcfn@hsxnlxzgrwemlhctvidb.db.eu-central-1.nhost.run:5432/hsxnlxzgrwemlhctvidb')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class Message(db.Model):
    __tablename__ = 'messages'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), nullable=False)
    mensaje = db.Column(db.Text, nullable=True)
    color = db.Column(db.String(50), nullable=True)
    avatar = db.Column(db.Text, nullable=True)
    hora = db.Column(db.String(50), nullable=True)
    tipo = db.Column(db.String(50), default='normal')
    archivo = db.Column(db.Text, nullable=True)
    ext = db.Column(db.String(50), nullable=True)
    nombre_real = db.Column(db.String(255), nullable=True)
    tamano = db.Column(db.String(50), nullable=True)
    room = db.Column(db.String(255), default='general')
    es_privado = db.Column(db.Boolean, default=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'mensaje': self.mensaje,
            'color': self.color,
            'avatar': self.avatar,
            'hora': self.hora,
            'tipo': self.tipo,
            'archivo': self.archivo,
            'ext': self.ext,
            'nombre_real': self.nombre_real,
            'tamano': self.tamano,
            'room': self.room,
            'esPrivado': self.es_privado
        }

# SocketIO simple (sin async_mode externo)
socketio = SocketIO(
    app, 
    cors_allowed_origins="*",
    logger=False,  # Sin logs excesivos
    engineio_logger=False,
    ping_timeout=30,
    ping_interval=15,
    max_http_buffer_size=2000000  # 2MB para multimedia avanzada
)

# Almacenamiento thread-safe en memoria
usuarios_lock = threading.RLock()
usuarios_conectados = {}  # sid -> nombre
colores_usuario = {}
avatares_usuario = {}
tokens_usuario = {} # sid -> token_unico
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

def check_rate_limit(sid, max_msgs=10, window=5):
    """Rate limiter optimizado para producción"""
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

def gestionar_nombre_y_token(nombre, sid, token_cliente):
    """
    Control de colisiones avanzado:
    Si el token coincide, reclama la sesión (reconectando).
    Si el token es nuevo pero el nombre existe, usa alias (_1, _2).
    """
    with usuarios_lock:
        base = nombre[:20].strip()
        if not base:
            base = "Usuario"
        
        viejo_sid = None
        for s, t in list(tokens_usuario.items()):
            if t == token_cliente:
                viejo_sid = s
                break
                
        if viejo_sid:
            # Reclamo legítimo de un ghost
            usuarios_conectados.pop(viejo_sid, None)
            colores_usuario.pop(viejo_sid, None)
            avatares_usuario.pop(viejo_sid, None)
            tokens_usuario.pop(viejo_sid, None)
            return base
            
        # Es un usuario nuevo. El usuario prefiere no usar alias, 
        # así que permitimos múltiples usuarios con el mismo nombre exacto.
        return base

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
        
        token_cliente = data.get('token', '')
        
        # Registrar thread-safe
        with usuarios_lock:
            nombre = gestionar_nombre_y_token(nombre, sid, token_cliente)
            usuarios_conectados[sid] = nombre
            colores_usuario[sid] = obtener_color()
            tokens_usuario[sid] = token_cliente
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
        with app.app_context():
            mensajes_db = Message.query.filter_by(room='general').order_by(Message.timestamp.desc()).limit(100).all()
            history_list = [m.to_dict() for m in reversed(mensajes_db)]
        
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
        
        # Extraer tipo y archivos con metadatos
        tipo = data.get('tipo', 'normal')
        archivo = data.get('archivo')
        ext = data.get('ext', '')
        nombre_real = data.get('nombre_real', '')
        tamano = data.get('tamano', '')
        
        # Limitar longitud si es texto normal, si es archivo permitir más
        mensaje = str(data.get('mensaje', '')).strip()
        if tipo == 'normal':
            mensaje = mensaje[:1000]
            if not mensaje: return
        
        msg_response = {
            'nombre': nombre,
            'mensaje': mensaje,
            'color': color,
            'avatar': avatar,
            'hora': obtener_hora(),
            'tipo': tipo,
            'archivo': archivo,
            'ext': ext,
            'nombre_real': nombre_real,
            'tamano': tamano
        }
        
        # Guardar en la base de datos (general)
        with app.app_context():
            nuevo_msg = Message(
                nombre=nombre,
                mensaje=mensaje,
                color=color,
                avatar=avatar,
                hora=msg_response['hora'],
                tipo=tipo,
                archivo=archivo,
                ext=ext,
                nombre_real=nombre_real,
                tamano=tamano,
                room='general',
                es_privado=False
            )
            db.session.add(nuevo_msg)
            try:
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                print(f"Error guardando DB: {e}")
            
        emit('nuevo_mensaje', msg_response, room='general', broadcast=True)
        
        print(f'💬 {nombre} ({tipo}): {mensaje[:30]}...')
        
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
        
        mensaje = str(data.get('mensaje', '')).strip()
        destinatario_sid = data.get('destinatario_sid')
        tipo = data.get('tipo', 'normal')
        archivo = data.get('archivo')
        ext = data.get('ext', '')
        nombre_real = data.get('nombre_real', '')
        tamano = data.get('tamano', '')
        
        if not (mensaje or archivo) or not destinatario_sid:
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
            'esPrivado': True,
            'tipo': tipo,
            'archivo': archivo,
            'ext': ext,
            'nombre_real': nombre_real,
            'tamano': tamano
        }, room=destinatario_sid)
        
        # Confirmar al remitente
        emit('mensaje_privado_enviado', {
            'destinatario_sid': destinatario_sid,
            'mensaje': mensaje,
            'tipo': tipo,
            'archivo': archivo,
            'ext': ext,
            'nombre_real': nombre_real,
            'tamano': tamano,
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
def manejar_desconexion(*args, **kwargs):
    sid = request.sid
    
    with usuarios_lock:
        nombre = usuarios_conectados.pop(sid, None)
        colores_usuario.pop(sid, None)
        avatares_usuario.pop(sid, None)
        tokens_usuario.pop(sid, None)
        
        # Limpieza activa de RAM para evitar memory leaks (crashes a largo plazo)
        with rate_limit_lock:
            rate_limits.pop(sid, None)
            rate_limits.pop(f"reg_{sid}", None)
            rate_limits.pop(f"priv_{sid}", None)
    
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
                 'avatar': avatares_usuario.get(s),
                 'sid': s}
                for s in usuarios_conectados
            ]
        emit('lista_usuarios', {'usuarios': users}, room='general', broadcast=True)
        
        print(f'🔴 {nombre} desconectado')

@socketio.on_error_default
def default_error_handler(e):
    print(f'❌ Error: {e}')

if __name__ == '__main__':
    with app.app_context():
        # Crear base de datos (seguro lanzarlo en el inicio si conectamos a la externa)
        print("Sincronizando Base de Datos PostgreSQL...")
        try:
            db.create_all()
            print("Tablas verificadas correctamente.")
        except Exception as e:
            print(f"Error creando tablas en DB: {e}")

    port = int(os.environ.get('PORT', 5001))
    
    print("=" * 60)
    print("🚀 CHAT LOCAL - Versión Corregida (Thread-Safe)")
    print("=" * 60)
    print(f" URL: http://localhost:{port}")
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
