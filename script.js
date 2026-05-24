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
        // Usuario logueado - muestra nombre, historial y salir
        authContainer.innerHTML = `
            <span style="font-weight:900; color: #6c5ce7;">👑 ${username.toUpperCase()}</span>
            <button class="btn-nav" onclick="window.location.href='historial.html'">📜 Historial</button>
            <button class="btn-nav" onclick="logout()" style="margin-left:15px;">Salir</button>
        `;
        
        if (modal) modal.style.display = 'none';
        mostrarSaldo();
    } else {
        // Usuario no logueado
        authContainer.innerHTML = `
            <button class="btn-nav" onclick="toggleModal()">Entrar</button>
            <button class="btn-nav" style="border-color: #6c5ce7;" onclick="window.location.href='registro.html'">Unirse</button>
        `;
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

