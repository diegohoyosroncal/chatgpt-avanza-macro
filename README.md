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

- **Versión 1.0.2:** 11/11 pruebas automatizadas en Chromium aislado: control visible, envío por clic, confirmación en DOM, protección contra dobles envíos, borradores, bloqueo durante generación, envío no confirmado, ausencia de botón Enviar, montaje SPA, atajo y vista móvil. No hubo llamadas de red externas generadas por el script.
- Archivo GitHub con SHA de contenido Git Blob `5bf154be88e202855d932342da56f987bcdded30`, leído y contrastado con el archivo probado localmente.
- El botón sólo verifica visibilidad de mensaje en el DOM; no puede probar entrega final en servidores ni el cumplimiento de instrucciones por el modelo. Si falta recibo, lo señala expresamente.
- **Instalación real de escritorio y Android: 0/2 verificada.** No se ha usado ni autorizado una sesión remota para instalar extensiones.
- Un gestor de scripts como Tampermonkey puede solicitar permisos amplios de acceso a sitios, aunque este userscript declara únicamente los dominios ChatGPT y no efectúa solicitudes de red.
- No se instaló ningún cron, servicio adicional ni se autorizó gasto.
