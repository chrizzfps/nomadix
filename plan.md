📂 Documento de Arquitectura y Especificaciones: NOMADIX

Versión: 1.0.0
Descripción: Plataforma SaaS de gestión financiera multimoneda, almacenamiento seguro de documentos y planificación de viajes para nómadas digitales y expatriados.

1. 🎯 Visión General del Proyecto

Nomadix es una aplicación web responsiva (Mobile-First) diseñada para controlar finanzas personales con un enfoque estricto en la segregación de capitales ("Bóvedas/Cajas") y el manejo multimoneda nativo (EUR / USD). Incluye herramientas adicionales críticas para expatriados: bóveda de documentos legales y planificador de presupuestos de viaje.

Estilo de Diseño: Minimalismo extremo, Alta fidelidad. Inspiración: Apple, Airbnb, Stripe. Completamente monocromático (Blanco, Negro, escalas de grises). Sin colores vivos.

2. 🛠 Stack Tecnológico Seleccionado

Para garantizar rendimiento, SEO, y facilidad de despliegue como SaaS:

Framework Frontend: Next.js 14+ (App Router) con React.

Lenguaje: TypeScript (Estricto).

Backend & Base de Datos: Supabase (PostgreSQL, Auth, Storage, Edge Functions).

Estilos: Tailwind CSS.

Componentes UI: Shadcn UI (altamente customizado para eliminar cualquier rastro visual "por defecto" y adaptarlo al esquema monocromático).

Animaciones: Framer Motion (para transiciones de página, onboarding, micro-interacciones suaves).

Iconografía: Phosphor Icons o Radix Icons (Prohibido usar Lucide por directriz de diseño. Se buscan trazos finos, geométricos y elegantes).

Gestión de Estado: Zustand (ligero y directo) y React Query (para caché de datos de Supabase).

Formularios: React Hook Form + Zod (validación).

3. 🎨 Directrices de Diseño (UI/UX)

La IA debe generar componentes siguiendo estas reglas estrictas:

Paleta de Colores: * Fondo principal: #FFFFFF (Blanco puro) o #FAFAFA.

Superficies/Tarjetas: #F4F4F5 (Zinc 100) para modo claro.

Texto principal: #09090B (Zinc 950).

Bordes: #E4E4E7 (Zinc 200).

Modo Oscuro (opcional pero recomendado): Invertido utilizando la escala Zinc de Tailwind. Fondo #000000, texto #FFFFFF. Ningún color primario (ni azul, ni verde). Los botones principales son fondo negro, texto blanco.

Tipografía: Geist, Inter o SF Pro Display. Pesos tipográficos contrastantes (Ej. Títulos en Semibold, cuerpo en Regular).

Bordes: Radios suaves (rounded-2xl o rounded-3xl para modales y tarjetas al estilo Apple).

Sombras: Prácticamente inexistentes, diseño "Flat" con bordes sutiles (1px solid border) para separar elementos.

Feedback visual: Skeleton loaders elegantes en lugar de spinners clásicos.

4. 🗄 Arquitectura de Base de Datos (Supabase Schema)

El sistema requerirá las siguientes tablas principales con RLS (Row Level Security) activado para que cada usuario solo vea su data:

users_profile

id (uuid, FK a auth.users)

full_name, avatar_url, base_currency (EUR o USD)

emergency_contact, social_links (jsonb)

vaults (Las "Cajas" o Capitales)

id, user_id

name (Ej: "Capital Venezuela", "Ingresos España")

currency (Moneda base de esta caja: EUR o USD)

type (savings, checking, cash)

is_protected (Booleano. Si es true, requiere confirmación extra para gastar de aquí).

transactions

id, user_id, vault_id (FK)

amount (numérico), type (income, expense, transfer)

original_currency (Moneda en la que se hizo la transacción)

exchange_rate_at_time (Tasa de cambio guardada al momento de la transacción para mantener el historial exacto).

category, date, description

documents (Bóveda Segura)

id, user_id

title (Ej: "Pasaporte", "TIE")

file_url (Referencia a Supabase Storage)

expiry_date (Para mandar notificaciones)

trips & trip_itineraries

id, user_id, destination_name, start_date, end_date

total_budget, currency

Itinerarios vinculados por trip_id.

5. ⚙️ Funcionalidades Core a Desarrollar

A. Onboarding y Autenticación

Login/Registro: Animado con Framer Motion. Ingreso vía Email/Password o Google (Supabase Auth).

Flujo de Onboarding: Pantallas paso a paso (Estilo Typeform/Airbnb):

Nombre y configuración de perfil.

Selección de moneda base principal (EUR o USD).

Creación de la primera "Bóveda" (Ej: Capital Inicial).

B. Dashboard Multimoneda (El Resumen)

Saldo Total Combinado: Suma de todas las bóvedas, mostrada en GRANDE.

Toggle de Moneda: Un switch elegante (EUR ⇄ USD). Al cambiar, TODOS los saldos del dashboard se recalculan al instante según la tasa de cambio del día (obtenida vía API externa o Edge Function de Supabase).

Gráfica minimalista: Línea de tendencia de gastos vs ingresos (Blanco y negro).

C. Gestión de Bóvedas (Cajas) y Transacciones

Visualización de tarjetas tipo "Credit Card" para cada Bóveda.

Nueva Transacción: Modal (BottomSheet en móvil) que pregunta:

¿Es Ingreso o Gasto?

¿Monto y Moneda? (Si gastas en EUR pero la caja es en USD, hace la conversión auto).

¿De qué Bóveda sale el dinero? (Selector visual).

D. Bóveda de Documentos (Identity Vault)

Área tipo "Wallet" del iPhone.

Subida de imágenes/PDF a un bucket privado de Supabase.

Preview de los documentos (Blur effect antes de hacer clic por privacidad).

E. Módulo "Nomad Travel"

Sección para agregar próximos destinos.

Asignación de un presupuesto específico a cada viaje.

Mini-itinerario (Día 1, Día 2, etc.) integrado.

6. 🚀 Plan de Ejecución (Roadmap para el Agente de IA)

Fase 1: Setup y Arquitectura (Día 1)

Inicializar Next.js + Tailwind + Shadcn.

Configurar tema global monocromático en tailwind.config.ts y CSS variables.

Configurar Supabase Client y tablas iniciales (Ejecutar SQL en Supabase).

Fase 2: Autenticación y Onboarding (Día 2)

Crear Auth UI (Login/Register).

Construir el multi-step onboarding usando Zustand para el estado temporal y guardado final en la tabla users_profile y vaults.

Fase 3: Core Financiero (Días 3-5)

Crear API Routes/Server Actions para CRUD de Bóvedas y Transacciones.

Integrar API de Tasa de Cambio (Ej. ExchangeRate-API) para conversión en tiempo real USD/EUR.

Construir el Dashboard y el modal inteligente de nueva transacción.

Fase 4: Documentos y Viajes (Días 6-7)

Implementar Supabase Storage. Subida de archivos con barra de progreso.

Construir la UI del Identity Vault.

Construir el CRUD del módulo de Viajes y Presupuestos.

Fase 5: Pulido UX/UI (Día 8)

Añadir transiciones de página con Framer Motion (AnimatePresence).

Revisar responsividad estricta (Mobile menu tipo bottom-navigation-bar).

Auditoría de consistencia de color (asegurar 0% saturación, solo negros, grises y blancos).

Nota para la IA Asistente: Sigue este documento estrictamente. Prioriza componentes limpios, código modular en /components y /lib, y utiliza Server Components de Next.js siempre que sea posible para optimizar la carga.