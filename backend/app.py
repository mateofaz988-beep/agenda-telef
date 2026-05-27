from flask import Flask, jsonify, request
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
import bcrypt
import jwt
import os
import re
from datetime import datetime, timedelta
from functools import wraps
from dotenv import load_dotenv

# =====================================================
# CONFIGURACIÓN GENERAL
# =====================================================

load_dotenv()

app = Flask(__name__)
CORS(app)

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "agenda_telefonica_inamhi")
DB_PORT = int(os.getenv("DB_PORT", 3306))

JWT_SECRET = os.getenv("JWT_SECRET", "agenda_inamhi_secret_2026")
JWT_EXP_HOURS = int(os.getenv("JWT_EXP_HOURS", 8))

FLASK_HOST = os.getenv("FLASK_HOST", "127.0.0.1")
FLASK_PORT = int(os.getenv("FLASK_PORT", 5050))
FLASK_DEBUG = os.getenv("FLASK_DEBUG", "True").lower() == "true"


# =====================================================
# CONEXIÓN MYSQL
# =====================================================

def get_connection():
    return mysql.connector.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        port=DB_PORT
    )


def ejecutar_consulta(query, params=None, fetchone=False, fetchall=False, commit=False):
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, params or ())

        if commit:
            connection.commit()
            return cursor.lastrowid

        if fetchone:
            return cursor.fetchone()

        if fetchall:
            return cursor.fetchall()

        return None

    except Error as e:
        print("Error MySQL:", e)
        raise e

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# =====================================================
# RESPUESTAS
# =====================================================

def respuesta_ok(message="Operación correcta.", data=None, status=200):
    response = {
        "success": True,
        "message": message
    }

    if data is not None:
        response["data"] = data

    return jsonify(response), status


def respuesta_error(message="Error en la operación.", status=400):
    return jsonify({
        "success": False,
        "message": message
    }), status


# =====================================================
# SEGURIDAD
# =====================================================

def generar_hash_password(password):
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verificar_password(password, password_hash):
    return bcrypt.checkpw(
        password.encode("utf-8"),
        password_hash.encode("utf-8")
    )


def generar_token(admin):
    payload = {
        "id": admin["id"],
        "usuario": admin["usuario"],
        "correo": admin["correo"],
        "rol": "ADMINISTRADOR",
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXP_HOURS)
    }

    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def token_requerido(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")

        if not auth_header:
            return respuesta_error("Token no enviado.", 401)

        try:
            token = auth_header.split(" ")[1]
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])

            admin = ejecutar_consulta(
                """
                select id, nombres, apellidos, usuario, correo, estado, ultimo_acceso
                from administradores
                where id = %s and estado = 'activo'
                """,
                (data["id"],),
                fetchone=True
            )

            if not admin:
                return respuesta_error("Administrador no autorizado.", 401)

            request.admin = admin

        except jwt.ExpiredSignatureError:
            return respuesta_error("Token expirado.", 401)

        except Exception:
            return respuesta_error("Token inválido.", 401)

        return f(*args, **kwargs)

    return decorated


# =====================================================
# VALIDACIONES
# =====================================================

def validar_email(email):
    if not email:
        return True

    patron = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    return re.match(patron, email) is not None


def validar_telefono(telefono):
    patron = r"^[0-9\s\-\(\)\+]+$"
    return re.match(patron, telefono) is not None


def validar_extension(extension):
    if not extension:
        return True

    return extension.isdigit()


def validar_estado(estado):
    return estado in ["activo", "inactivo"]


def validar_contacto(data, editando=False):
    campos = [
        "nombres",
        "apellidos",
        "cargo",
        "unidad",
        "ciudad",
        "telefono"
    ]

    for campo in campos:
        if not data.get(campo) or not str(data.get(campo)).strip():
            return False, f"El campo {campo} es obligatorio."

    if not validar_telefono(data.get("telefono")):
        return False, "El teléfono solo puede contener números, espacios, guiones, paréntesis o +."

    if not validar_extension(data.get("extension")):
        return False, "La extensión solo puede contener números."

    if data.get("correo") and not validar_email(data.get("correo")):
        return False, "El correo no tiene un formato válido."

    estado = data.get("estado", "activo")
    if not validar_estado(estado):
        return False, "El estado solo puede ser activo o inactivo."

    return True, "Validación correcta."


def validar_admin(data, editando=False):
    campos = ["nombres", "apellidos", "usuario", "correo"]

    for campo in campos:
        if not data.get(campo) or not str(data.get(campo)).strip():
            return False, f"El campo {campo} es obligatorio."

    if not validar_email(data.get("correo")):
        return False, "El correo no tiene un formato válido."

    if not editando:
        if not data.get("password") or not str(data.get("password")).strip():
            return False, "La contraseña es obligatoria."

        if len(data.get("password")) < 6:
            return False, "La contraseña debe tener al menos 6 caracteres."

    estado = data.get("estado", "activo")
    if not validar_estado(estado):
        return False, "El estado solo puede ser activo o inactivo."

    return True, "Validación correcta."


# =====================================================
# RUTA DE PRUEBA
# =====================================================

@app.route("/api/test", methods=["GET"])
def test():
    return respuesta_ok("Backend Flask funcionando correctamente.", {
        "sistema": "Agenda Telefónica INAMHI",
        "backend": "Flask",
        "database": DB_NAME,
        "port": FLASK_PORT
    })


# =====================================================
# AUTH
# =====================================================

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    usuario = data.get("usuario", "").strip()
    password = data.get("password", "").strip()

    if not usuario or not password:
        return respuesta_error("Usuario y contraseña son obligatorios.", 400)

    admin = ejecutar_consulta(
        """
        select id, nombres, apellidos, usuario, correo, password_hash, estado
        from administradores
        where usuario = %s
        limit 1
        """,
        (usuario,),
        fetchone=True
    )

    if not admin:
        return respuesta_error("Credenciales incorrectas.", 401)

    if admin["estado"] != "activo":
        return respuesta_error("El usuario administrador está inactivo.", 403)

    if not verificar_password(password, admin["password_hash"]):
        return respuesta_error("Credenciales incorrectas.", 401)

    ejecutar_consulta(
        "update administradores set ultimo_acceso = now() where id = %s",
        (admin["id"],),
        commit=True
    )

    token = generar_token(admin)

    admin_data = {
        "id": admin["id"],
        "nombres": admin["nombres"],
        "apellidos": admin["apellidos"],
        "usuario": admin["usuario"],
        "correo": admin["correo"],
        "estado": admin["estado"],
        "rol": "ADMINISTRADOR"
    }

    return respuesta_ok("Inicio de sesión correcto.", {
        "token": token,
        "admin": admin_data
    })


@app.route("/api/auth/me", methods=["GET"])
@token_requerido
def auth_me():
    return respuesta_ok("Sesión válida.", {
        "admin": request.admin,
        "rol": "ADMINISTRADOR"
    })


# =====================================================
# CONTACTOS PÚBLICOS
# =====================================================

@app.route("/api/contactos", methods=["GET"])
def listar_contactos_publicos():
    contactos = ejecutar_consulta(
        """
        select id, nombres, apellidos, cargo, unidad, ciudad,
               telefono, extension, correo, estado, observacion,
               created_at, updated_at
        from contactos
        where estado = 'activo'
        order by apellidos asc, nombres asc
        """,
        fetchall=True
    )

    return jsonify(contactos), 200


@app.route("/api/contactos/<int:id>", methods=["GET"])
def obtener_contacto_publico(id):
    contacto = ejecutar_consulta(
        """
        select id, nombres, apellidos, cargo, unidad, ciudad,
               telefono, extension, correo, estado, observacion,
               created_at, updated_at
        from contactos
        where id = %s and estado = 'activo'
        """,
        (id,),
        fetchone=True
    )

    if not contacto:
        return respuesta_error("Contacto no encontrado.", 404)

    return jsonify(contacto), 200


@app.route("/api/contactos/buscar", methods=["GET"])
def buscar_contactos_publicos():
    q = request.args.get("q", "").strip()
    ciudad = request.args.get("ciudad", "").strip()

    sql = """
        select id, nombres, apellidos, cargo, unidad, ciudad,
               telefono, extension, correo, estado, observacion,
               created_at, updated_at
        from contactos
        where estado = 'activo'
    """

    params = []

    if q:
        sql += """
            and (
                nombres like %s or
                apellidos like %s or
                cargo like %s or
                unidad like %s or
                ciudad like %s or
                telefono like %s or
                extension like %s or
                correo like %s
            )
        """
        like = f"%{q}%"
        params.extend([like, like, like, like, like, like, like, like])

    if ciudad and ciudad.lower() != "todos":
        sql += " and ciudad = %s "
        params.append(ciudad)

    sql += " order by apellidos asc, nombres asc"

    contactos = ejecutar_consulta(sql, tuple(params), fetchall=True)

    return jsonify(contactos), 200


# =====================================================
# CONTACTOS ADMIN
# =====================================================

@app.route("/api/admin/contactos", methods=["GET"])
@token_requerido
def listar_contactos_admin():
    contactos = ejecutar_consulta(
        """
        select id, nombres, apellidos, cargo, unidad, ciudad,
               telefono, extension, correo, estado, observacion,
               created_at, updated_at
        from contactos
        order by id desc
        """,
        fetchall=True
    )

    return jsonify(contactos), 200


@app.route("/api/admin/contactos", methods=["POST"])
@token_requerido
def crear_contacto():
    data = request.get_json() or {}

    valido, mensaje = validar_contacto(data)

    if not valido:
        return respuesta_error(mensaje, 400)

    duplicado = ejecutar_consulta(
        """
        select id
        from contactos
        where 
            (correo is not null and correo <> '' and correo = %s)
            or
            (nombres = %s and apellidos = %s and telefono = %s)
        limit 1
        """,
        (
            data.get("correo"),
            data.get("nombres").strip(),
            data.get("apellidos").strip(),
            data.get("telefono").strip()
        ),
        fetchone=True
    )

    if duplicado:
        return respuesta_error("Ya existe un contacto con esos datos.", 409)

    contacto_id = ejecutar_consulta(
        """
        insert into contactos
        (
            nombres, apellidos, cargo, unidad, ciudad,
            telefono, extension, correo, estado, observacion
        )
        values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            data.get("nombres").strip(),
            data.get("apellidos").strip(),
            data.get("cargo").strip(),
            data.get("unidad").strip(),
            data.get("ciudad").strip(),
            data.get("telefono").strip(),
            data.get("extension", "").strip(),
            data.get("correo", "").strip(),
            data.get("estado", "activo"),
            data.get("observacion", "").strip()
        ),
        commit=True
    )

    return respuesta_ok("Contacto creado correctamente.", {
        "id": contacto_id
    }, 201)


@app.route("/api/admin/contactos/<int:id>", methods=["PUT"])
@token_requerido
def actualizar_contacto(id):
    data = request.get_json() or {}

    contacto = ejecutar_consulta(
        "select id from contactos where id = %s",
        (id,),
        fetchone=True
    )

    if not contacto:
        return respuesta_error("Contacto no encontrado.", 404)

    valido, mensaje = validar_contacto(data, editando=True)

    if not valido:
        return respuesta_error(mensaje, 400)

    duplicado = ejecutar_consulta(
        """
        select id
        from contactos
        where id <> %s
        and (
            (correo is not null and correo <> '' and correo = %s)
            or
            (nombres = %s and apellidos = %s and telefono = %s)
        )
        limit 1
        """,
        (
            id,
            data.get("correo"),
            data.get("nombres").strip(),
            data.get("apellidos").strip(),
            data.get("telefono").strip()
        ),
        fetchone=True
    )

    if duplicado:
        return respuesta_error("Ya existe otro contacto con esos datos.", 409)

    ejecutar_consulta(
        """
        update contactos
        set
            nombres = %s,
            apellidos = %s,
            cargo = %s,
            unidad = %s,
            ciudad = %s,
            telefono = %s,
            extension = %s,
            correo = %s,
            estado = %s,
            observacion = %s
        where id = %s
        """,
        (
            data.get("nombres").strip(),
            data.get("apellidos").strip(),
            data.get("cargo").strip(),
            data.get("unidad").strip(),
            data.get("ciudad").strip(),
            data.get("telefono").strip(),
            data.get("extension", "").strip(),
            data.get("correo", "").strip(),
            data.get("estado", "activo"),
            data.get("observacion", "").strip(),
            id
        ),
        commit=True
    )

    return respuesta_ok("Contacto actualizado correctamente.")


@app.route("/api/admin/contactos/<int:id>", methods=["DELETE"])
@token_requerido
def eliminar_contacto(id):
    contacto = ejecutar_consulta(
        "select id from contactos where id = %s",
        (id,),
        fetchone=True
    )

    if not contacto:
        return respuesta_error("Contacto no encontrado.", 404)

    ejecutar_consulta(
        "delete from contactos where id = %s",
        (id,),
        commit=True
    )

    return respuesta_ok("Contacto eliminado correctamente.")


@app.route("/api/admin/contactos/<int:id>/estado", methods=["PATCH"])
@token_requerido
def cambiar_estado_contacto(id):
    data = request.get_json() or {}

    estado = data.get("estado")

    if not validar_estado(estado):
        return respuesta_error("Estado inválido.", 400)

    contacto = ejecutar_consulta(
        "select id from contactos where id = %s",
        (id,),
        fetchone=True
    )

    if not contacto:
        return respuesta_error("Contacto no encontrado.", 404)

    ejecutar_consulta(
        "update contactos set estado = %s where id = %s",
        (estado, id),
        commit=True
    )

    return respuesta_ok("Estado actualizado correctamente.")


# =====================================================
# DASHBOARD ADMIN
# =====================================================

@app.route("/api/admin/dashboard/resumen", methods=["GET"])
@token_requerido
def resumen_dashboard():
    total = ejecutar_consulta(
        "select count(*) as total from contactos",
        fetchone=True
    )

    activos = ejecutar_consulta(
        "select count(*) as total from contactos where estado = 'activo'",
        fetchone=True
    )

    ciudades = ejecutar_consulta(
        "select count(distinct ciudad) as total from contactos",
        fetchone=True
    )

    unidades = ejecutar_consulta(
        "select count(distinct unidad) as total from contactos",
        fetchone=True
    )

    return jsonify({
        "total_contactos": total["total"],
        "contactos_activos": activos["total"],
        "ciudades_registradas": ciudades["total"],
        "unidades_registradas": unidades["total"]
    }), 200


# =====================================================
# CRUD ADMINISTRADORES
# =====================================================

@app.route("/api/admin/usuarios", methods=["GET"])
@token_requerido
def listar_admins():
    admins = ejecutar_consulta(
        """
        select id, nombres, apellidos, usuario, correo, estado,
               ultimo_acceso, created_at, updated_at
        from administradores
        order by id desc
        """,
        fetchall=True
    )

    return jsonify(admins), 200


@app.route("/api/admin/usuarios", methods=["POST"])
@token_requerido
def crear_admin():
    data = request.get_json() or {}

    valido, mensaje = validar_admin(data)

    if not valido:
        return respuesta_error(mensaje, 400)

    duplicado = ejecutar_consulta(
        """
        select id
        from administradores
        where usuario = %s or correo = %s
        limit 1
        """,
        (
            data.get("usuario").strip(),
            data.get("correo").strip()
        ),
        fetchone=True
    )

    if duplicado:
        return respuesta_error("Ya existe un administrador con ese usuario o correo.", 409)

    password_hash = generar_hash_password(data.get("password"))

    admin_id = ejecutar_consulta(
        """
        insert into administradores
        (
            nombres, apellidos, usuario, correo,
            password_hash, estado
        )
        values (%s, %s, %s, %s, %s, %s)
        """,
        (
            data.get("nombres").strip(),
            data.get("apellidos").strip(),
            data.get("usuario").strip(),
            data.get("correo").strip(),
            password_hash,
            data.get("estado", "activo")
        ),
        commit=True
    )

    return respuesta_ok("Administrador creado correctamente.", {
        "id": admin_id
    }, 201)


@app.route("/api/admin/usuarios/<int:id>", methods=["PUT"])
@token_requerido
def actualizar_admin(id):
    data = request.get_json() or {}

    admin = ejecutar_consulta(
        "select id from administradores where id = %s",
        (id,),
        fetchone=True
    )

    if not admin:
        return respuesta_error("Administrador no encontrado.", 404)

    valido, mensaje = validar_admin(data, editando=True)

    if not valido:
        return respuesta_error(mensaje, 400)

    duplicado = ejecutar_consulta(
        """
        select id
        from administradores
        where id <> %s
        and (usuario = %s or correo = %s)
        limit 1
        """,
        (
            id,
            data.get("usuario").strip(),
            data.get("correo").strip()
        ),
        fetchone=True
    )

    if duplicado:
        return respuesta_error("Ya existe otro administrador con ese usuario o correo.", 409)

    ejecutar_consulta(
        """
        update administradores
        set nombres = %s,
            apellidos = %s,
            usuario = %s,
            correo = %s,
            estado = %s
        where id = %s
        """,
        (
            data.get("nombres").strip(),
            data.get("apellidos").strip(),
            data.get("usuario").strip(),
            data.get("correo").strip(),
            data.get("estado", "activo"),
            id
        ),
        commit=True
    )

    if data.get("password"):
        if len(data.get("password")) < 6:
            return respuesta_error("La contraseña debe tener al menos 6 caracteres.", 400)

        password_hash = generar_hash_password(data.get("password"))

        ejecutar_consulta(
            "update administradores set password_hash = %s where id = %s",
            (password_hash, id),
            commit=True
        )

    return respuesta_ok("Administrador actualizado correctamente.")


@app.route("/api/admin/usuarios/<int:id>", methods=["DELETE"])
@token_requerido
def eliminar_admin(id):
    admin_actual = request.admin["id"]

    if id == admin_actual:
        return respuesta_error("No puedes eliminar tu propio usuario.", 400)

    admin = ejecutar_consulta(
        "select id from administradores where id = %s",
        (id,),
        fetchone=True
    )

    if not admin:
        return respuesta_error("Administrador no encontrado.", 404)

    ejecutar_consulta(
        "delete from administradores where id = %s",
        (id,),
        commit=True
    )

    return respuesta_ok("Administrador eliminado correctamente.")


# =====================================================
# RUTA DEV: CREAR ADMIN INICIAL
# =====================================================

@app.route("/api/dev/crear-admin-inicial", methods=["GET"])
def crear_admin_inicial():
    existe = ejecutar_consulta(
        "select id from administradores where usuario = 'admin'",
        fetchone=True
    )

    if existe:
        return respuesta_ok("El administrador inicial ya existe.", {
            "usuario": "admin"
        })

    password_hash = generar_hash_password("admin123")

    admin_id = ejecutar_consulta(
        """
        insert into administradores
        (
            nombres, apellidos, usuario, correo,
            password_hash, estado
        )
        values (%s, %s, %s, %s, %s, %s)
        """,
        (
            "Administrador",
            "INAMHI",
            "admin",
            "admin@inamhi.gob.ec",
            password_hash,
            "activo"
        ),
        commit=True
    )

    return respuesta_ok("Administrador inicial creado correctamente.", {
        "id": admin_id,
        "usuario": "admin",
        "password": "admin123"
    })


# =====================================================
# MANEJO DE ERRORES
# =====================================================

@app.errorhandler(404)
def not_found(error):
    return respuesta_error("Ruta no encontrada.", 404)


@app.errorhandler(500)
def server_error(error):
    return respuesta_error("Error interno del servidor.", 500)


# =====================================================
# EJECUCIÓN
# =====================================================

if __name__ == "__main__":
    print("============================================")
    print(" Agenda Telefónica INAMHI - Backend Flask")
    print(f" API: http://{FLASK_HOST}:{FLASK_PORT}/api/test")
    print("============================================")

    app.run(
        host=FLASK_HOST,
        port=FLASK_PORT,
        debug=FLASK_DEBUG
    )