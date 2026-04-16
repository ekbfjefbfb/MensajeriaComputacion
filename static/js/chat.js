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
    ultimaHoraMensaje: null,
    bibliotecaArchivos: []
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
    toast(emoji, duracion = 1500) {
        const t = document.createElement('div');
        t.className = 'toast-feedback';
        t.textContent = emoji;
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('visible'));
        setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 300); }, duracion);
    },
    validarNombre(nombre) {
        return /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ][a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]*$/.test(nombre);
    },
    formatearTamano(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },
    getIconoArchivo(ext) {
        const iconMap = {
            'pdf': '<svg width="24" viewBox="0 0 24 24"><path fill="#FF4444" d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>',
            'doc': '<svg width="24" viewBox="0 0 24 24"><path fill="#2B579A" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
            'docx': '<svg width="24" viewBox="0 0 24 24"><path fill="#2B579A" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
            'xls': '<svg width="24" viewBox="0 0 24 24"><path fill="#217346" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
            'xlsx': '<svg width="24" viewBox="0 0 24 24"><path fill="#217346" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>'
        };
        return iconMap[ext.toLowerCase()] || '<svg width="24" viewBox="0 0 24 24"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z"/></svg>';
    },
    scrollToBottom() {
        const c = document.getElementById('messagesContainer');
        c.scrollTop = c.scrollHeight;
    },
    abrirVisor(src) {
        const overlay = document.createElement('div');
        overlay.className = 'lightbox-overlay';
        overlay.innerHTML = `
            <div class="lightbox-content">
                <img src="${src}" alt="Vista previa">
                <button class="lightbox-close">&times;</button>
            </div>
        `;
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target.classList.contains('lightbox-close')) {
                overlay.remove();
            }
        });
        document.body.appendChild(overlay);
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
                avatar: State.miAvatar,
                token: State.miToken
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

        socket.on('sesion_duplicada', (data) => {
            socket.disconnect();
            document.body.innerHTML = `
                <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; background:#000; color:#fff; text-align:center; padding:20px;">
                    <div style="font-size:4rem; margin-bottom:20px;">⚠️</div>
                    <h1 style="font-size:1.5rem; margin-bottom:10px;">Sesión Detenida</h1>
                    <p style="color:#a1a1aa; max-width:400px; line-height:1.5;">${data.message}<br>Solo puedes tener el chat abierto en una pestaña a la vez por seguridad y rendimiento.</p>
                    <button onclick="window.location.reload()" style="margin-top:24px; padding:12px 24px; background:#007aff; color:#fff; border:none; border-radius:24px; cursor:pointer; font-weight:600;">Usar en esta pestaña</button>
                </div>
            `;
        });

        socket.on('error', (data) => {
            Utils.mostrarError('⚠️ ' + (data.message || 'Error'));
            document.getElementById('joinBtn').disabled = false;
        });

        socket.on('nuevo_mensaje', (data) => {
            State.mensajesGlobales.push(data);
            // Si es nuestro propio mensaje, ya lo renderizamos optimísticamente
            if (data.nombre === State.miNombre) return;
            if (!State.chatPrivado) {
                MessageModule.agregar(data, false, false, true);
            } else {
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
    emitir(tipo, mensaje, archivo = null, ext = '', nombre_real = '', tamano = '') {
        if (!State.socket) return;
        
        const payload = { tipo, mensaje, archivo, ext, nombre_real, tamano };
        
        if (State.chatPrivado) {
            const destSid = UserModule.getSid(State.chatPrivado.nombre);
            if (destSid) {
                payload.destinatario_sid = destSid;
                State.socket.emit('mensaje_privado', payload);
                const msgData = {
                    nombre: State.miNombre,
                    mensaje, color: State.miColor, avatar: State.miAvatar, 
                    hora: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                    esPrivado: true, tipo, archivo, ext, nombre_real, tamano
                };
                if (!State.mensajesPrivados[State.chatPrivado.nombre]) State.mensajesPrivados[State.chatPrivado.nombre] = [];
                State.mensajesPrivados[State.chatPrivado.nombre].push(msgData);
                MessageModule.agregar(msgData, true);
                if (archivo) LibraryModule.registrar(msgData);
            }
        } else {
            // Renderizado optimista instantáneo para el remitente
            const previewData = {
                nombre: State.miNombre,
                mensaje, color: State.miColor, avatar: State.miAvatar,
                hora: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                tipo, archivo, ext, nombre_real, tamano
            };
            MessageModule.agregar(previewData, true, false, true);
            State.socket.emit('mensaje', payload);
            State.socket.emit('escribiendo', { escribiendo: false });
        }
    },
    agregar(data, esPropio = false, historico = false, esGlobal = false) {
        if (!data.hora) data.hora = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        if (data.archivo) LibraryModule.registrar(data);
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
        
        // Si es multimedia puro sin texto, limpiamos el diseño
        if (!data.mensaje || data.mensaje.trim() === '') {
            if (['imagen', 'sticker', 'video'].includes(data.tipo)) {
                burbuja.classList.add('media-only');
            }
        }
        
        let contentHtml = '';
        const safeText = Utils.escapeHtml(data.mensaje);
        const linkifiedText = safeText.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:inherit; text-decoration:underline">$1</a>');

        switch(data.tipo) {
            case 'imagen':
                contentHtml = `<img src="${data.archivo}" alt="Imagen" onclick="Utils.abrirVisor(this.src)">`;
                if (data.mensaje && data.mensaje.trim()) contentHtml += `<span>${linkifiedText}</span>`;
                break;
            case 'audio':
                contentHtml = `<audio src="${data.archivo}" controls preload="metadata"></audio>`;
                break;
            case 'video':
                contentHtml = `<video src="${data.archivo}" controls preload="metadata" playsinline></video>`;
                if (data.mensaje && data.mensaje.trim()) contentHtml += `<span>${linkifiedText}</span>`;
                break;
            case 'sticker':
                contentHtml = `<img src="${data.archivo}" class="gif-sticker" alt="Sticker">`;
                break;
            case 'documento':
                const icon = Utils.getIconoArchivo(data.ext);
                contentHtml = `<a href="${data.archivo}" download="${data.nombre_real || 'archivo'}.${data.ext}" class="doc-link">
                    ${icon}
                    <div style="display:flex; flex-direction:column">
                        <span style="font-weight:600">${data.nombre_real || 'Documento'}</span>
                        <span style="font-size:0.7rem; opacity:0.8">${data.tamano || ''}</span>
                    </div>
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
        const micBtn = document.getElementById('micBtn');
        if (!State.mediaRecorder || State.mediaRecorder.state === 'inactive') {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                State.mediaRecorder = new MediaRecorder(stream);
                State.audioChunks = [];
                
                State.mediaRecorder.ondataavailable = e => State.audioChunks.push(e.data);
                State.mediaRecorder.onstop = () => this.enviarVoz();
                
                State.mediaRecorder.start();
                micBtn.classList.add('recording');
                // Cambiar icono a STOP (cuadrado)
                micBtn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>';
                Utils.toast('🎙️');
                setTimeout(() => { if(State.mediaRecorder && State.mediaRecorder.state === 'recording') this.alternarGrabacion(); }, 30000);
            } catch (err) {
                Utils.toast('🚫');
            }
        } else {
            State.mediaRecorder.stop();
            micBtn.classList.remove('recording');
            // Restaurar icono de micrófono
            micBtn.innerHTML = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path fill="currentColor" d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>';
            State.mediaRecorder.stream.getTracks().forEach(t => t.stop());
            Utils.toast('✅');
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

        if (file.size > 2 * 1024 * 1024) {
            Utils.toast('⚠️');
            return Utils.mostrarError("Archivo demasiado grande (Máx 2MB)");
        }

        Utils.toast('📎');
        const reader = new FileReader();
        reader.onload = (ev) => {
            const data = ev.target.result;
            const ext = file.name.split('.').pop().toLowerCase();
            const tamano = Utils.formatearTamano(file.size);
            let tipo = 'documento';
            
            if (file.type.startsWith('image/')) tipo = 'imagen';
            else if (file.type.startsWith('video/')) tipo = 'video';
            else if (file.type.startsWith('audio/')) tipo = 'audio';

            MessageModule.emitir(tipo, '', data, ext, file.name, tamano);
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Reset
    }
};

const LibraryModule = {
    registrar(data) {
        if (!data.archivo || data.tipo === 'sticker') return;
        
        // Evitar duplicados (por hash de base64 simplificado o nombre)
        const existe = State.bibliotecaArchivos.some(a => a.archivo === data.archivo);
        if (existe) return;

        State.bibliotecaArchivos.push(data);
        this.renderizar();
    },
    renderizar() {
        const listContainer = document.getElementById('mediaLibraryList');
        if (State.bibliotecaArchivos.length === 0) {
            listContainer.innerHTML = '<div class="empty-library">No hay archivos compartidos aún.</div>';
            return;
        }

        listContainer.innerHTML = State.bibliotecaArchivos.map(file => `
            <div class="library-item">
                <div class="lib-file-info">
                    <div class="lib-icon">${Utils.getIconoArchivo(file.ext)}</div>
                    <div class="lib-details">
                        <span class="lib-name" title="${file.nombre_real || 'Archivo'}">${file.nombre_real || 'Archivo'}</span>
                        <span class="lib-meta">${file.tamano || ''} • ${file.nombre}</span>
                    </div>
                </div>
                <a href="${file.archivo}" download="${file.nombre_real || 'archivo'}.${file.ext}" class="lib-download">Descargar</a>
            </div>
        `).join('');
    },
    toggle() {
        document.getElementById('mediaDrawer').classList.toggle('hidden');
    }
};

const StickerModule = {
    toggle() {
        document.getElementById('stickerPanel').classList.toggle('hidden');
    },
    enviar(url) {
        MessageModule.emitir('sticker', '', url);
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
            indicator.innerHTML = `${data.nombre} <span class="typing-dots"><span></span><span></span><span></span></span>`;
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
    document.getElementById('stickerBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        StickerModule.toggle();
    });
    
    document.getElementById('openLibraryBtn').addEventListener('click', () => LibraryModule.toggle());
    document.getElementById('closeDrawerBtn').addEventListener('click', () => LibraryModule.toggle());
    
    document.getElementById('attachBtn').addEventListener('click', () => MediaModule.seleccionarArchivo());
    document.getElementById('mediaInput').addEventListener('change', e => MediaModule.procesarArchivo(e));
    document.getElementById('micBtn').addEventListener('click', () => MediaModule.alternarGrabacion());

    document.querySelectorAll('.sticker-item').forEach(item => {
        const img = document.createElement('img');
        img.src = item.dataset.sticker;
        item.innerHTML = '';
        item.appendChild(img);
        item.addEventListener('click', () => StickerModule.enviar(item.dataset.sticker));
    });

    // Cerrar paneles al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!document.getElementById('stickerPanel').contains(e.target) && e.target.id !== 'stickerBtn') {
            document.getElementById('stickerPanel').classList.add('hidden');
        }
    });
});
