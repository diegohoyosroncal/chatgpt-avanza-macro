# AVANZA — Macro de continuación inteligente para ChatGPT

Agrega el botón **▶ AVANZAR AL OBJETIVO** a conversaciones web antiguas y nuevas de ChatGPT y ofrece el atajo **Alt + Mayús + A**.

## Instalación (una sola vez por navegador)

1. Instala [Tampermonkey para Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) o [Tampermonkey para Firefox Android](https://addons.mozilla.org/en-US/android/addon/tampermonkey/) desde Mozilla.
2. Abre el **[enlace directo de instalación](https://raw.githubusercontent.com/diegohoyosroncal/chatgpt-avanza-macro/main/avanza_macro.user.js)** y acepta la instalación del script.
3. Abre o recarga un chat en https://chatgpt.com/; usa el botón amarillo.

Si no aparece la pantalla de instalación, abre Tampermonkey > Utilities > Install from URL y pega el enlace directo. También puedes importar un archivo local .user.js.

## Seguridad y alcance

- Sólo actúa en chatgpt.com y chat.openai.com dentro de navegadores compatibles; **no se instala dentro de la app nativa ChatGPT Android**.
- Sin solicitudes de red, analítica ni envío de conversaciones a terceros. El script modifica exclusivamente el cuadro de mensaje local al hacer clic.
- Protege borradores, evita envíos durante generación y, si no consigue un botón Enviar habilitado, **deja el texto sin afirmar un envío exitoso**.
- No constituye un proceso que continúe tras cerrar el chat ni puede obligar al modelo a mostrar siempre porcentajes. El runtime externo es un mecanismo diferente.
- ChatGPT no ofrece API oficial para cambiar instrucciones personalizadas de la cuenta; sólo una sesión web autenticada con permisos reales podría hacerlo, y aquí no hay acceso autorizado funcional al navegador.
- Cada navegador requiere autorización inicial para instalar Tampermonkey y el script. Se puede desactivar en el gestor en cualquier momento.

## Estado de verificación

- **Versión 1.0.3:** 11/11 pruebas automatizadas en Chromium aislado: control visible, envío por clic, confirmación en DOM, protección contra dobles envíos, borradores, bloqueo durante generación, envío no confirmado, ausencia de botón Enviar, montaje SPA, atajo y vista móvil. No hubo llamadas de red externas generadas por el script.
- Archivo GitHub con SHA de contenido Git Blob `92d0b14a8953fc9a502885217d6fb28dbfd7d519`, leído y contrastado con el archivo probado localmente.
- El botón sólo verifica visibilidad de mensaje en el DOM; no puede probar entrega final en servidores ni el cumplimiento de instrucciones por el modelo. Si falta recibo, lo señala expresamente.
- **Instalación real de escritorio y Android: 0/2 verificada.** No se ha usado ni autorizado una sesión remota para instalar extensiones.
- Un gestor de scripts como Tampermonkey puede solicitar permisos amplios de acceso a sitios, aunque este userscript declara únicamente los dominios ChatGPT y no efectúa solicitudes de red.
- No se instaló ningún cron, servicio adicional ni se autorizó gasto.

## Puente de continuidad v1.0.3

Cuando el usuario activa **AVANZA**, la macro ahora pide comprobar, usando **solo conectores autorizados y existentes**, la cadena `COLA → ENTREGA A RESPONSABLE → ACCIÓN → EFECTO` por separado. Un recibo `DONE` de una cola no equivale a autonomía útil. El script no hace llamadas de red ni almacena secretos; el puente se ejecuta únicamente si el asistente tiene las herramientas autorizadas en ese chat. La ejecución en todos los chats nativos, la entrega a owner y el trabajo posterior al cierre **siguen sin estar acreditados**. El código v1.0.3 pasó 11/11 pruebas de interfaz aisladas y su blob Git coincide byte por byte con la versión local (`92d0b14a8953fc9a502885217d6fb28dbfd7d519`).

## Botón fijo mientras haces scroll

El botón web usa `position:fixed`, queda anclado cerca del extremo inferior derecho de la ventana y el `MutationObserver` lo reconstruye cuando una navegación de ChatGPT sustituye el DOM. Verificación adicional local en Chromium aislado: **2/2 PASS** con desplazamiento vertical de 2100 px en viewport escritorio 1280×800 y móvil 390×844; coordenada vertical del botón sin cambios antes y después. No significa instalación real en tu cuenta ni que se pueda fijar el botón dentro de la app Android nativa o dentro de los mensajes de ChatGPT. El instalador exige aprobación previa del navegador y no puede eludirla.

## AVANZA Macro Maestro v4 — interfaz adaptativa, un solo botón

**Nueva versión opcional, aditiva:** `avanza_macro_maestro_v4.user.js`. La macro original `avanza_macro.user.js` (v1.0.3) permanece intacta; no sustituye el runtime, los objetivos, autorizaciones, porcentajes canónicos ni los checkpoints de otros proyectos.

**Instalar en navegadores compatibles con userscripts:** [abrir el instalador v4](https://raw.githubusercontent.com/diegohoyosroncal/chatgpt-avanza-macro/main/avanza_macro_maestro_v4.user.js) con Tampermonkey activo y aceptar la instalación del script. `Alt+Mayús+A` = AVANZAR/detener. Un panel oscuro fijo muestra porcentaje actual, anterior→actual, variación, denominador, pendiente, objetivo y ciclos. Si falta evidencia, muestra guiones en lugar de cero inventado. Resuelve internamente entre ejecutar, verificar, desatascar, comparar alternativas y continuar, sin obligar al usuario a elegir un modo.

**Retroalimentación por respuesta:** sólo después de activación humana en ese chat, un ciclo puede leer la respuesta completa visible, solicitar un recibo `AVANZA_CONTROL` estructurado (declaración del asistente, no comprobante independiente), contrastar coherencia aritmética y generar un siguiente mensaje dentro del mismo chat. Protege borradores, no inicia al cargar, detiene ante intervención humana o cambio de chat, no hace llamadas de red propias y acota reintentos para evitar costes y bucles. Requiere que ChatGPT haya enviado de verdad la respuesta y que la pestaña siga disponible. No actúa autónomamente con el navegador cerrado, no accede a herramientas/credenciales ajenas y no certifica cumplimiento en los chats nativos.

**Verificación previa a publicación:** `node --check` y 31/31 controles de interfaz/flujo aislados en Chromium: estado visual, porcentajes, auto-continuación acotada, intervención, seguridad de borradores, fallas de envío, métricas inconsistentes, cambios de chat, protección de objetivos, móvil y re-montaje SPA. **Instalación real y eficacia en ChatGPT autenticado: aún no verificadas.** No se requiere crear servicios ni efectuar gastos adicionales. El userscript conserva `@updateURL`/`@downloadURL` hacia su propia ruta v4; las comprobaciones e instalaciones automáticas dependen de los ajustes/permisos de Tampermonkey.

**Un navegador = instalación por usuario/perfil.** La cobertura de los chats antiguos y nuevos se consigue en la interfaz web de ese perfil donde esté instalado, no en la aplicación móvil nativa ni a través de una actualización de modelo global. Para instalación real, usar sesión de navegador legítima con aprobación del titular.

## Actualización 4.0.3 — coordinación paralela sin duplicación

- **Una sola acción AVANZAR:** la macro sigue siendo un panel por conversación web compatible; no exige elegir entre el proyecto económico y la interfaz. Railway/los owners siguen su ejecución separada, con su propia verificación y checkpoints.
- **Bloqueo cruzado entre pestañas:** si dos pestañas del mismo navegador/perfil están abiertas en el mismo chat, solo una puede controlar los autoenvíos de AVANZA a la vez; el segundo panel lo informa y no envía. El bloqueo caduca si una pestaña se cierra inesperadamente y se libera al detenerse. No se almacenan mensajes ni claves en ese bloqueo.
- **Alcance real:** no sincroniza el navegador con otra computadora/perfil ni instala nada en la app nativa. El motor de Railway conserva sus propias reglas de single-owner e idempotencia; no confundir el control de pestañas con bloqueo distribuido de acciones externas.
- **QA:** 46/46 pruebas locales aisladas PASS (38 de regresión + 8 de coordinación entre pestañas). No constituye prueba de instalación en ChatGPT autenticado ni de resultados comerciales. [Instalador v4 estable](https://raw.githubusercontent.com/diegohoyosroncal/chatgpt-avanza-macro/main/avanza_macro_maestro_v4.user.js) — requiere Tampermonkey con aprobación inicial. Abrir el enlace raw sin un userscript manager puede mostrar únicamente el JavaScript; en ese caso usar Tampermonkey → Utilities → Install from URL.

## 4.3.1 — porcentaje visible antes de pulsar AVANZAR

**Corrección aditiva ya publicada.** El cockpit conserva todos los módulos v4.3.0 (🎮 Quest, 🌐 Sync, 🎨 Aura, multiproyecto, motor, AUTO/MANUAL y bloqueo por conversación) y recupera porcentajes desde los informes ya visibles en el chat, sin pedir un mensaje adicional. La recuperación solo acepta nombres de objetivo reconocibles y valores coherentes con numerador/denominador (p. ej. 40%=2/5); los identifica como información **declarada en el chat, no prueba primaria**. Nunca habilita AUTO por descubrir un porcentaje y no reemplaza el proceso 🧩 existente. Incluye guardia contra dos ejecuciones del mismo userscript en una página.

**Estado de verificación:** 6/6 casos funcionales del extractor aislado, prueba previa en Chromium del extractor para 40%=2/5, 60%=3/5 y guardia de montaje, 12/12 comprobaciones de preservación del código v4.3.0, confirmación remota de v4.3.1 en GitHub. **No hay todavía prueba de la instalación en el perfil Firefox real de la persona usuaria.** Una URL raw que muestra código no es instalación.

**Instalación soportada:** requiere Tampermonkey activo en Firefox y aprobación de instalación. [Instalar la versión actual](https://raw.githubusercontent.com/diegohoyosroncal/chatgpt-avanza-macro/main/avanza_macro_maestro_v4.user.js) o usar Tampermonkey → Utilidades → Importar/Instalar desde URL. Recargar https://chatgpt.com después. Un userscript solo cubre las conversaciones web del perfil donde está instalado: no reconfigura todas las conversaciones nativas ni ejecuta tras cerrar el navegador. El ejecutor externo Railway sigue separado y sin modificaciones.

## Aurora Focus · versión 4.4.4

- **La versión vigente vive en el archivo existente** `avanza_macro_maestro_v4.user.js`, con `@updateURL` y `@downloadURL` estables. No instalar copias anteriores como segunda macro: los controles de conflicto bloquean los envíos duplicados.
- **Presentación prioritaria:** modo foco al iniciar (un botón grande AVANZAR/AUTO ACTIVO, porcentaje grande, variación y siguiente hito). El panel expandido y 🌌 Mission Control conservan módulos, proyectos y Learn Quest. Colores aurora, brillo/actividad solo cuando AUTO trabaja, alternativa de movimiento reducido para accesibilidad. Cada conversación conserva su autorización AUTO propia.
- **No hay repetición ciega:** si no existe una respuesta verificable o la acción está en vuelo, no se reenvía; los ciclos improductivos se aparcan, se cuestiona la estrategia y se conservan los checkpoints. Este mecanismo de navegador NO ejecuta fuera de una sesión de navegador compatible, ni instala automáticamente la extensión en perfiles distintos.
- **Comprobación de entrega:** código v4.4.4 publicado y lectura desde ruta `raw` cotejada con GitHub; 14/14 comprobaciones estructurales/por-contexto sobre v4.4.3, 10/10 de cambios foco sobre v4.4.4, 5/5 pruebas de preferencia y controles funcionales aislados. **Instalación y AUTO en Firefox autenticado: todavía NO verificados.**
- **Si un enlace abre texto:** falta que Tampermonkey intercepte el userscript. En Firefox, habilitar Tampermonkey una vez y usar *Dashboard → Utilities → Install from URL*, con el siguiente enlace: https://raw.githubusercontent.com/diegohoyosroncal/chatgpt-avanza-macro/main/avanza_macro_maestro_v4.user.js . Después, recargar ChatGPT. Una URL raw abierta sola no implica instalación.

## Corrección de pulsación v4.4.6

- **Fallo real corregido:** ChatGPT a menudo mantiene el botón Enviar deshabilitado hasta que el cuadro contiene texto. La versión anterior buscaba Enviar habilitado *antes* de rellenar el mensaje; la v4.4.5 ahora rellena el editor, espera hasta 1,2 s al control habilitado, verifica que el texto no haya sido editado y solo entonces envía. Si el botón sigue sin habilitarse, limpia solamente el borrador exacto que ella misma creó, no el del usuario, y no reintenta a ciegas.
- **Botón no inerte ante macros antiguas:** v4.4.6 permite pulsar AVANZAR para recibir la razón del bloqueo, aunque existan scripts legacy; la ruta de envío sigue cerrada hasta evitar conflictos y duplicaciones.
- **Pruebas aisladas:** 6/6 escenarios funcionales del envío desde cuadro vacío y casos negativos; prueba adicional de click en presencia de conflicto; verificación de sintaxis y publicación GitHub/URL raw (10/10). No son garantía de funcionamiento en la cuenta autenticada.
- **Instalación:** abrir un enlace a un archivo `.user.js` no ejecuta ni instala la macro sin extensión. En Firefox autorizar Tampermonkey, abrir *Dashboard → Utilities → Install from URL* y pegar https://raw.githubusercontent.com/diegohoyosroncal/chatgpt-avanza-macro/main/avanza_macro_maestro_v4.user.js. Luego comprobar versión v4.4.6 en el administrador y recargar ChatGPT. No instalar la copia legacy además de la principal.
