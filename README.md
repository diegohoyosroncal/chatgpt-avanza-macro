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

Versión 1.0.1: **7/7 pruebas automatizadas en navegador aislado** (botón, un toque, protección de borrador, protección durante generación, persistencia al cambiar chat, atajo y autoreparación de DOM). GitHub readback y hash Git Blob coinciden byte a byte con la versión probada (v1.0.1, SHA-1 424eaa52c78ba62910b2826bc02238eec8426dc5). El enlace @updateURL permite buscar actualizaciones desde Tampermonkey. No se ha probado ni instalado en la sesión real del usuario, por lo que ese hito continúa pendiente. No se ha creado un cron, runtime ni servicio de pago adicional.
