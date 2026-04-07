/**
 * CHAT MODULE - Arquitectura MVC
 * Responsabilidad: Lógica del chat (Controller)
 */

// ==========================================
// CONFIGURACIÓN
// ==========================================
const CONFIG = {
    MAX_MESSAGE_LENGTH: 500,
    MAX_AVATAR_SIZE_KB: 500,
    AVATAR_QUALITY: 0.7,
    AVATAR_MAX_SIZE: 200,
    TYPING_TIMEOUT: 1000,
    MESSAGE_GROUP_TIME: 30000 // 30 segundos
};

// ==========================================
// ESTADO GLOBAL
// ==========================================
const State = {
    socket: null,
    miNombre: '',
    miColor: '',
    miAvatar: null,
    timeoutEscritura: null,
    ultimoRemitente: null,
    ultimoGrupo: null,
    tiempoUltimoMensaje: 0,
    chatPrivado: null,  // { nombre: string, sid: string } - null si es chat grupal
    mensajesPrivados: {}  // { nombreUsuario: [mensajes] }
};

// ==========================================
// UTILIDADES
// ==========================================
const Utils = {
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    obtenerHora() {
        return new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    },

    mostrarError(mensaje) {
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = mensaje;
        setTimeout(() => errorDiv.textContent = '', 5000);
    },

    validarNombre(nombre) {
        // Solo letras (incluyendo acentos), números y ESPACIOS
        // NO al inicio con espacio, NO símbolos especiales _, -, @, etc
        // Debe empezar con letra o número
        const regex = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ][a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]*$/;
        return regex.test(nombre) && nombre.trim().length >= 2 && nombre.length <= 20;
    }
};

// ==========================================
// MÓDULO: AVATAR
// ==========================================
const AvatarModule = {
    seleccionar() {
        document.getElementById('avatarInput').click();
    },

    cargar(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            Utils.mostrarError('⚠️ Selecciona una imagen válida');
            return;
        }

        if (file.size > CONFIG.MAX_AVATAR_SIZE_KB * 1024) {
            Utils.mostrarError(`⚠️ La imagen debe ser menor a ${CONFIG.MAX_AVATAR_SIZE_KB}KB`);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => this.procesarImagen(e.target.result);
        reader.readAsDataURL(file);
    },

    procesarImagen(dataUrl) {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            let { width, height } = img;
            if (width > height) {
                if (width > CONFIG.AVATAR_MAX_SIZE) {
                    height *= CONFIG.AVATAR_MAX_SIZE / width;
                    width = CONFIG.AVATAR_MAX_SIZE;
                }
            } else {
                if (height > CONFIG.AVATAR_MAX_SIZE) {
                    width *= CONFIG.AVATAR_MAX_SIZE / height;
                    height = CONFIG.AVATAR_MAX_SIZE;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            State.miAvatar = canvas.toDataURL('image/jpeg', CONFIG.AVATAR_QUALITY);
            this.actualizarUI();
        };
        img.src = dataUrl;
    },

    actualizarUI() {
        document.getElementById('avatarPreview').src = State.miAvatar;
        document.getElementById('avatarPreview').style.display = 'block';
        document.getElementById('avatarPlaceholder').style.display = 'none';
        document.querySelector('.avatar-text').style.display = 'none';
        document.getElementById('avatarUpload').classList.add('has-image');
    }
};

// ==========================================
// MÓDULO: CONEXIÓN
// ==========================================
const ConnectionModule = {
    conectar(nombre) {
        State.socket = io();
        this.setupEventHandlers();
    },

    setupEventHandlers() {
        const socket = State.socket;

        socket.on('connect', () => {
            console.log('✅ Conectado');
            socket.emit('registrar_usuario', {
                nombre: document.getElementById('nameInput').value.trim(),
                avatar: State.miAvatar
            });
        });

        socket.on('usuario_asignado', (data) => this.handleAssigned(data));
        socket.on('connect_error', (error) => this.handleError(error));
        socket.on('error', (data) => Utils.mostrarError('⚠️ ' + (data.message || 'Error')));
        socket.on('nuevo_mensaje', (data) => {
            // Solo procesar mensajes grupales si no estamos en chat privado
            if (!State.chatPrivado) {
                MessageModule.agregar(data);
            }
        });
        socket.on('sistema', (data) => {
            if (!State.chatPrivado) {
                this.handleSystem(data);
            }
        });
        socket.on('lista_usuarios', (data) => UserModule.actualizarLista(data.usuarios));
        socket.on('usuario_escribiendo', (data) => {
            if (!State.chatPrivado) {
                TypingModule.mostrar(data);
            }
        });
        
        // Mensajes privados
        socket.on('mensaje_privado', (data) => PrivateChatModule.recibirMensaje(data));
        socket.on('mensaje_privado_enviado', (data) => {
            console.log('✅ Mensaje privado enviado');
        });
    },

    handleAssigned(data) {
        console.log('✅ Registrado:', data);
        State.miNombre = data.nombre;
        State.miColor = data.color;
        State.miAvatar = data.avatar || State.miAvatar;

        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('chatApp').classList.remove('hidden');
        document.getElementById('messageInput').focus();

        // No mostrar mensaje local - esperar mensaje del servidor
        // para mantener consistencia entre todos los usuarios
    },

    handleError(error) {
        console.error('❌ Error:', error);
        Utils.mostrarError('⚠️ Error al conectar. Intenta de nuevo.');
        document.getElementById('joinBtn').disabled = false;
        document.getElementById('joinBtn').textContent = 'Reintentar 🚀';
    },

    handleSystem(data) {
        MessageModule.agregarSistema(data.mensaje);
        document.getElementById('onlineCount').textContent = `${data.usuarios_online} online`;
    }
};

// ==========================================
// MÓDULO: USUARIOS (con chat privado)
// ==========================================
const UserModule = {
    usuariosLista: [],
    mensajesNoLeidos: {},  // { nombreUsuario: count }

    actualizarLista(usuarios) {
        this.usuariosLista = usuarios;
        usuarios.sort((a, b) => a.nombre.localeCompare(b.nombre));

        const html = usuarios.map((u, index) => {
            const avatarHtml = u.avatar
                ? `<img src="${u.avatar}" class="avatar" alt="${u.nombre}">`
                : `<div class="avatar-placeholder" style="background: ${u.color}40; color: ${u.color}">${u.nombre.charAt(0).toUpperCase()}</div>`;

            const noLeidos = this.mensajesNoLeidos[u.nombre] || 0;
            const badgeHtml = noLeidos > 0 ? `<span class="msg-badge">${noLeidos}</span>` : '';
            const activeClass = State.chatPrivado?.nombre === u.nombre ? 'active-chat' : '';
            const hasNewClass = noLeidos > 0 ? 'has-new-message' : '';

            return `
                <li class="user-item ${activeClass} ${hasNewClass}" 
                    onclick="PrivateChatModule.iniciar('${u.nombre}', '${u.sid || ''}')"
                    title="${noLeidos > 0 ? noLeidos + ' mensaje(s) nuevo(s)' : 'Click para chat privado'}">
                    ${avatarHtml}
                    <span class="nombre">${u.nombre}</span>
                    <span class="estado"></span>
                    ${badgeHtml}
                </li>
            `;
        }).join('');

        document.getElementById('userList').innerHTML = html;
    },

    agregarMensajeNoLeido(nombre) {
        if (!this.mensajesNoLeidos[nombre]) {
            this.mensajesNoLeidos[nombre] = 0;
        }
        this.mensajesNoLeidos[nombre]++;
        this.actualizarLista(this.usuariosLista);
    },

    limpiarMensajesNoLeidos(nombre) {
        delete this.mensajesNoLeidos[nombre];
        this.actualizarLista(this.usuariosLista);
    },

    getSid(nombre) {
        const usuario = this.usuariosLista.find(u => u.nombre === nombre);
        return usuario?.sid;
    }
};

// ==========================================
// MÓDULO: CHAT PRIVADO (uno a uno)
// ==========================================
const PrivateChatModule = {
    iniciar(nombre, sid) {
        if (nombre === State.miNombre) {
            Utils.mostrarError('⚠️ No puedes chatear contigo mismo');
            return;
        }

        State.chatPrivado = { nombre, sid };
        
        // Limpiar mensajes no leídos de este usuario
        UserModule.limpiarMensajesNoLeidos(nombre);
        
        // Actualizar UI
        this.actualizarUI();
        
        // Cargar mensajes previos si existen
        this.cargarMensajes(nombre);
        
        console.log(`🔒 Chat privado iniciado con: ${nombre}`);
    },

    cerrar() {
        State.chatPrivado = null;
        this.actualizarUI();
        
        // Volver a chat grupal
        document.getElementById('messagesContainer').innerHTML = '';
        State.ultimoRemitente = null;
        State.ultimoGrupo = null;
    },

    actualizarUI() {
        const chatTitle = document.getElementById('chatTitle');
        const chatSubtitle = document.getElementById('chatSubtitle');
        const closeBtn = document.getElementById('closePrivateBtn');
        const input = document.getElementById('messageInput');
        
        if (State.chatPrivado) {
            chatTitle.textContent = `🔒 ${State.chatPrivado.nombre}`;
            chatSubtitle.textContent = 'Privado';
            closeBtn.classList.remove('hidden');
            input.placeholder = `Para ${State.chatPrivado.nombre}...`;
        } else {
            chatTitle.textContent = '💬 Sala General';
            chatSubtitle.textContent = 'Grupal';
            closeBtn.classList.add('hidden');
            input.placeholder = 'Escribe un mensaje...';
        }
        
        // Refrescar lista para mostrar activo
        if (UserModule.usuariosLista.length > 0) {
            UserModule.actualizarLista(UserModule.usuariosLista);
        }
    },

    cargarMensajes(nombre) {
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';
        State.ultimoRemitente = null;
        State.ultimoGrupo = null;

        const mensajes = State.mensajesPrivados[nombre] || [];
        
        mensajes.forEach(msg => {
            MessageModule.agregar(msg, msg.nombre === State.miNombre);
        });

        container.scrollTop = container.scrollHeight;
    },

    recibirMensaje(data) {
        const { nombre, mensaje, color, avatar, hora, remitente } = data;
        
        // Guardar en historial
        if (!State.mensajesPrivados[remitente]) {
            State.mensajesPrivados[remitente] = [];
        }
        
        State.mensajesPrivados[remitente].push({
            nombre: remitente,
            mensaje,
            color,
            avatar,
            hora,
            esPrivado: true
        });

        // Si estamos en chat privado con este usuario, mostrar
        if (State.chatPrivado?.nombre === remitente) {
            MessageModule.agregar({
                nombre: remitente,
                mensaje,
                color,
                avatar,
                hora
            }, false);
        } else {
            // Agregar al contador de mensajes no leídos
            UserModule.agregarMensajeNoLeido(remitente);
        }
    }
};

// ==========================================
// MÓDULO: MENSAJES
// ==========================================
const MessageModule = {
    enviar() {
        const input = document.getElementById('messageInput');
        const mensaje = input.value.trim();

        if (!mensaje || !State.socket) {
            console.log('❌ No se puede enviar');
            return;
        }

        input.value = '';

        if (State.chatPrivado) {
            // Enviar mensaje privado
            const destinatarioSid = UserModule.getSid(State.chatPrivado.nombre);
            if (destinatarioSid) {
                State.socket.emit('mensaje_privado', {
                    mensaje: mensaje,
                    destinatario_sid: destinatarioSid
                });
                
                // Guardar en historial localmente (el servidor no reenvía al remitente)
                if (!State.mensajesPrivados[State.chatPrivado.nombre]) {
                    State.mensajesPrivados[State.chatPrivado.nombre] = [];
                }
                const msgData = {
                    nombre: State.miNombre,
                    mensaje: mensaje,
                    color: State.miColor,
                    avatar: State.miAvatar,
                    hora: Utils.obtenerHora()
                };
                State.mensajesPrivados[State.chatPrivado.nombre].push(msgData);
                
                // Mostrar localmente
                MessageModule.agregar(msgData, true);
            }
        } else {
            // Enviar mensaje grupal
            State.socket.emit('mensaje', { mensaje: mensaje });
            State.socket.emit('escribiendo', { escribiendo: false });
        }
    },

    agregar(data, esPropio = false) {
        const container = document.getElementById('messagesContainer');
        const ahora = Date.now();
        const mismoRemitente = State.ultimoRemitente === data.nombre;
        const tiempoCercano = (ahora - State.tiempoUltimoMensaje) < CONFIG.MESSAGE_GROUP_TIME;

        if (!mismoRemitente || !tiempoCercano) {
            this.cerrarGrupoAnterior();
            this.crearNuevoGrupo(data, esPropio, container);
        }

        this.agregarBurbuja(data);

        State.tiempoUltimoMensaje = ahora;
        container.scrollTop = container.scrollHeight;
    },

    cerrarGrupoAnterior() {
        if (State.ultimoGrupo) {
            const burbujas = State.ultimoGrupo.querySelectorAll('.message-bubble');
            const count = burbujas.length;
            if (count === 1) {
                burbujas[0].className = 'message-bubble single';
            } else if (count > 1) {
                burbujas[count - 1].className = 'message-bubble last';
            }
        }
    },

    crearNuevoGrupo(data, esPropio, container) {
        State.ultimoGrupo = document.createElement('div');
        State.ultimoGrupo.className = `message-group ${esPropio ? 'own' : 'other'}`;

        const avatarHtml = data.avatar
            ? `<img src="${data.avatar}" class="avatar" alt="${data.nombre}" loading="eager">`
            : `<div class="user-avatar" style="background: ${data.color}20; color: ${data.color}">${data.nombre.charAt(0).toUpperCase()}</div>`;

        State.ultimoGrupo.innerHTML = `
            <div class="message-group-header">
                ${avatarHtml}
                <span class="group-sender-name" style="color: ${data.color}">${data.nombre}</span>
                <span class="group-time">${data.hora}</span>
            </div>
        `;
        container.appendChild(State.ultimoGrupo);
        State.ultimoRemitente = data.nombre;
    },

    agregarBurbuja(data) {
        const burbuja = document.createElement('div');
        burbuja.className = 'message-bubble first';
        burbuja.innerHTML = `
            <div class="bubble-content">
                <span class="bubble-text">${Utils.escapeHtml(data.mensaje)}</span>
                <span class="bubble-time">${data.hora}</span>
            </div>
        `;
        State.ultimoGrupo.appendChild(burbuja);

        const todasBurbujas = State.ultimoGrupo.querySelectorAll('.message-bubble');
        if (todasBurbujas.length > 1) {
            const anterior = todasBurbujas[todasBurbujas.length - 2];
            anterior.className = anterior.className.replace('first', 'middle');
        }
    },

    agregarSistema(texto) {
        State.ultimoRemitente = null;
        State.ultimoGrupo = null;

        const container = document.getElementById('messagesContainer');
        const div = document.createElement('div');
        div.className = 'message system';
        div.textContent = texto;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }
};

// ==========================================
// MÓDULO: TYPING (ESCRIBIENDO)
// ==========================================
const TypingModule = {
    manejar() {
        if (!State.socket) return;

        State.socket.emit('escribiendo', { escribiendo: true });

        clearTimeout(State.timeoutEscritura);
        State.timeoutEscritura = setTimeout(() => {
            State.socket.emit('escribiendo', { escribiendo: false });
        }, CONFIG.TYPING_TIMEOUT);
    },

    mostrar(data) {
        const indicator = document.getElementById('typingIndicator');
        if (!indicator) return;
        
        // Solo mostrar en chat grupal
        if (State.chatPrivado) {
            indicator.textContent = '';
            indicator.classList.remove('visible');
            return;
        }
        
        if (data.escribiendo) {
            indicator.textContent = `✏️ ${data.nombre} está escribiendo...`;
            indicator.classList.add('visible');
        } else {
            indicator.textContent = '';
            indicator.classList.remove('visible');
        }
    }
};

// ==========================================
// MÓDULO: LOGIN
// ==========================================
const LoginModule = {
    iniciar() {
        const nombre = document.getElementById('nameInput').value.trim();

        if (!nombre || nombre.length < 2) {
            Utils.mostrarError('⚠️ Escribe tu nombre (mín 2 letras)');
            return;
        }

        if (nombre.length > 20) {
            Utils.mostrarError('⚠️ Máximo 20 caracteres');
            return;
        }

        if (!Utils.validarNombre(nombre)) {
            Utils.mostrarError('⚠️ Solo letras, números y espacios. Empezar con letra/número. Máx 20 chars');
            return;
        }

        document.getElementById('errorMessage').textContent = '';
        document.getElementById('joinBtn').disabled = true;
        document.getElementById('joinBtn').textContent = 'Conectando...';

        ConnectionModule.conectar(nombre);
    }
};

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Event Listeners
    document.getElementById('joinBtn').addEventListener('click', () => LoginModule.iniciar());
    document.getElementById('nameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') LoginModule.iniciar();
    });
    document.getElementById('avatarUpload').addEventListener('click', () => AvatarModule.seleccionar());
    document.getElementById('avatarInput').addEventListener('change', (e) => AvatarModule.cargar(e));
    document.getElementById('sendBtn').addEventListener('click', () => MessageModule.enviar());
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') MessageModule.enviar();
    });
    document.getElementById('messageInput').addEventListener('input', () => TypingModule.manejar());

    console.log('🚀 Chat Module inicializado');
});

// Toggle panel educativo (global function)
window.toggleEdu = function() {
    const content = document.querySelector('.edu-content');
    const btn = document.querySelector('.edu-toggle');
    content.classList.toggle('collapsed');
    btn.textContent = content.classList.contains('collapsed') ? '+' : '−';
};
