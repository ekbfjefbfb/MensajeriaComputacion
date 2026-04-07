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
    tiempoUltimoMensaje: 0
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
        // Solo letras (incluyendo acentos), números, _ y - 
        // NO espacios, NO símbolos especiales
        const regex = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+$/;
        return regex.test(nombre);
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
        socket.on('nuevo_mensaje', (data) => MessageModule.agregar(data));
        socket.on('sistema', (data) => this.handleSystem(data));
        socket.on('lista_usuarios', (data) => UserModule.actualizarLista(data.usuarios));
        socket.on('usuario_escribiendo', (data) => TypingModule.mostrar(data));
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
// MÓDULO: USUARIOS
// ==========================================
const UserModule = {
    actualizarLista(usuarios) {
        usuarios.sort((a, b) => a.nombre.localeCompare(b.nombre));

        const html = usuarios.map((u, index) => {
            const avatarHtml = u.avatar
                ? `<img src="${u.avatar}" class="avatar" alt="${u.nombre}">`
                : `<div class="avatar-placeholder" style="background: ${u.color}40; color: ${u.color}">${u.nombre.charAt(0).toUpperCase()}</div>`;

            return `
                <li class="user-item" title="${u.nombre}">
                    ${avatarHtml}
                    <span class="nombre">${u.nombre}</span>
                    <span class="estado"></span>
                    <span class="user-number">#${index + 1}</span>
                </li>
            `;
        }).join('');

        document.getElementById('userList').innerHTML = html;
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

        // Solo enviar al servidor - el mensaje se mostrará cuando el servidor lo reenvíe
        // (para que todos los clientes vean el mismo mensaje con la misma hora)
        State.socket.emit('mensaje', { mensaje: mensaje });
        State.socket.emit('escribiendo', { escribiendo: false });
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
        if (data.escribiendo) {
            indicator.textContent = `✏️ ${data.nombre} está escribiendo...`;
            indicator.classList.add('visible');
        } else {
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
            Utils.mostrarError('⚠️ Solo letras, números, _ y - permitidos');
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
