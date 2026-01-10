Es una aplicación web full-stack para fitness y nutrición, enfocada en calcular macros, generar planes personalizados y permitir a los usuarios guardar sus progresos.

1. ¿En qué consiste el proyecto?
Nombre y propósito: "MiplanFitness" es una aplicación web que ayuda a los usuarios a calcular sus macros nutricionales (proteínas, grasas, carbohidratos y calorías diarias) basándose en datos personales como edad, peso, altura, sexo, nivel de actividad y objetivo (mantener peso, perder o ganar masa). Además, genera un menú semanal sugerido (con platos de diferentes categorías como desayuno, almuerzo, etc.) y un plan de entrenamiento personalizado. Los usuarios pueden registrarse, iniciar sesión y guardar sus planes en una base de datos para revisarlos después.
Tecnologías principales:
Frontend: HTML, CSS (con Bootstrap para diseño responsivo), JavaScript vanilla (sin frameworks como React). Usa librerías como AOS para animaciones y Bootstrap para modales y navegación.
Backend: Node.js con Express.js para el servidor API, SQLite como base de datos (ligera y sin necesidad de servidor externo), JWT para autenticación y bcrypt para encriptar contraseñas.
Otros: Archivos JSON para datos de alimentos (foodData.json), y un sistema de rutas estáticas para servir archivos desde la carpeta public.
Funcionalidades clave:
Calculadora de macros (usando fórmulas como BMR y TDEE).
Generación automática de menús y entrenamientos basados en el perfil del usuario.
Autenticación de usuarios (registro/login).
Guardado y gestión de planes en la base de datos (ver, descargar o eliminar).
Interfaz responsiva y accesible (con enlaces de skip, labels ocultos, etc.).
Cómo se ejecuta: El servidor (server.js) corre en el puerto 4000 (por defecto), sirve los archivos estáticos desde public, y maneja las APIs. El frontend se carga en el navegador y se comunica con el backend vía fetch.
En resumen, es una herramienta práctica para fitness: entrena, come y transforma, como dice el eslogan. Es ideal para principiantes o usuarios que quieren planes personalizados sin complicaciones.

2. Estructura general del proyecto
Carpeta public: Contiene todos los archivos del frontend (visibles al usuario).
css/: Archivos de estilos (probablemente styles.css, que no has compartido, pero se referencia en index.html).
js/: Archivos JavaScript (app.js, que has compartido).
src/: Imágenes y recursos (como logo.png, portada.jpg, etc., referenciados en HTML).
index.html: La página principal (HTML completo).
foodData.json: Un archivo JSON con datos de alimentos organizados por categorías (desayuno, almuerzo, etc.), usados para generar menús. Cada plato tiene macros (proteína, grasa, carbohidratos, kcal).
Archivos en la raíz:
data.db: La base de datos SQLite (se crea automáticamente al ejecutar el servidor).
database.sql: Script SQL para crear las tablas (users, profiles, results). Se ejecuta al iniciar el servidor.
package.json y package-lock.json: Configuración de dependencias de Node.js (Express, sqlite3, bcrypt, jwt, etc.).
README.md: Probablemente documentación del proyecto (no lo has compartido, pero es común).
server.js: El archivo principal del backend (servidor Express).
3. Descripción del Frontend (index.html y app.js)
index.html: Es la página web principal. Es un HTML5 semántico y accesible, dividido en secciones:

Navegación (Nav): Barra superior con enlaces a secciones (Inicio, Sobre, Servicios, etc.) y botones para login/registro. Cambia de estilo al hacer scroll.
Secciones principales:
Hero: Presentación con título, subtítulo y llamadas a acción (botones para calcular macros).
About: Información sobre la app (visión, enfoque práctico).
Services: Lista de servicios (entrenamiento, HIIT, nutrición, seguimiento) con imágenes.
Testimonials: Carrusel de testimonios de usuarios.
Macros: Formulario para calcular macros (campos: sexo, objetivo, edad, peso, altura, actividad). Muestra resultados y genera menú/entrenamiento.
Contact: Formulario de contacto (simulado por JS, ya que no hay PHP).
Modales: Para login, registro y "Mis planes" (para ver planes guardados).
Footer: Información básica y año dinámico.
Usa CDN para Bootstrap, AOS y fuentes (Poppins, Inter). Incluye scripts defer para cargar JS después del HTML.
Accesibilidad: Enlaces de skip, labels ocultos, roles ARIA.
app.js: El archivo JavaScript principal (en public/js/app.js). Maneja toda la lógica del frontend:

Carga de datos: Carga foodData.json al inicio para generar menús.
Funciones de cálculo:
calcularMacros(): Calcula BMR, TDEE y macros basados en fórmulas estándar (Harris-Benedict adaptada).
generarMenuDiario() y generarMenuSemanal(): Crea un menú semanal aleatorio basado en categorías de alimentos y macros objetivo.
generarPlanEntrenamiento(): Genera un plan de 7 días de entrenamiento, ajustado por sexo, edad, actividad y objetivo (ej.: más cardio para perder peso, fuerza para ganar masa).
Interacciones:
Envío del formulario de macros: Calcula, muestra resultados, genera menú/entrenamiento y guarda en localStorage.
Botón "Guardar plan": Envía los datos a la API /api/results (si el usuario está logueado).
Autenticación: Maneja registro/login vía modales, guarda tokens en localStorage y actualiza la UI (muestra botón de logout).
Modal "Mis planes": Lista planes guardados, permite ver detalles (con opción de descargar/copiar JSON), eliminar o ver resumen.
Eventos y UI: Inicializa AOS, parallax en hero, cambios en nav al scroll, reseteo de formularios. Usa helpers como $id() para acceder a elementos DOM de forma segura.
Integración con backend: Usa fetch para llamadas a APIs (registro, login, guardar perfil, resultados). Maneja errores y estados de carga.
El frontend es interactivo pero simple: calcula en el cliente y guarda en el servidor solo si el usuario está autenticado.

4. Descripción del Backend (server.js y database.sql)
database.sql: Script SQL para inicializar la base de datos SQLite.

Tablas:
users: Almacena usuarios (id, email, password_hash, name, created_at). Email único.
profiles: Datos del perfil (id, user_id, data como JSON para macros/preferencias, updated_at). Un perfil por usuario.
results: Planes guardados (id, user_id, result_data como JSON con el plan completo, summary, created_at). Índice en user_id para búsquedas rápidas.
Se ejecuta automáticamente en server.js para crear tablas si no existen.
server.js: El servidor backend con Express.

Configuración: Usa CORS, body-parser para JSON, y sirve archivos estáticos desde public. Conecta a SQLite (data.db).
APIs públicas:
POST /api/register: Registra usuario (hashea contraseña con bcrypt, crea token JWT).
POST /api/login: Inicia sesión (verifica hash, devuelve token).
APIs protegidas (requieren token JWT en header Authorization):
GET /api/profile: Obtiene datos del perfil (macros guardadas).
POST /api/profile: Guarda/actualiza perfil (datos en JSON).
GET /api/me: Info básica del usuario.
POST /api/results: Guarda un plan (resultData como JSON).
GET /api/results: Lista planes del usuario (paginado).
GET /api/results/:id: Detalle de un plan específico.
DELETE /api/results/:id: Elimina un plan.
Middleware: authMiddleware verifica tokens JWT.
Seguridad: Contraseñas hasheadas, tokens con expiración (7 días), validación básica de inputs.
Otros: Manejo de errores, logging en consola. El servidor corre en puerto 4000.
El backend es RESTful y enfocado en autenticación y almacenamiento de datos. No hay lógica de cálculo aquí (se hace en el frontend).

5. Cómo funciona la aplicación en conjunto
Inicio: El usuario abre la página (servida por Express desde public/index.html).
Cálculo: Llena el formulario de macros → JS calcula y muestra resultados, genera menú/entrenamiento.
Autenticación: Si quiere guardar, se registra/loguea → Token se guarda en localStorage.
Guardado: Envía el plan a /api/results → Se guarda en SQLite.
Gestión: En "Mis planes", lista y gestiona planes guardados vía APIs.
Persistencia: Datos en SQLite; frontend usa localStorage para estado temporal.

6. Ejecucuion
Ejecución: Instala dependencias (npm install), ejecuta node server.js(npm start), y abre http://localhost:4000. Asegúrate de que foodData.json tenga datos completos para menús variados.
