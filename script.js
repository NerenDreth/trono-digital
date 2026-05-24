// Al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    fetchTrono();
    actualizarUIPorSesion();
});

function actualizarUIPorSesion() {
    const username = localStorage.getItem('username');
    const authContainer = document.getElementById('authContainer');
    const modal = document.getElementById('loginModal');
    
    if (username) {
        authContainer.innerHTML = `
            <span style="font-weight:900; color: #6c5ce7;">👑 ${username.toUpperCase()}</span>
            <button class="btn-nav" onclick="window.location.href='historial.html'">📜 Historial</button>
            <button class="btn-nav" onclick="logout()" style="margin-left:15px;">Salir</button>
        `;
        
        if (modal) modal.style.display = 'none';
        mostrarSaldo();
        
        // ✅ CARGAR PUBLICACIONES Y VERIFICAR SI ES REY
        cargarPublicaciones();
        verificarSiEsRey();
    } else {
        authContainer.innerHTML = `
            <button class="btn-nav" onclick="toggleModal()">Entrar</button>
            <button class="btn-nav" style="border-color: #6c5ce7;" onclick="window.location.href='registro.html'">Unirse</button>
        `;
        // Si no hay sesión, igual mostrar publicaciones (solo lectura)
        cargarPublicaciones();
    }
}

function logout() {
    localStorage.clear();
    location.reload();
}

function toggleModal() {
    const modal = document.getElementById('loginModal');
    const username = localStorage.getItem('username');
    
    // Si ya está logueado, no mostrar el modal
    if (username) {
        alert("Ya has iniciado sesión como " + username);
        return;
    }
    
    // Alternar visibilidad del modal
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex';
    }
}

function fetchTrono() {
    fetch('/api/trono')
        .then(res => res.json())
        .then(trono => {
            const nombreRey = trono.rey_actual.username || "NADIE";
            document.getElementById('reyNombre').innerText = nombreRey.toUpperCase();
            document.getElementById('reyPrecio').innerText = `$${trono.precio_actual.toFixed(2)}`;
            
            const proximo = trono.precio_actual * 2;
            document.getElementById('detallesPrecio').innerHTML = `💰 Precio para derrocar: $${proximo.toFixed(2)}`;
        })
        .catch(err => console.error("Error fetch trono:", err));
}

// Login
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(this));

    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(resData => {
        if(resData.status === "success") {
            localStorage.setItem('username', resData.username);
            localStorage.setItem('userId', resData.id);
            
            // Cerrar modal
            document.getElementById('loginModal').style.display = 'none';
            // Actualizar UI
            actualizarUIPorSesion();
            // Recargar datos del trono
            fetchTrono();
        } else {
            alert("Credenciales incorrectas.");
        }
    }).catch(() => alert("Error al conectar con el servidor Node.js"));
});

// Derrocar
async function derrocar() {
    const userId = localStorage.getItem('userId');
    
    if (!userId) {
        alert("Debes iniciar sesión para derrocar al rey.");
        toggleModal();
        return;
    }
    
    const btn = document.getElementById('btnDerrocar');
    const textoOriginal = btn.innerText;
    btn.innerText = "⚔️ DERRROCANDO... ⚔️";
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/derrocar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`✨ ¡${result.nuevoRey.toUpperCase()} ha tomado el trono! ✨\n\n👑 Nuevo precio: $${result.nuevoPrecio.toFixed(2)}\n💰 Tu saldo restante: $${result.saldoRestante.toFixed(2)}`);
            fetchTrono();
            
            // Actualizar saldo
            const userRes = await fetch(`/api/user/${userId}`);
            const userData = await userRes.json();
            localStorage.setItem('saldo', userData.saldo);
        } else {
            alert(`❌ Derrocamiento fallido: ${result.error}`);
        }
    } catch (err) {
        console.error("Error:", err);
        alert("Error al conectar con el servidor.");
    } finally {
        btn.innerText = textoOriginal;
        btn.disabled = false;
    }
}

// Conectar botón derrocar
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnDerrocar');
    if (btn) btn.onclick = derrocar;
});

// Recargar saldo
async function recargarSaldo() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert("Inicia sesión primero");
        return;
    }
    
    const response = await fetch('/api/add-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount: 50 })
    });
    
    const result = await response.json();
    if (result.success) {
        alert(`💰 Nuevo saldo: $${result.nuevoSaldo.toFixed(2)}`);
        location.reload();
    }
}

async function mostrarSaldo() {
    const userId = localStorage.getItem('userId');
    if (userId) {
        try {
            const response = await fetch(`/api/user/${userId}`);
            const user = await response.json();
            const saldoSpan = document.getElementById('miSaldo');
            if (saldoSpan) saldoSpan.innerText = `$${user.saldo.toFixed(2)}`;
        } catch (err) {
            console.error("Error al obtener saldo:", err);
        }
    }
}

// ========== FUNCIONES DE PUBLICACIONES ==========

// Cargar y mostrar publicaciones
async function cargarPublicaciones() {
    const contenedor = document.getElementById('listaPublicaciones');
    if (!contenedor) return;
    
    try {
        const response = await fetch('/api/publicaciones');
        const publicaciones = await response.json();
        
        if (publicaciones.length === 0) {
            contenedor.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-light);">📭 Aún no hay mensajes en el trono. ¡El rey puede publicar!</div>';
            return;
        }
        
        let html = '';
        for (const pub of publicaciones) {
            const fecha = new Date(pub.fecha).toLocaleString('es-ES');
            const esAutorOMiPublicacion = (localStorage.getItem('userId') === pub.rey_id);
            
            let contenidoHtml = '';
            if (pub.tipo === 'enlace' && pub.enlace) {
                // Si es un enlace, mostrarlo embebido o como link
                if (pub.enlace.includes('youtube.com/watch') || pub.enlace.includes('youtu.be')) {
                    // Embed de YouTube
                    let videoId = pub.enlace.split('v=')[1]?.split('&')[0] || pub.enlace.split('/').pop();
                    contenidoHtml = `
                        <div style="margin-top: 8px;">
                            <iframe width="100%" height="180" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen style="border-radius: 12px;"></iframe>
                        </div>
                    `;
                } else {
                    contenidoHtml = `<div style="margin-top: 8px;"><a href="${pub.enlace}" target="_blank" style="color: var(--cyan-neon);">🔗 ${pub.enlace}</a></div>`;
                }
            }
            
            html += `
                <div class="publicacion-item" style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 12px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div>
                            <strong style="color: #7b2cbf;">👑 ${pub.rey_username}</strong>
                            <span style="font-size: 0.7rem; color: var(--text-light); margin-left: 10px;">${fecha}</span>
                        </div>
                        ${esAutorOMiPublicacion ? `<button onclick="eliminarPublicacion('${pub._id}')" style="background: none; border: none; color: #ff4444; cursor: pointer;">🗑️</button>` : ''}
                    </div>
                    <div style="word-wrap: break-word;">${escapeHtml(pub.contenido)}</div>
                    ${contenidoHtml}
                </div>
            `;
        }
        contenedor.innerHTML = html;
        
    } catch (err) {
        console.error("Error cargando publicaciones:", err);
        contenedor.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">❌ Error al cargar mensajes</div>';
    }
}

// Función para escapar HTML (seguridad)
function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

// Publicar en el trono
async function publicarEnTrono() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert("Debes iniciar sesión para publicar");
        return;
    }
    
    const contenido = document.getElementById('contenidoPublicacion').value.trim();
    const enlace = document.getElementById('enlacePublicacion').value.trim();
    
    if (!contenido) {
        alert("Escribe un mensaje");
        return;
    }
    
    const tipo = enlace ? 'enlace' : 'texto';
    
    try {
        const response = await fetch('/api/publicar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, contenido, tipo, enlace: enlace || null })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert("✅ Mensaje publicado en el trono");
            document.getElementById('contenidoPublicacion').value = '';
            document.getElementById('enlacePublicacion').value = '';
            cargarPublicaciones(); // Recargar
        } else {
            alert("❌ " + result.error);
        }
    } catch (err) {
        console.error("Error:", err);
        alert("Error al publicar");
    }
}

// Eliminar publicación
async function eliminarPublicacion(publicacionId) {
    if (!confirm("¿Eliminar este mensaje?")) return;
    
    const userId = localStorage.getItem('userId');
    
    try {
        const response = await fetch(`/api/publicaciones/${publicacionId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        
        const result = await response.json();
        if (result.success) {
            cargarPublicaciones();
        } else {
            alert("❌ " + result.error);
        }
    } catch (err) {
        alert("Error al eliminar");
    }
}

// Mostrar/ocultar formulario de publicación según si es rey
async function verificarSiEsRey() {
    const userId = localStorage.getItem('userId');
    const formPublicar = document.getElementById('formPublicar');
    
    if (!userId || !formPublicar) return;
    
    try {
        const response = await fetch('/api/trono');
        const trono = await response.json();
        
        const esRey = trono.rey_actual.user_id && trono.rey_actual.user_id.toString() === userId;
        formPublicar.style.display = esRey ? 'block' : 'none';
    } catch (err) {
        console.error("Error verificando rey:", err);
    }
}

// Cambiar foto de perfil
async function cambiarFotoPerfil() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert("Inicia sesión para cambiar tu foto");
        return;
    }
    
    const nuevaFoto = prompt("Pega la URL de tu nueva foto de perfil:", localStorage.getItem('foto_perfil') || "");
    if (nuevaFoto && nuevaFoto.trim()) {
        try {
            const response = await fetch('/api/actualizar-foto', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, fotoUrl: nuevaFoto })
            });
            const result = await response.json();
            if (result.success) {
                localStorage.setItem('foto_perfil', result.foto_perfil);
                actualizarFotoEnPagina();
            }
        } catch (err) {
            alert("Error al actualizar foto");
        }
    }
}

function actualizarFotoEnPagina() {
    const foto = localStorage.getItem('foto_perfil') || "https://img.freepik.com/vector-premium/caricatura-rey-su-corona_167995-623.jpg";
    const imgElement = document.querySelector('.portrait-img');
    if (imgElement) imgElement.src = foto;
}

// Modificar la función que carga el usuario para también guardar la foto
async function mostrarSaldo() {
    const userId = localStorage.getItem('userId');
    if (userId) {
        try {
            const response = await fetch(`/api/user/${userId}`);
            const user = await response.json();
            const saldoSpan = document.getElementById('miSaldo');
            if (saldoSpan) saldoSpan.innerText = `$${user.saldo.toFixed(2)}`;
            
            // Guardar foto de perfil
            if (user.foto_perfil) {
                localStorage.setItem('foto_perfil', user.foto_perfil);
                actualizarFotoEnPagina();
            }
        } catch (err) {
            console.error("Error al obtener saldo:", err);
        }
    }
}

