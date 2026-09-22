Este proyecto usa el stack definido en el README.md. Componentes sin clases.
Usa el sistema de diseño ya presente en el repo si existe; no crees componentes duplicados
si ya existe un equivalente. No inventes dependencias nueva sin justificarlo en el plan.
El manejo de estado va en hooks o en el store ya definido, nunca mezclado directo en el JSX.
Toda llamada a la API pasa por la capa de servicios existente, nunca fetch/axios sueltos
dentro de un componente. Nombre de archivos y componentes en PascalCase, hooks con prefijo
"use". Antes de tocar estilos globales o el sistema de diseño, justifícalo en el plan.