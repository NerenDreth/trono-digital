const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const bcrypt = require('bcrypt');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ✅ CONEXIÓN CORRECTA (TODO EN UNA SOLA LÍNEA dentro del connect)
mongoose.connect('mongodb+srv://luisomarez_db_user:GEfmJDj2wJZm3Ka8@trono-cluster.qvzibea.mongodb.net/trono_db?retryWrites=true&w=majority')
    .then(() => console.log('Conectado exitosamente a MongoDB'))
    .catch(err => console.error('Error al conectar MongoDB:', err));

// ... el resto de tu código (modelos, rutas, etc.)
// MODELOS DE DATOS (Esquemas NoSQL con relaciones embebidas)
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    saldo: { type: Number, default: 0.00 }
}, { versionKey: false });

const ThroneSchema = new mongoose.Schema({
    id_trono: { type: String, default: "principal" },
    rey_actual: {
        user_id: mongoose.Schema.Types.ObjectId,
        username: { type: String, default: "NADIE" }
    },
    precio_actual: { type: Number, default: 1.00 }
}, { versionKey: false });

// MODELO DE TRANSACCIONES
const TransactionSchema = new mongoose.Schema({
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tipo: { type: String, enum: ['derrocamiento', 'reembolso', 'recarga'] },
    monto: Number,
    descripcion: String,
    fecha: { type: Date, default: Date.now }
}, { versionKey: false });

// MODELO DE PUBLICACIONES DEL TRONO
const PublicacionSchema = new mongoose.Schema({
    rey_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rey_username: { type: String, required: true },
    contenido: { type: String, required: true },
    tipo: { type: String, default: 'texto' }, // texto, enlace
    enlace: { type: String }, // si es un enlace (YouTube, etc.)
    fecha: { type: Date, default: Date.now }
}, { versionKey: false });

const Publicacion = mongoose.model('Publicacion', PublicacionSchema);

const User = mongoose.model('User', UserSchema);
const Throne = mongoose.model('Throne', ThroneSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);

// ========== RUTAS / ENDPOINTS API ==========

// 1. Obtener estado del Trono
app.get('/api/trono', async (req, res) => {
    try {
        let trono = await Throne.findOne({ id_trono: "principal" });
        if (!trono) {
            trono = await Throne.create({ id_trono: "principal" });
        }
        res.json(trono);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 2. Registro de Usuarios (con bcrypt)
app.post('/api/registro', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Verificar si ya existe
        const existe = await User.findOne({ $or: [{ email }, { username }] });
        if (existe) {
            return res.send("El usuario o email ya existe.");
        }
        
        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const nuevoUsuario = new User({ 
            username, 
            email, 
            password: hashedPassword, 
            saldo: 50.00 
        });
        
        await nuevoUsuario.save();
        res.send("success");
    } catch (err) {
        console.error(err);
        res.send("Error en el registro");
    }
});

// 3. Login de Usuarios (con bcrypt)
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const usuario = await User.findOne({ email });
        
        if (usuario && await bcrypt.compare(password, usuario.password)) {
            res.json({ status: "success", username: usuario.username, id: usuario._id });
        } else {
            res.json({ status: "error", message: "Credenciales incorrectas" });
        }
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

// 4. Derrocar al rey (SIN transacciones - para MongoDB standalone)
app.post('/api/derrocar', async (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: "Usuario no identificado" });
    }
    
    try {
        const usurpador = await User.findById(userId);
        if (!usurpador) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        let trono = await Throne.findOne({ id_trono: "principal" });
        if (!trono) {
            trono = await Throne.create({ id_trono: "principal", precio_actual: 1.00 });
        }
        
        // Validación: No derrocarse a sí mismo
        if (trono.rey_actual.user_id && trono.rey_actual.user_id.toString() === userId) {
            return res.status(400).json({ error: "¡No puedes derrocarte a ti mismo!" });
        }
        
        const precioActual = trono.precio_actual;
        const precioDerrocamiento = precioActual * 2;
        
        if (usurpador.saldo < precioDerrocamiento) {
            return res.status(400).json({ 
                error: `Saldo insuficiente. Necesitas $${precioDerrocamiento.toFixed(2)}, tienes $${usurpador.saldo.toFixed(2)}` 
            });
        }
        
        let reyAnterior = null;
        let reembolso = 0;
        if (trono.rey_actual.user_id) {
            reyAnterior = await User.findById(trono.rey_actual.user_id);
            reembolso = precioActual / 2;
        }
        
        // === OPERACIONES ATÓMICAS SIMULADAS ===
        // Como no tenemos transacciones, hacemos las operaciones en orden
        // y verificamos que no haya errores intermedios
        
        // 1. Cobrar al usurpador
        usurpador.saldo -= precioDerrocamiento;
        await usurpador.save();
        
        // 2. Reembolsar al rey anterior (si existe)
        if (reyAnterior) {
            reyAnterior.saldo += reembolso;
            await reyAnterior.save();
        }
        
        // 3. Actualizar el trono
        trono.precio_actual = precioDerrocamiento;
        trono.rey_actual = {
            user_id: usurpador._id,
            username: usurpador.username
        };
        await trono.save();
        
        // Guardar transacciones en historial
        if (Transaction) {
            const transaccionDerrocar = new Transaction({
                usuario_id: usurpador._id,
                tipo: 'derrocamiento',
                monto: precioDerrocamiento,
                descripcion: `Derrocó a ${reyAnterior ? reyAnterior.username : 'NADIE'} por $${precioDerrocamiento}`
            });
            await transaccionDerrocar.save();
            
            if (reyAnterior) {
                const transaccionReembolso = new Transaction({
                    usuario_id: reyAnterior._id,
                    tipo: 'reembolso',
                    monto: reembolso,
                    descripcion: `Recibió reembolso por ser destronado: $${reembolso}`
                });
                await transaccionReembolso.save();
            }
        }
        
        res.json({
            success: true,
            nuevoRey: usurpador.username,
            nuevoPrecio: precioDerrocamiento,
            saldoRestante: usurpador.saldo,
            reembolso: reyAnterior ? `Se reembolsaron $${reembolso.toFixed(2)} a ${reyAnterior.username}` : "Primer rey, sin reembolso"
        });
        
    } catch (err) {
        console.error("Error en derrocamiento:", err);
        res.status(500).json({ error: "Error interno: " + err.message });
    }
});

// 5. Agregar saldo (para pruebas)
app.post('/api/add-funds', async (req, res) => {
    const { userId, amount } = req.body;
    
    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
        
        user.saldo += amount;
        await user.save();
        
        // Guardar transacción de recarga
        const transaccion = new Transaction({
            usuario_id: user._id,
            tipo: 'recarga',
            monto: amount,
            descripcion: `Recarga de saldo: $${amount}`
        });
        await transaccion.save();
        
        res.json({ success: true, nuevoSaldo: user.saldo });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Obtener usuario por ID
app.get('/api/user/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Obtener historial de transacciones
app.get('/api/historial', async (req, res) => {
    try {
        const historial = await Transaction.find()
            .sort({ fecha: -1 })
            .limit(20)
            .populate('usuario_id', 'username');
        res.json(historial);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== RUTAS DE PUBLICACIONES ==========

// 8. Obtener todas las publicaciones del trono
app.get('/api/publicaciones', async (req, res) => {
    try {
        const publicaciones = await Publicacion.find()
            .sort({ fecha: -1 })
            .limit(30);
        res.json(publicaciones);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 9. El rey publica un mensaje (solo si ES el rey actual)
app.post('/api/publicar', async (req, res) => {
    const { userId, contenido, tipo, enlace } = req.body;
    
    if (!userId || !contenido) {
        return res.status(400).json({ error: "Faltan datos" });
    }
    
    try {
        // Verificar que el usuario existe
        const usuario = await User.findById(userId);
        if (!usuario) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        // Verificar que el usuario ES el rey actual
        const trono = await Throne.findOne({ id_trono: "principal" });
        if (!trono || trono.rey_actual.user_id?.toString() !== userId) {
            return res.status(403).json({ error: "Solo el rey actual puede publicar en el trono" });
        }
        
        // Crear la publicación
        const nuevaPublicacion = new Publicacion({
            rey_id: userId,
            rey_username: usuario.username,
            contenido: contenido,
            tipo: tipo || 'texto',
            enlace: enlace || null
        });
        
        await nuevaPublicacion.save();
        
        res.json({ 
            success: true, 
            mensaje: "Publicado en el trono",
            publicacion: nuevaPublicacion
        });
        
    } catch (err) {
        console.error("Error al publicar:", err);
        res.status(500).json({ error: "Error al publicar: " + err.message });
    }
});

// 10. Eliminar publicación (solo el rey actual o el que publicó)
app.delete('/api/publicaciones/:id', async (req, res) => {
    const { userId } = req.body;
    const publicacionId = req.params.id;
    
    try {
        const publicacion = await Publicacion.findById(publicacionId);
        if (!publicacion) {
            return res.status(404).json({ error: "Publicación no encontrada" });
        }
        
        // Verificar que quien borra es el rey actual O el autor
        const trono = await Throne.findOne({ id_trono: "principal" });
        const esReyActual = trono?.rey_actual.user_id?.toString() === userId;
        const esAutor = publicacion.rey_id.toString() === userId;
        
        if (!esReyActual && !esAutor) {
            return res.status(403).json({ error: "No tienes permiso para borrar esto" });
        }
        
        await Publicacion.findByIdAndDelete(publicacionId);
        res.json({ success: true, mensaje: "Publicación eliminada" });
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Levantar Servidor
app.listen(3000, () => {
    console.log('Servidor corriendo en http://localhost:3000');
});