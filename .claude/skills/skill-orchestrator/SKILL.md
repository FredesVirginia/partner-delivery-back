---
name: skill-orchestrator
description: Router/orquestador de skills para este backend NestJS. Úsalo AL INICIAR o PLANIFICAR cualquier trabajo de backend (nuevo módulo, endpoint, service, guard, DTO, entidad, refactor, revisión de arquitectura o seguridad) para decidir qué skill especializada consultar antes de escribir código. Rutea a nestjs-best-practices, nodejs-backend-patterns, nodejs-best-practices o typescript-advanced-types.
license: MIT
metadata:
  version: "1.0.0"
---

# Skill Orchestrator (partner-delivery-back)

Este proyecto tiene 4 skills especializadas instaladas. Este orquestador decide
**cuál consultar y en qué orden** según la tarea, para no escribir código de
backend "a ojo". Consúltalo al **empezar** o **planificar** cualquier tarea de
backend; luego abre la(s) skill(s) que indique y aplica sus reglas.

## Cómo usarlo

1. Clasificá la tarea con la tabla de ruteo.
2. Abrí la skill destino (y sus `rules/` específicas si aplica).
3. Aplicá las reglas al escribir/revisar el código.
4. Si la tarea cruza capas, seguí el orden de prioridad (arquitectura → DI →
   errores → seguridad → performance → tests → BD → API).

## Tabla de ruteo

| Si la tarea trata de… | Consultá… | Notas |
|---|---|---|
| Módulos, controllers, providers, inyección de dependencias, guards, interceptors, pipes, seguridad Nest, estructura de features | **nestjs-best-practices** | Es la principal acá. Trae `rules/` por prefijo. |
| Middleware, manejo de errores, diseño de API REST, integración con BD a nivel Node, microservicios | **nodejs-backend-patterns** | Patrones de backend agnósticos de framework. |
| Decisiones de arquitectura, elección de patrón/librería, async/concurrencia, principios generales | **nodejs-best-practices** | "Enseña a pensar", no a copiar. Útil en el diseño. |
| Tipos avanzados, generics, conditional/mapped types, utilidades de tipo, type-safety | **typescript-advanced-types** | Cuando el tipado se pone complejo. |

## Reglas clave de `nestjs-best-practices` (por prefijo)

- `arch-*` — feature modules, single responsibility, repository pattern, evitar ciclos.
- `di-*` — inyección por constructor, tokens de interfaz, scopes.
- `error-*` — HttpExceptions, exception filters, errores async.
- `security-*` — **auth-jwt**, **use-guards**, validar input, rate limiting, sanitizar output.
- `db-*` — transacciones, evitar N+1, migraciones.
- `api-*` — DTO/serialización, interceptors, pipes, versioning.

## Ejemplos de ruteo en este repo

- "Agregar endpoint de auth / guard / rol" → `nestjs-best-practices` (`security-auth-jwt`, `security-use-guards`, `api-use-dto-serialization`).
- "Nueva entidad / relación / query" → `nestjs-best-practices` (`db-*`, `arch-use-repository-pattern`).
- "Tipar un helper genérico o un util de tipos" → `typescript-advanced-types`.
- "Diseñar la arquitectura de un módulo nuevo" → `nodejs-best-practices` + `nestjs-best-practices` (`arch-*`).
