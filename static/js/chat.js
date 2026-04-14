/**
 * CHAT MODULE - Controlador (Premium Dark Mode)
 */

const CONFIG = {
    MAX_MESSAGE_LENGTH: 500,
    MAX_AVATAR_SIZE_KB: 40,
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
    miToken: null,
    timeoutEscritura: null,
    ultimoRemitente: null,
    ultimoGrupo: null,
    tiempoUltimoMensaje: 0,
    chatPrivado: null,
    mensajesGlobales: [],
    mensajesPrivados: {},
    mediaRecorder: null,
    audioChunks: [],
    ultimaHoraMensaje: null
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
                State.mensajesGlobales = [...data.mensajes]; // Guardar historial
                data.mensajes.forEach(msg => {
                    const isOwn = msg.nombre === State.miNombre;
                    MessageModule.agregar(msg, isOwn, true, true);
                });
                Utils.scrollToBottom();
            }
        });

        socket.on('error', (data) => {
            Utils.mostrarError('⚠️ ' + (data.message || 'Error'));
            document.getElementById('joinBtn').disabled = false;
        });

        socket.on('nuevo_mensaje', (data) => {
            State.mensajesGlobales.push(data); // Añadir siempre al historial global
            if (!State.chatPrivado) {
                MessageModule.agregar(data, data.nombre === State.miNombre, false, true);
            } else {
                // Indicador de mensaje nuevo en sala general si está en privado (Opcional, minimal)
                const globalBtn = document.getElementById('btnGlobalChat');
                if (globalBtn) globalBtn.style.animation = 'pulse 1.5s 2';
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
        
        socket.on('mensaje_privado_enviado', (data) => {
            if (State.chatPrivado?.nombre === UserModule.getNameBySid(data.destinatario_sid)) {
                MessageModule.agregar(data, true);
            }
        });
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
    },
    getNameBySid(sid) {
        return this.usuariosLista.find(u => u.sid === sid)?.nombre;
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
        // Restaurar sala global
        State.mensajesGlobales.forEach(msg => {
            MessageModule.agregar(msg, msg.nombre === State.miNombre, true, true);
        });
        Utils.scrollToBottom();
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
        this.emitir('normal', mensaje);
        input.value = '';
    },
    emitir(tipo, mensaje, archivo = null, ext = '') {
        if (!State.socket) return;
        
        const payload = { tipo, mensaje, archivo, ext };
        
        if (State.chatPrivado) {
            const destSid = UserModule.getSid(State.chatPrivado.nombre);
            if (destSid) {
                payload.destinatario_sid = destSid;
                State.socket.emit('mensaje_privado', payload);
                // Lógica local para privados (optimizado)
                const msgData = {
                    nombre: State.miNombre,
                    mensaje, color: State.miColor, avatar: State.miAvatar, 
                    hora: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                    esPrivado: true, tipo, archivo, ext
                };
                if (!State.mensajesPrivados[State.chatPrivado.nombre]) State.mensajesPrivados[State.chatPrivado.nombre] = [];
                State.mensajesPrivados[State.chatPrivado.nombre].push(msgData);
            }
        } else {
            State.socket.emit('mensaje', payload);
            State.socket.emit('escribiendo', { escribiendo: false });
        }
    },
    agregar(data, esPropio = false, historico = false, esGlobal = false) {
        // En privado, solo mostrar si NO es global, o si se especifico. En este modulo: 
        // Ya filtramos qué agregar en los eventos.
        const container = document.getElementById('messagesContainer');
        const mismoRemitente = State.ultimoRemitente === data.nombre;
        const mismaHora = State.ultimaHoraMensaje === data.hora;

        if (!mismoRemitente || !mismaHora) {
            this.crearNuevoGrupo(data, esPropio, container);
        }
        this.agregarBurbuja(data);
        State.ultimaHoraMensaje = data.hora;
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
        
        let contentHtml = '';
        const safeText = Utils.escapeHtml(data.mensaje);
        const linkifiedText = safeText.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:inherit; text-decoration:underline">$1</a>');

        switch(data.tipo) {
            case 'imagen':
                contentHtml = `<img src="${data.archivo}" alt="Imagen"><span>${linkifiedText}</span>`;
                break;
            case 'audio':
                contentHtml = `<audio src="${data.archivo}" controls></audio>`;
                break;
            case 'video':
                contentHtml = `<video src="${data.archivo}" controls></video><span>${linkifiedText}</span>`;
                break;
            case 'sticker':
                contentHtml = `<div style="font-size: 3rem">${data.archivo}</div>`;
                break;
            case 'documento':
                contentHtml = `<a href="${data.archivo}" download="archivo.${data.ext}" class="doc-link">
                    <svg width="24" viewBox="0 0 24 24"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                    Documento (.${data.ext})
                </a>`;
                break;
            default:
                contentHtml = `<span>${linkifiedText}</span>`;
        }

        burbuja.innerHTML = `${contentHtml} <span class="bubble-time">${data.hora}</span>`;
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

const MediaModule = {
    async alternarGrabacion() {
        if (!State.mediaRecorder || State.mediaRecorder.state === 'inactive') {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                State.mediaRecorder = new MediaRecorder(stream);
                State.audioChunks = [];
                
                State.mediaRecorder.ondataavailable = e => State.audioChunks.push(e.data);
                State.mediaRecorder.onstop = () => this.enviarVoz();
                
                State.mediaRecorder.start();
                document.getElementById('micBtn').classList.add('recording');
                // Auto-stop after 30s as per plan
                setTimeout(() => { if(State.mediaRecorder.state === 'recording') this.alternarGrabacion(); }, 30000);
            } catch (err) {
                Utils.mostrarError("No se pudo acceder al micrófono");
            }
        } else {
            State.mediaRecorder.stop();
            document.getElementById('micBtn').classList.remove('recording');
            State.mediaRecorder.stream.getTracks().forEach(t => t.stop());
        }
    },
    enviarVoz() {
        const audioBlob = new Blob(State.audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = e => MessageModule.emitir('audio', '', e.target.result);
        reader.readAsDataURL(audioBlob);
    },
    seleccionarArchivo() {
        document.getElementById('mediaInput').click();
    },
    async procesarArchivo(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) { // 2MB limit adjusted in backend
            return Utils.mostrarError("Archivo demasiado grande (Máx 2MB)");
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            const data = ev.target.result;
            const ext = file.name.split('.').pop();
            let tipo = 'documento';
            
            if (file.type.startsWith('image/')) tipo = 'imagen';
            else if (file.type.startsWith('video/')) tipo = 'video';
            else if (file.type.startsWith('audio/')) tipo = 'audio';

            MessageModule.emitir(tipo, file.name, data, ext);
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Reset
    }
};

const StickerModule = {
    toggle() {
        document.getElementById('stickerPanel').classList.toggle('hidden');
    },
    enviar(sticker) {
        MessageModule.emitir('sticker', '', sticker);
        this.toggle();
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

        let deviceToken = localStorage.getItem('deviceToken');
        if (!deviceToken) {
            deviceToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('deviceToken', deviceToken);
        }
        State.miToken = deviceToken;

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
    
    const sendBtn = document.getElementById('sendBtn');
    const msgInput = document.getElementById('messageInput');

    msgInput.addEventListener('input', () => {
        TypingModule.manejar();
        if (msgInput.value.trim().length > 0) {
            sendBtn.classList.remove('hidden');
            document.getElementById('micBtn').classList.add('hidden');
        } else {
            sendBtn.classList.add('hidden');
            document.getElementById('micBtn').classList.remove('hidden');
        }
    });

    sendBtn.addEventListener('click', () => {
        MessageModule.enviar();
        sendBtn.classList.add('hidden');
        document.getElementById('micBtn').classList.remove('hidden');
    });

    msgInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            MessageModule.enviar();
            sendBtn.classList.add('hidden');
            document.getElementById('micBtn').classList.remove('hidden');
        }
    });

    // Multimedia Event Listeners
    document.getElementById('stickerBtn').addEventListener('click', () => StickerModule.toggle());
    document.getElementById('attachBtn').addEventListener('click', () => MediaModule.seleccionarArchivo());
    document.getElementById('mediaInput').addEventListener('change', e => MediaModule.procesarArchivo(e));
    document.getElementById('micBtn').addEventListener('click', () => MediaModule.alternarGrabacion());

    document.querySelectorAll('.sticker-item').forEach(item => {
        item.addEventListener('click', () => StickerModule.enviar(item.dataset.sticker));
    });
});
