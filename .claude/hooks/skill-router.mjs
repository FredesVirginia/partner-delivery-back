#!/usr/bin/env node
// Hook UserPromptSubmit: si el prompt parece una tarea de backend, inyecta un
// recordatorio para consultar la skill "skill-orchestrator" antes de codear.
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let prompt = '';
  try {
    prompt = (JSON.parse(input).prompt || '').toLowerCase();
  } catch {
    // Sin JSON válido no hacemos nada.
  }

  const keywords = [
    'nest', 'endpoint', 'módulo', 'modulo', 'service', 'controller', 'guard',
    'dto', 'entity', 'entidad', 'auth', 'jwt', 'typeorm', 'repository', 'repositorio',
    'decorator', 'decorador', 'interceptor', 'pipe', 'provider', 'migracion',
    'migración', 'microservicio', 'websocket', 'gateway', 'api',
  ];

  if (keywords.some((k) => prompt.includes(k))) {
    process.stdout.write(
      '[skill-orchestrator] Tarea de backend detectada. Consultá la skill ' +
        '"skill-orchestrator" para rutear a la skill correcta ' +
        '(nestjs-best-practices / nodejs-backend-patterns / nodejs-best-practices / ' +
        'typescript-advanced-types) y aplicar sus reglas ANTES de escribir código.',
    );
  }
});
