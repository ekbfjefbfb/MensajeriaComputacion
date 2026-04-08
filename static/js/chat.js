/**
 * CHAT MODULE - Controlador (Premium Dark Mode)
 */

const CONFIG = {
    MAX_MESSAGE_LENGTH: 500,
    MAX_AVATAR_SIZE_KB: 500,
    AVATAR_QUALITY: 0.7,
    AVATAR_MAX_SIZE: 150,
    TYPING_TIMEOUT: 1200,
    MESSAGE_GROUP_TIME: 60000 // 1 minute to group messages
};

const State = {
    socket: null,
    miNombre: '',
    miColor: '',
    miAvatar: null,
    timeoutEscritura: null,
    ultimoRemitente: null,
    ultimoGrupo: null,
    tiempoUltimoMensaje: 0,
    chatPrivado: null,
    mensajesPrivados: {}
};

const Utils = {
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    mostrarError(mensaje) {
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = mensaje;
        setTimeout(() => errorDiv.textContent = '', 5000);
    },
    validarNombre(nombre) {
        const regex = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ][a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]*$/;
        return regex.test(nombre) && nombre.trim().length >= 2 && nombre.length <= 20;
    },
    scrollToBottom() {
        const c = document.getElementById('messagesContainer');
        c.scrollTop = c.scrollHeight;
    }
};

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
            Utils.mostrarError(`⚠️ Máximo ${CONFIG.MAX_AVATAR_SIZE_KB}KB`);
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
        document.getElementById('avatarUpload').style.borderColor = 'var(--accent)';
    }
};

const ConnectionModule = {
    conectar(nombre) {
        State.socket = io();
        this.setupEventHandlers();
    },
    setupEventHandlers() {
        const socket = State.socket;
        socket.on('connect', () => {
            socket.emit('registrar_usuario', {
                nombre: document.getElementById('nameInput').value.trim(),
                avatar: State.miAvatar
            });
        });

        socket.on('usuario_asignado', (data) => {
            State.miNombre = data.nombre;
            State.miColor = data.color;
            State.miAvatar = data.avatar || State.miAvatar;
            document.getElementById('loginOverlay').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loginOverlay').classList.add('hidden');
                document.getElementById('chatApp').classList.remove('hidden');
                document.getElementById('messageInput').focus();
            }, 400);
        });

        socket.on('historial_mensajes', (data) => {
            if(data.mensajes) {
                data.mensajes.forEach(msg => {
                    const isOwn = msg.nombre === State.miNombre;
                    MessageModule.agregar(msg, isOwn, true);
                });
                Utils.scrollToBottom();
            }
        });

        socket.on('error', (data) => {
            Utils.mostrarError('⚠️ ' + (data.message || 'Error'));
            document.getElementById('joinBtn').disabled = false;
        });

        socket.on('nuevo_mensaje', (data) => {
            if (!State.chatPrivado) {
                MessageModule.agregar(data, data.nombre === State.miNombre);
            }
        });

        socket.on('sistema', (data) => {
            if (!State.chatPrivado) MessageModule.agregarSistema(data.mensaje);
            document.getElementById('onlineCount').textContent = data.usuarios_online;
        });

        socket.on('lista_usuarios', (data) => UserModule.actualizarLista(data.usuarios));
        
        socket.on('usuario_escribiendo', (data) => {
            if (!State.chatPrivado) TypingModule.mostrar(data);
        });

        // Privados
        socket.on('mensaje_privado', (data) => PrivateChatModule.recibirMensaje(data));
    }
};

const UserModule = {
    usuariosLista: [],
    mensajesNoLeidos: {},

    actualizarLista(usuarios) {
        this.usuariosLista = usuarios.filter(u => u.nombre !== State.miNombre); // Ocultar a sÍ mismo
        this.usuariosLista.sort((a, b) => a.nombre.localeCompare(b.nombre));

        const html = this.usuariosLista.map(u => {
            const avatarHtml = u.avatar
                ? `<img src="${u.avatar}" class="avatar" alt="A">`
                : `<div class="avatar-placeholder" style="background: ${u.color}30; color: ${u.color}">${u.nombre.charAt(0).toUpperCase()}</div>`;
            const noLeidos = this.mensajesNoLeidos[u.nombre] || 0;
            const badgeHtml = noLeidos > 0 ? `<span class="msg-badge">${noLeidos}</span>` : '';
            const activeClass = State.chatPrivado?.nombre === u.nombre ? 'active-chat' : '';

            return `
                <li class="user-item ${activeClass}" onclick="PrivateChatModule.iniciar('${u.nombre}', '${u.sid || ''}')">
                    ${avatarHtml}
                    <span class="nombre">${u.nombre}</span>
                    ${badgeHtml}
                </li>
            `;
        }).join('');
        document.getElementById('userList').innerHTML = html;
        document.getElementById('onlineCount').textContent = (this.usuariosLista.length + 1).toString();
    },
    agregarMensajeNoLeido(nombre) {
        if (!this.mensajesNoLeidos[nombre]) this.mensajesNoLeidos[nombre] = 0;
        this.mensajesNoLeidos[nombre]++;
        this.actualizarLista(this.usuariosLista);
    },
    limpiarMensajesNoLeidos(nombre) {
        delete this.mensajesNoLeidos[nombre];
        this.actualizarLista(this.usuariosLista);
    },
    getSid(nombre) {
        return this.usuariosLista.find(u => u.nombre === nombre)?.sid;
    }
};

const PrivateChatModule = {
    iniciar(nombre, sid) {
        State.chatPrivado = { nombre, sid };
        UserModule.limpiarMensajesNoLeidos(nombre);
        this.actualizarUI();
        this.cargarMensajes(nombre);
    },
    cerrar() {
        State.chatPrivado = null;
        this.actualizarUI();
        document.getElementById('messagesContainer').innerHTML = '';
        State.ultimoRemitente = null;
        State.ultimoGrupo = null;
        // Peticion implicita de recargar el historial (simplificado recargando app o informando via WS)
        // Para simplificar: mostramos q volvio al general.
        MessageModule.agregarSistema("Volviste a la sala grupal.");
    },
    actualizarUI() {
        const title = document.getElementById('chatTitle');
        const subtitle = document.getElementById('chatSubtitle');
        const closeBtn = document.getElementById('closePrivateBtn');
        const input = document.getElementById('messageInput');
        const globalBtn = document.getElementById('btnGlobalChat');
        
        if (State.chatPrivado) {
            title.textContent = State.chatPrivado.nombre;
            subtitle.textContent = "Chat Privado Directo";
            closeBtn.classList.remove('hidden');
            input.placeholder = `Escribe a ${State.chatPrivado.nombre}...`;
            if (globalBtn) globalBtn.classList.remove('active-chat');
        } else {
            title.textContent = "Computación 1";
            subtitle.textContent = "Sala principal global";
            closeBtn.classList.add('hidden');
            input.placeholder = "Escribe un mensaje...";
            if (globalBtn) globalBtn.classList.add('active-chat');
        }
        if(UserModule.usuariosLista.length) UserModule.actualizarLista(UserModule.usuariosLista);
    },
    cargarMensajes(nombre) {
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';
        State.ultimoRemitente = null;
        State.ultimoGrupo = null;
        const mensajes = State.mensajesPrivados[nombre] || [];
        mensajes.forEach(msg => MessageModule.agregar(msg, msg.nombre === State.miNombre));
        Utils.scrollToBottom();
    },
    recibirMensaje(data) {
        const { remitente } = data;
        if (!State.mensajesPrivados[remitente]) State.mensajesPrivados[remitente] = [];
        State.mensajesPrivados[remitente].push(data);

        if (State.chatPrivado?.nombre === remitente) {
            MessageModule.agregar(data, false);
            Utils.scrollToBottom();
        } else {
            UserModule.agregarMensajeNoLeido(remitente);
        }
    }
};

const MessageModule = {
    enviar() {
        const input = document.getElementById('messageInput');
        const mensaje = input.value.trim();
        if (!mensaje || !State.socket) return;
        input.value = '';

        if (State.chatPrivado) {
            const destSid = UserModule.getSid(State.chatPrivado.nombre);
            if (destSid) {
                State.socket.emit('mensaje_privado', { mensaje, destinatario_sid: destSid });
                const msgData = {
                    nombre: State.miNombre,
                    mensaje, color: State.miColor, avatar: State.miAvatar, 
                    hora: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                    esPrivado: true
                };
                if (!State.mensajesPrivados[State.chatPrivado.nombre]) State.mensajesPrivados[State.chatPrivado.nombre] = [];
                State.mensajesPrivados[State.chatPrivado.nombre].push(msgData);
                MessageModule.agregar(msgData, true);
                Utils.scrollToBottom();
            }
        } else {
            State.socket.emit('mensaje', { mensaje });
            State.socket.emit('escribiendo', { escribiendo: false });
        }
    },
    agregar(data, esPropio = false, historico = false) {
        const container = document.getElementById('messagesContainer');
        const ahora = Date.now();
        const mismoRemitente = State.ultimoRemitente === data.nombre;
        const tiempoCercano = (ahora - State.tiempoUltimoMensaje) < CONFIG.MESSAGE_GROUP_TIME;

        if (!mismoRemitente || !tiempoCercano) {
            this.crearNuevoGrupo(data, esPropio, container);
        }
        this.agregarBurbuja(data);
        State.tiempoUltimoMensaje = ahora;
        if (!historico) Utils.scrollToBottom();
    },
    crearNuevoGrupo(data, esPropio, container) {
        State.ultimoGrupo = document.createElement('div');
        State.ultimoGrupo.className = `message-group ${esPropio ? 'own' : 'other'}`;
        const avatarHtml = data.avatar
            ? `<img src="${data.avatar}" class="avatar" alt="">`
            : `<div class="avatar-placeholder avatar" style="background: ${data.color}30; color: ${data.color}; display:flex; justify-content:center; align-items:center; font-weight:bold">${data.nombre.charAt(0).toUpperCase()}</div>`;

        State.ultimoGrupo.innerHTML = `
            <div class="group-header">
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
        burbuja.className = 'message-bubble';
        burbuja.innerHTML = `<span>${Utils.escapeHtml(data.mensaje)}</span>
                             <span class="bubble-time">${data.hora}</span>`;
        State.ultimoGrupo.appendChild(burbuja);
    },
    agregarSistema(texto) {
        State.ultimoRemitente = null;
        State.ultimoGrupo = null;
        const container = document.getElementById('messagesContainer');
        const div = document.createElement('div');
        div.className = 'message system';
        div.textContent = texto;
        container.appendChild(div);
        Utils.scrollToBottom();
    }
};

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
        if (State.chatPrivado) return;
        if (data.escribiendo) {
            indicator.textContent = `✏️ ${data.nombre} escribe...`;
            indicator.classList.add('visible');
        } else {
            indicator.classList.remove('visible');
        }
    }
};

const LoginModule = {
    iniciar() {
        const nombre = document.getElementById('nameInput').value.trim();
        if (!nombre || nombre.length < 2) return Utils.mostrarError('Mínimo 2 caracteres');
        if (nombre.length > 20) return Utils.mostrarError('Máximo 20 caracteres');
        if (!Utils.validarNombre(nombre)) return Utils.mostrarError('Solo letras y números');

        localStorage.setItem('chatToken', nombre);
        document.getElementById('joinBtn').disabled = true;
        document.getElementById('joinBtn').innerHTML = 'Conectando...';
        ConnectionModule.conectar(nombre);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const sName = localStorage.getItem('chatToken');
    if (sName) {
        document.getElementById('nameInput').value = sName;
        document.getElementById('loginOverlay').style.opacity = '0';
        setTimeout(() => LoginModule.iniciar(), 100);
    }
    
    document.getElementById('joinBtn').addEventListener('click', LoginModule.iniciar);
    document.getElementById('nameInput').addEventListener('keypress', e => e.key === 'Enter' && LoginModule.iniciar());
    document.getElementById('avatarUpload').addEventListener('click', () => AvatarModule.seleccionar());
    document.getElementById('avatarInput').addEventListener('change', e => AvatarModule.cargar(e));
    
    document.getElementById('sendBtn').addEventListener('click', () => MessageModule.enviar());
    document.getElementById('messageInput').addEventListener('keypress', e => e.key === 'Enter' && MessageModule.enviar());
    document.getElementById('messageInput').addEventListener('input', () => TypingModule.manejar());
});
