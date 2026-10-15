🎨

**KitchenBase**

Guía de Estilo — Documento 5

Versión 1.1 · Octubre 2026

*Alcance: Ola 1 — MVP*

*Nota: este documento consolida en un único lugar las decisiones visuales ya tomadas en la PRD §8 (D-023 a D-025) y documenta los patrones de interfaz y de experiencia que el prototipo ya usa, para garantizar consistencia a medida que el proyecto pasa de Emergent a Claude Code (React Native + Expo). Las convenciones de **código** viven aparte, en el repositorio (`docs/STYLEGUIDE.md`).*

*Nota de revisión v1.1 (octubre 2026): se añaden los tokens de hover y pulsado del terracota (D-036), la regla de estados de los botones primarios una nota de contraste en accesibilidad y la nueva sección 9, Identidad de marca (D-037).*

# 1. Filosofía visual

KitchenBase adopta un tono **limpio y funcional**: minimalista, con espacios generosos y foco en la información. Es una app de productividad aplicada a la cocina, no un libro de recetas con fotos. Ningún elemento decorativo sin función. Los **colores del semáforo (verde, amarillo, naranja) son los protagonistas cromáticos**; el resto del sistema no debe competir con ellos.

# 2. Tokens de diseño

| Token | Valor y uso |
| --- | --- |
| Color de marca | **#C2714F** (terracota) — acción primaria, iconos activos de navegación, acentos, barra superior |
| Fondo principal | **#FFFFFF** — tarjetas y superficies |
| Fondo secundario | **#F5F5F4** — fondo de pantalla, separadores de sección |
| Marca hover | **#B0603F** (brand-hover) — botones primarios en hover (solo web) |
| Marca pulsado | **#9A4F32** (brand-pressed) — botones primarios al pulsar (web y móvil) |
| Marca clara | **#FDF3EF** (brand-light) — fondos sutiles de acento, chips/badges |
| Texto principal | **#1F2937** — títulos, nombres, datos primarios |
| Texto secundario | **#6B6B6B** — metadatos, etiquetas, apoyo |
| Semáforo verde | **#22C55E** — receta lista para cocinar |
| Semáforo amarillo | **#EAB308** — faltan ingredientes secundarios |
| Semáforo naranja | **#F97316** — falta al menos un ingrediente clave |
| Tipografía títulos | **Playfair Display** (serif) — nombres de recetas, títulos de pantalla |
| Tipografía interfaz | **Inter** (sans-serif) — todo lo demás |
| Radios | **8px** componentes internos · **12px** tarjetas |
| Elevación | **Sin sombras.** Separación por color de fondo y bordes finos (0.5px) |

# 3. Uso del color del semáforo

Los tres colores son **funcionales, no decorativos**. Verde = se puede cocinar ahora; amarillo = solo faltan secundarios; naranja = falta al menos un ingrediente clave. **No usar estos colores para ningún otro propósito** en la interfaz, para evitar confusión semántica. El color lo decide siempre el motor en servidor (nunca el cliente).

# 4. Tipografía

- **Playfair Display**: nombres de recetas y títulos de pantalla. También en el número de paso del asistente y en titulares de estados vacíos.
- **Inter**: etiquetas, cantidades, metadatos, botones, cuerpo. Es la tipografía por defecto de todo lo que no sea un título.

# 5. Patrones de componentes y de experiencia

Patrones que el prototipo ya usa y que deben mantenerse consistentes:

- **Modales hoja inferior (bottom-sheet)** para los flujos `MOD-*` (añadir/editar ingrediente, confirmar comprado, confirmar cocinado). Siempre con botón de cierre visible y vuelta al punto de origen.
- **Asistente a pantalla completa** (crear receta, REC-002): barra de progreso terracota, cabecera propia con cierre, y **sin** barra de pestañas inferior.
- **FAB “+”** (botón flotante) para la acción de añadir en listados (despensa, recetas).
- **Control segmentado** para alternar vistas (p. ej. “Por ubicación / Por categoría”). El cambio es inmediato, no navega.
- **Búsqueda sticky** en la parte superior de los listados, con filtro **insensible a acentos y mayúsculas**.
- **Estados vacíos con CTA** claro y orientado a la acción (p. ej. “Crear mi primera receta”). En Home, **sin alertas negativas**.
- **Diálogo de confirmación** para toda acción destructiva (eliminar, vaciar lista), con etiqueta de acción explícita.
- **Placeholder “Próximamente”** (componente ComingSoon) para pantallas no construidas, con título en Playfair.
- **Pills / badges sutiles** con `brand-light` para estados: Privada, Propuesta, Borrador, Pendiente, “cálculo aproximado”.
- **Estados de los botones primarios** (D-036): normal `#C2714F`, hover `#B0603F`, pulsado `#9A4F32`, siempre con texto blanco. En móvil solo existe el pulsado (`pressed` en `Pressable`). Los botones secundarios, fantasma y los fondos seleccionados usan `brand-light` (`#FDF3EF`) en hover. Sin sombras ni cambios de opacidad.
- **Toasts breves** para feedback de acciones (añadido, guardado, error), no intrusivos.

# 6. Tono de voz y copy

- **100% en español**, cercano y orientado a la acción. Tutea al usuario.
- Botones en **imperativo claro** (“Guardar receta”, “Añadir a mi despensa”, “Confirmar y descontar”).
- **Sin culpabilizar**: Home no muestra alertas negativas; cuando falta algo, se propone una acción (“¿Vamos a la compra?”).
- Los **errores de Supabase se traducen a mensajes en español** comprensibles, mostrados junto al campo o como toast, sin tecnicismos.

# 7. Layout móvil

- Diseño **mobile-first** para anchos de **375–430px**, usable con una sola mano.
- En escritorio, el contenido se enmarca a un ancho máximo (~430px) mediante `MobileFrame`.

# 8. Accesibilidad

- `aria-label` en botones de solo icono (p. ej. “Añadir ingrediente”).
- Contraste suficiente entre texto y fondo; los colores del semáforo se acompañan de texto o icono, nunca solo color.
- **Contraste del botón primario:** el texto blanco sobre terracota normal da 3,6:1, por debajo de los 4,5:1 del texto normal. Se acepta porque el texto de los botones primarios es Inter 600 de al menos 14 px (texto grande, umbral 3:1). Hover (4,6:1) y pulsado (5,9:1) lo superan. La terracota no se usa como color de texto pequeño sobre blanco.
- Objetivos táctiles cómodos (mínimo ~44px de alto en controles principales).

# 9. Identidad de marca

Decisión D-037. Los archivos están en `frontend/public/brand/`.

- **Símbolo:** gorro de chef alto en terracota, con una K invertida y una B compartiendo el tallo, recortadas como espacio negativo. Por debajo de **32 px** se usa la versión pequeña (cortes más gruesos).
- **Nombre:** «KitchenBase» en **Playfair Display Bold**, con la K y la B en terracota (`#C2714F`) y el resto en `#1F2937`. El punto de la i es una bolita terracota.
- **Logo con nombre:** horizontal (cabeceras, web) y vertical (pantalla de bienvenida, redes). Sobre terracota, todo en blanco y terracota claro `#FDF3EF`. Sobre oscuro, símbolo y nombre en blanco.
- **Margen libre:** un cuarto de la altura del símbolo por cada lado. **Tamaño mínimo:** 32 px el símbolo completo, 120 px de ancho el logo horizontal.
- **Prohibido:** deformar, girar, cambiar los colores, añadir sombras o degradados, y usar verde, amarillo o naranja del semáforo.
- **Icono de app:** gorro blanco sobre terracota, 1024×1024 sin transparencia ni esquinas redondeadas (iOS). En Android, primer plano transparente, fondo terracota y capa monocroma por separado, con el gorro dentro de la zona segura. Favicon con la versión pequeña. Pantalla de carga con el símbolo centrado.

---

*Documento vivo. Actualizar cuando cambie un token, se añada un patrón de UI nuevo, o evolucione el tono. Las decisiones de fondo se registran en el Documento 4 (D-023 a D-025, D-036 y D-037).*

*KitchenBase · Guía de Estilo v1.0*
