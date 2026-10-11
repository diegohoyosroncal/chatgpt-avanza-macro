# Gobierno de versiones — AVANZA

## Propósito
Evitar divergencia entre scripts y auditorías chat por chat. Este documento es **aditivo**: no borra ni desactiva scripts, proyectos, autorizaciones, experimentos, PR, checkpoints ni estados previos.

## Fuente oficial y alcance
- Repositorio: `diegohoyosroncal/chatgpt-avanza-macro`.
- Canal estable recomendado para la interfaz ChatGPT web: `avanza_macro_maestro_v4.user.js` (v4.0.2 al 2026-10-10; leer la cabecera para obtener la versión vigente).
- `avanza_macro.user.js` (v1.0.3) es legado compatible, conservado por seguridad y para comparación. Otros scripts denominados «MISION_Autonomia...» u otras versiones son variantes/pilotos, no deben asumirse equivalentes ni borrarse.
- Las macros MacroDroid/Android de telemetría v2/v3 tienen una responsabilidad **distinta** y NO se reemplazan por un userscript de navegador.
- Runtime, estado en Supabase, reglas en Notion, GitHub issues y proyectos siguen siendo fuentes separadas; el userscript no los modifica automáticamente.

## Política de versión
1. **Una sola macro activa por perfil de navegador para ChatGPT web**: evitar doble botón, doble hotkey y envíos duplicados. Desactivar, no borrar, competidoras **solamente después** de comprobar que la maestra opera en sesión real.
2. **No bifurcar por chat**. Cada chat conserva su contexto, misión y progreso; la misma macro lee el contexto disponible y se adapta.
3. **Actualizaciones desde la misma URL de instalación** con `@updateURL`, `@downloadURL` y aumento de `@version`; Tampermonkey verifica según configuración del usuario. No se debe prometer actualización instantánea ni dentro de la app Android nativa.
4. **Cambios aditivos y reversibles**. Si un cambio elimina una capacidad, exige decisión explícita y plan de migración.
5. **Release gates**: sintaxis, regresión de interfaz desktop/móvil, SPA, scroll fijo, dobles envíos, preservación de borrador, respuesta en curso, navegación, porcentaje con denominador/evidencia, estancamiento, protección ante cierre/cambio de chat, contraste de versiones; luego prueba humana en ChatGPT autenticado.
6. **Canales**: stable = versión del archivo oficial en main; candidate = rama/PR bajo pruebas; archive = scripts históricos intactos. Nunca ejecutar una candidate como estable sin aprobación y prueba.
7. **Salud visible**: mostrar versión instalada, versión publicada y estado comprobado/pendiente de comparación. Si no hay capacidad de consulta, informar «versión remota no verificada», no fingir actualización.
8. **No confundir cobertura**: «instalado en un navegador/perfil», «visible en un chat», «enviado», «respondido», «ejecutado» y «efecto independiente verificado» son hitos diferentes.

## Auditoría de compatibilidad — cada release, no por chat
- Inventariar por *tipo de ejecutor* (userscript web, MacroDroid Android, runtime/backend, prompts/paneles de chat), no por número de conversaciones.
- Para el userscript web, ensayar un conjunto representativo: chat existente largo, chat nuevo, navegación interna, Firefox/Chromium, móvil compatible, falta de recibo, objetivo completo y bloqueo humano.
- La actualización central cubre futuras vistas de ChatGPT web **solo en perfiles con el userscript activo y actualizado**.
- Cada misión mantiene porcentaje canónico propio con numerador/denominador, evidencia, delta, último checkpoint y bloqueo. No sumar ni normalizar porcentajes entre misiones distintas.
- Registrar matriz: componente, versión instalada (verificada), versión remota, superficie, compatibilidad, fecha de prueba, prueba, desviación y acción.
- Si falla una prueba: detener despliegue de la release, conservar estable y abrir incidencia. Tres intentos equivalentes sin progreso exigen diagnóstico y cambio de estrategia, no un cuarto reintento idéntico.

## Estado inicial documentado 2026-10-10
- Fuente GitHub consultada: script v4.0.2 presente y con `@updateURL` / `@downloadURL` a su misma ruta.
- README declara pruebas aisladas de v4; **instalación y eficacia en ChatGPT autenticado no acreditadas**.
- No hay verificación de versiones instaladas en cada navegador, ni actualización en la app Android nativa. Porcentaje de despliegue real: **no medible aún**, NO 0% artificial.
- Siguiente gate: observar Tampermonkey en perfil real, confirmar versión única activa y ejecutar prueba de chat auténtico, sin credenciales en archivos ni permisos innecesarios.

## Regla de no regresión
Mantener los Experimentos 01/02, issue #47, PR #170, estados de otros proyectos, reglas de progreso y seguridad sin confundir este repositorio con su owner. Ningún cambio de macro autoriza por sí solo desplegar, cobrar, gastar o alterar el runtime.
